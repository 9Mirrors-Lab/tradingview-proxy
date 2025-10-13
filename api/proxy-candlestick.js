import express from "express";
import axios from "axios";

const app = express();

// ⚠️ Do NOT use express.json() — Vercel parses JSON automatically

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
     // 🔍 Comprehensive debugging and safety checks
     console.log("🔹 Raw req.body type:", typeof req.body);
     console.log("🔹 Raw req.body keys:", req.body ? Object.keys(req.body) : 'no body');
     console.log("🔹 Content-Type:", req.headers['content-type']);
     console.log("🔹 Content-Length:", req.headers['content-length']);
     
     // Safety check: ensure we have a body
     if (!req.body) {
       console.error("❌ No request body received");
       return res.status(400).json({ 
         error: "No request body received",
         code: "NO_BODY",
         headers: req.headers
       });
     }
     
     const incoming = Array.isArray(req.body) ? req.body[0] : req.body;
     console.log("🔹 Incoming type:", typeof incoming);
     console.log("🔹 Incoming keys:", incoming ? Object.keys(incoming) : 'no incoming');
     
     const body = incoming?.body || incoming; // unwrap nested "body" if present
     console.log("🔹 Final body keys:", body ? Object.keys(body) : 'no body');

     if (!body) {
       console.error("❌ No valid body found after processing");
       return res.status(400).json({ 
         error: "No valid body found in request",
         code: "INVALID_BODY",
         received: req.body
       });
     }

    // Extract and validate required fields
    const symbol = body.symbol;
    const timeframe = body.interval;
    const bars = Array.isArray(body.bars) ? body.bars : [];

    // Safety checks for required fields
    if (!symbol) {
      console.error("❌ No symbol found in body:", body);
      return res.status(400).json({ 
        error: "Missing required field: symbol",
        code: "MISSING_SYMBOL",
        body: body
      });
    }

    if (!timeframe) {
      console.error("❌ No interval/timeframe found in body:", body);
      return res.status(400).json({ 
        error: "Missing required field: interval",
        code: "MISSING_INTERVAL",
        body: body
      });
    }

    if (!bars || bars.length === 0) {
      console.error("❌ No bars data found in body:", body);
      return res.status(400).json({ 
        error: "Missing or empty bars array",
        code: "MISSING_BARS",
        body: body
      });
    }

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
    console.error("❌ Error Stack:", error.stack);
    console.error("❌ Request Body:", req.body);
    
    res.status(500).json({ 
      error: error.message || "Internal proxy server error",
      code: "PROXY_ERROR",
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default app;