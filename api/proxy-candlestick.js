import express from "express";
import axios from "axios";

const app = express();

/** Target edge function used in production ingestion (TradingView proxy → Supabase). */
const DEFAULT_INGEST_URL =
  process.env.SUPABASE_CANDLESTICK_INGEST_URL ||
  "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candles_fractal_metadatav2";

/** When Vercel does not populate req.body (some content-types); also reject-on-error stream. */
function readRawBodyStream(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += String(chunk);
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** Turn req.body / raw text into parsed JSON object or undefined. */
function coerceJsonPayload(input) {
  if (input === undefined || input === null || input === "") return undefined;
  if (Buffer.isBuffer(input)) {
    try {
      return JSON.parse(input.toString("utf8"));
    } catch {
      return undefined;
    }
  }
  if (typeof input === "string") {
    try {
      return JSON.parse(input.trim());
    } catch {
      return undefined;
    }
  }
  if (typeof input === "object") return input;
  return undefined;
}

function supabaseAnonKey() {
  const k =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return typeof k === "string" ? k.trim() : "";
}

async function readTradingViewPayload(req) {
  let parsed = coerceJsonPayload(req.body);
  if (parsed === undefined) {
    const text = await readRawBodyStream(req);
    parsed = coerceJsonPayload(text);
  }
  return parsed;
}

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
    console.log("[proxy-candlestick] Method:", req.method);
    console.log(
      "[proxy-candlestick] req.body typeof:",
      req.body === null ? "null" : typeof req.body,
    );

    let rawBody = await readTradingViewPayload(req);

    console.log(
      "[proxy-candlestick] After parse/top-level:",
      rawBody === null ? "null" : typeof rawBody,
    );

    const incoming = Array.isArray(rawBody) ? rawBody[0] : rawBody;
    const body = incoming?.body || incoming;

    if (!body || typeof body !== "object") {
      throw new Error("No valid body payload found in request.");
    }

    const symbol = body.symbol || "UNKNOWN";
    const timeframe = body.interval || "unknown";
    const bars = Array.isArray(body.bars) ? body.bars : [];

    console.log(
      `[proxy-candlestick] Processing ${bars.length} candles for ${symbol} ${timeframe}`,
    );

    const formatted = bars.map((bar, i) => {
      const tRaw = Number(bar.time);
      const candle_time =
        tRaw < 1e12
          ? new Date(tRaw * 1000).toISOString()
          : new Date(tRaw).toISOString();

      const candle = {
        symbol,
        timeframe,
        candle_time,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume ?? 0),
        _processed_at: new Date().toISOString(),
      };

      console.log(`[proxy-candlestick] [${i + 1}/${bars.length}] ${symbol} ${candle_time}`);
      return candle;
    });

    const payload = {
      symbol,
      interval: timeframe,
      bars: formatted.map((bar) => ({
        time: new Date(bar.candle_time).getTime(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
    };

    const anonKey = supabaseAnonKey();
    if (!anonKey) {
      throw new Error(
        "Missing Supabase anon key: set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel",
      );
    }

    console.log("[proxy-candlestick] Forwarding to:", DEFAULT_INGEST_URL.split("/").slice(-2).join("/"));

    const response = await axios.post(DEFAULT_INGEST_URL, payload, {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
      timeout: 25000,
    });

    console.log("[proxy-candlestick] Edge status:", response.status);

    if (response.status < 200 || response.status >= 300) {
      const detail =
        typeof response.data === "object"
          ? JSON.stringify(response.data).slice(0, 400)
          : String(response.data ?? "").slice(0, 400);
      throw new Error(`Supabase ${response.status}: ${detail}`);
    }

    res.status(200).json({
      status: "ok",
      symbol,
      timeframe,
      inserted: formatted.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal proxy server error";
    console.error("[proxy-candlestick] Error:", message);
    res.status(500).json({ error: message });
  }
});

export default app;
