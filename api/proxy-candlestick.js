import express from "express";
import axios from "axios";

const app = express();

// ❌ Remove express.json()
// Vercel automatically parses JSON bodies in serverless functions,
// so we skip double-parsing to avoid “request size did not match content length”.

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
     console.log("🔹 Request received");
     console.log("🔹 Body type:", typeof req.body);
     console.log("🔹 Body keys:", req.body ? Object.keys(req.body) : 'no body');
     
     // ✅ Ensure we can handle both stringified and parsed bodies safely
     let body;
     if (req.body === undefined || req.body === null) {
       throw new Error("No request body received");
     } else if (typeof req.body === "string") {
       body = JSON.parse(req.body);
     } else if (typeof req.body === "object") {
       body = req.body;
     } else {
       throw new Error(`Invalid body type: ${typeof req.body}`);
     }

    const candles = Array.isArray(body.candles)
      ? body.candles
      : Array.isArray(body.bars)
      ? body.bars
      : [body];

    const formatted = candles.map((bar) => {
      const timeVal = Number(bar.time);
      const candle_time =
        timeVal < 1e12
          ? new Date(timeVal * 1000).toISOString()
          : new Date(timeVal).toISOString();

      return {
        symbol: body.symbol || "UNKNOWN",
        timeframe: body.interval || "unknown",
        candle_time,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume ?? 0),
        _processed_at: new Date().toISOString(),
      };
    });

    // ✅ Forward to Supabase Edge Function
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
      `✅ Forwarded ${formatted.length} candles → Supabase | status: ${response.status}`
    );
    res.status(200).json({ status: "ok", inserted: formatted.length });
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res
      .status(500)
      .json({ error: error.message || "Internal proxy server error" });
  }
});

// Required for Vercel
export default app;