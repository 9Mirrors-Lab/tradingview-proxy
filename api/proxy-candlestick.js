import express from "express";
import axios from "axios";

const app = express();

// ⚠️ Do NOT use express.json() — Vercel parses JSON automatically

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
    // 🔍 Handle array-wrapped payloads from TradingView or n8n
    const incoming = Array.isArray(req.body) ? req.body[0] : req.body;
    const body = incoming.body || incoming; // unwrap nested "body" if present

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
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
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