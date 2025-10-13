import express from "express";
import axios from "axios";

const app = express();

// ⚠️ Do NOT use express.json() — Vercel parses JSON automatically

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
     // 🔍 Handle array-wrapped payloads from TradingView or n8n
     console.log("🔹 Raw req.body type:", typeof req.body);
     console.log("🔹 Raw req.body keys:", req.body ? Object.keys(req.body) : 'no body');
     
     const incoming = Array.isArray(req.body) ? req.body[0] : req.body;
     console.log("🔹 Incoming type:", typeof incoming);
     console.log("🔹 Incoming keys:", incoming ? Object.keys(incoming) : 'no incoming');
     
     const body = incoming?.body || incoming; // unwrap nested "body" if present
     console.log("🔹 Final body keys:", body ? Object.keys(body) : 'no body');

     if (!body) {
       throw new Error("No valid body found in request");
     }

    const symbol = body.symbol;
    const timeframe = body.interval || "unknown";
    const bars = Array.isArray(body.bars) ? body.bars : [];

    // Safety check for required symbol field
    if (!symbol) {
      console.error("❌ No symbol found in body:", body);
      return res.status(400).json({ 
        error: "Missing required field: symbol",
        code: "MISSING_SYMBOL",
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
    res
      .status(500)
      .json({ error: error.message || "Internal proxy server error" });
  }
});

export default app;