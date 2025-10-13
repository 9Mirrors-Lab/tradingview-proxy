import express from "express";
import axios from "axios";

const app = express();

// ⚠️ Do NOT use express.json() — Vercel parses JSON automatically
// But add a fallback for cases where automatic parsing fails
app.use((req, res, next) => {
  // If body is undefined and we have content-type application/json, try manual parsing
  if (req.body === undefined && req.headers['content-type']?.includes('application/json')) {
    console.log("🔹 Fallback: Attempting manual JSON parsing");
    let data = '';
    req.on('data', chunk => {
      data += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = JSON.parse(data);
        console.log("🔹 Fallback: Manual parsing successful");
        next();
      } catch (error) {
        console.error("🔹 Fallback: Manual parsing failed:", error.message);
        next();
      }
    });
  } else {
    next();
  }
});

app.post("/proxy-candlestick", async (req, res) => {
  try {
    // 🔍 Enhanced debugging for body parsing issues
    console.log("🔹 === BODY PARSING DEBUG START ===");
    console.log("🔹 Request method:", req.method);
    console.log("🔹 Request headers:", JSON.stringify(req.headers, null, 2));
    console.log("🔹 Raw req.body type:", typeof req.body);
    console.log("🔹 Raw req.body is null:", req.body === null);
    console.log("🔹 Raw req.body is undefined:", req.body === undefined);
    console.log("🔹 Raw req.body keys:", req.body ? Object.keys(req.body) : 'no body');
    console.log("🔹 Raw req.body value:", JSON.stringify(req.body, null, 2));
    
    // Safety check: Ensure body exists
    if (req.body === undefined || req.body === null) {
      console.error("❌ CRITICAL: req.body is undefined/null");
      return res.status(400).json({ 
        error: "Request body is undefined or null",
        code: "BODY_UNDEFINED",
        debug: {
          bodyType: typeof req.body,
          bodyIsNull: req.body === null,
          bodyIsUndefined: req.body === undefined,
          headers: req.headers
        }
      });
    }
    
    // Handle array-wrapped payloads from TradingView or n8n
    const incoming = Array.isArray(req.body) ? req.body[0] : req.body;
    console.log("🔹 Incoming type:", typeof incoming);
    console.log("🔹 Incoming keys:", incoming ? Object.keys(incoming) : 'no incoming');
    console.log("🔹 Incoming value:", JSON.stringify(incoming, null, 2));
    
    // Safety check: Ensure incoming data exists
    if (!incoming) {
      console.error("❌ CRITICAL: incoming data is falsy");
      return res.status(400).json({ 
        error: "No valid incoming data found",
        code: "INCOMING_UNDEFINED",
        debug: {
          originalBody: req.body,
          incomingData: incoming
        }
      });
    }
    
    const body = incoming?.body || incoming; // unwrap nested "body" if present
    console.log("🔹 Final body type:", typeof body);
    console.log("🔹 Final body keys:", body ? Object.keys(body) : 'no body');
    console.log("🔹 Final body value:", JSON.stringify(body, null, 2));
    console.log("🔹 === BODY PARSING DEBUG END ===");

    // Safety check: Ensure final body exists and has required fields
    if (!body) {
      console.error("❌ CRITICAL: Final body is falsy");
      return res.status(400).json({ 
        error: "No valid body found in request",
        code: "BODY_FALSY",
        debug: {
          originalBody: req.body,
          incomingData: incoming,
          finalBody: body
        }
      });
    }

    // Safety check: Ensure body has symbol field
    if (!body.symbol) {
      console.error("❌ CRITICAL: Body missing symbol field");
      return res.status(400).json({ 
        error: "Missing required 'symbol' field in body",
        code: "MISSING_SYMBOL",
        debug: {
          bodyKeys: Object.keys(body),
          bodyValue: body
        }
      });
    }

    const symbol = body.symbol || "UNKNOWN";
    const timeframe = body.interval || "unknown";
    const bars = Array.isArray(body.bars) ? body.bars : [];

    console.log(
      `📊 Processing ${bars.length} candles for ${symbol} ${timeframe}`
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
        candle_time, // ✅ ISO 8601 UTC timestamp (for Supabase trigger)
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

    // 🚀 Send formatted candles to Supabase Edge Function
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