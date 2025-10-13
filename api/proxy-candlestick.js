import express from "express";
import axios from "axios";

const app = express();

// ❌ Do NOT call express.json() here — Vercel parses JSON automatically

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
    // --------------------------
    // 🪵 DEBUG: Inspect raw body
    // --------------------------
    console.log("🔹 Method:", req.method);
    console.log("🔹 Raw req.body type:", typeof req.body);
    console.log(
      "🔹 Raw req.body keys:",
      req.body && typeof req.body === "object" ? Object.keys(req.body) : "no body"
    );

    // If req.body is undefined, read raw text stream manually
    let rawBody = req.body;
    if (!rawBody && req.method === "POST") {
      const text = await new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
      });
      try {
        rawBody = JSON.parse(text);
        console.log("✅ Parsed rawBody manually:", Object.keys(rawBody));
      } catch {
        console.log("⚠️ Could not parse rawBody as JSON. Raw snippet:", text.slice(0, 200));
      }
    }

    // --------------------------
    // 🧩 Normalize structure
    // --------------------------
    const incoming = Array.isArray(rawBody) ? rawBody[0] : rawBody;
    console.log("🔹 Incoming type:", typeof incoming);
    console.log(
      "🔹 Incoming keys:",
      incoming && typeof incoming === "object" ? Object.keys(incoming) : "no incoming"
    );

    const body = incoming?.body || incoming;
    console.log(
      "🔹 Final body keys:",
      body && typeof body === "object" ? Object.keys(body) : "no body"
    );

    if (!body) {
      throw new Error("❌ No valid body payload found in request.");
    }

    // --------------------------
    // 🕹️ Extract candle data
    // --------------------------
    const symbol = body.symbol || "UNKNOWN";
    const timeframe = body.interval || "unknown";
    const bars = Array.isArray(body.bars) ? body.bars : [];

    console.log(`📊 Processing ${bars.length} candles for ${symbol} ${timeframe}`);

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

      console.log(`✅ [${i + 1}/${bars.length}] ${symbol} ${candle_time}`);
      return candle;
    });

    // --------------------------
    // 🚀 Forward to Supabase Edge Function
    // --------------------------
    const response = await axios.post(
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candles_fractal_metadatav2",
      { candles: formatted },
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `✅ Forwarded ${formatted.length} candles to Supabase | Status: ${response.status}`
    );
    res.status(200).json({ status: "ok", inserted: formatted.length });
  } catch (error) {
    console.error("❌ Proxy Error:", error.message);
    res
      .status(500)
      .json({ error: error.message || "Internal proxy server error" });
  }
});

export default app;