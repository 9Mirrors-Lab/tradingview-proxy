// api/proxy-candlestick-supabase.js - Supabase webhook compatible version
import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Use express.json() as recommended for Supabase webhooks
app.use(express.json({ 
  limit: "4.5mb",
  type: "application/json"
}));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    console.log("🔹 Supabase-compatible proxy started");
    console.log("🔹 Request body type:", typeof req.body);
    console.log("🔹 Request body keys:", req.body ? Object.keys(req.body) : 'no body');

    // Handle Supabase webhook format
    let candlestickData;
    
    if (req.body && typeof req.body === 'object') {
      // Check if it's a Supabase webhook format
      if (req.body.type && req.body.record) {
        console.log("🔹 Supabase webhook format detected:", req.body.type);
        candlestickData = req.body.record;
      }
      // Check if it's TradingView's array format
      else if (Array.isArray(req.body) && req.body.length > 0) {
        console.log("🔹 TradingView array format detected");
        candlestickData = req.body[0].body;
      }
      // Direct candlestick data
      else if (req.body.symbol) {
        console.log("🔹 Direct candlestick data detected");
        candlestickData = req.body;
      }
      else {
        console.log("🔹 Unknown format, using raw body");
        candlestickData = req.body;
      }
    }

    if (!candlestickData) {
      return res.status(400).json({ 
        error: "No valid candlestick data found",
        code: "NO_DATA",
        received: req.body
      });
    }

    console.log("🔹 Processed candlestick data:", {
      symbol: candlestickData.symbol,
      interval: candlestickData.interval,
      barsCount: candlestickData.bars?.length || 0
    });

    // Forward to Supabase Edge Function
    try {
      const response = await axios.post(
        "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
        candlestickData,
        {
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      console.log("✅ Supabase response received");
      return res.status(200).json({ 
        success: true, 
        data: response.data,
        processed: {
          symbol: candlestickData.symbol,
          interval: candlestickData.interval,
          barsCount: candlestickData.bars?.length || 0
        }
      });
    } catch (supabaseError) {
      console.error("❌ Supabase error:", supabaseError.message);
      return res.status(502).json({ 
        error: "Supabase service error",
        code: "SUPABASE_ERROR",
        details: supabaseError.message
      });
    }

  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    return res.status(500).json({ 
      error: error.message,
      type: error.name
    });
  }
});

export default serverless(app);
