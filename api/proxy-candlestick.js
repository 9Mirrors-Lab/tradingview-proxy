// api/proxy-candlestick.js - Final robust TradingView proxy
import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Robust body parsing with multiple content types
app.use(express.json({ 
  limit: "4.5mb",
  type: ["application/json", "text/plain", "*/*"]
}));

app.post("/proxy-candlestick", async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log("🔹 Proxy started at:", new Date().toISOString());
    console.log("🔹 Request method:", req.method);
    console.log("🔹 Content-Type:", req.headers['content-type']);
    console.log("🔹 Content-Length:", req.headers['content-length']);

    // Handle empty body
    if (!req.body) {
      console.log("🔹 No request body received");
      return res.status(400).json({ 
        error: "No request body",
        code: "NO_BODY",
        timestamp: new Date().toISOString()
      });
    }

    console.log("🔹 Body type:", typeof req.body);
    console.log("🔹 Body keys:", Object.keys(req.body));

    // Extract candlestick data from various formats
    let candlestickData = null;
    
    // Format 1: Supabase webhook format (from documentation)
    if (req.body.type && req.body.record) {
      console.log("🔹 Supabase webhook format detected");
      candlestickData = req.body.record;
    }
    // Format 2: TradingView array format
    else if (Array.isArray(req.body) && req.body.length > 0) {
      console.log("🔹 TradingView array format detected");
      const webhookItem = req.body[0];
      if (webhookItem.body) {
        candlestickData = webhookItem.body;
      } else {
        candlestickData = webhookItem;
      }
    }
    // Format 3: Direct candlestick data
    else if (req.body.symbol) {
      console.log("🔹 Direct candlestick data detected");
      candlestickData = req.body;
    }
    // Format 4: Fallback - use raw body
    else {
      console.log("🔹 Fallback format - using raw body");
      candlestickData = req.body;
    }

    // Validate candlestick data
    if (!candlestickData || !candlestickData.symbol) {
      console.log("🔹 Invalid candlestick data structure");
      return res.status(400).json({ 
        error: "Invalid candlestick data",
        code: "INVALID_DATA",
        received: {
          hasSymbol: !!candlestickData?.symbol,
          hasBars: !!candlestickData?.bars,
          dataType: typeof candlestickData
        },
        timestamp: new Date().toISOString()
      });
    }

    console.log("🔹 Valid candlestick data:", {
      symbol: candlestickData.symbol,
      interval: candlestickData.interval,
      barsCount: candlestickData.bars?.length || 0
    });

    // Forward to Supabase Edge Function
    try {
      console.log("🔹 Forwarding to Supabase...");
      const response = await axios.post(
        "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candles_fractal_metadatav2",
        candlestickData,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 8000, // 8 second timeout
        }
      );

      const processingTime = Date.now() - startTime;
      console.log("✅ Supabase response received in", processingTime, "ms");
      
      return res.status(200).json({ 
        success: true, 
        data: response.data,
        processed: {
          symbol: candlestickData.symbol,
          interval: candlestickData.interval,
          barsCount: candlestickData.bars?.length || 0
        },
        timing: {
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (supabaseError) {
      const processingTime = Date.now() - startTime;
      console.error("❌ Supabase error after", processingTime, "ms:", supabaseError.message);
      
      return res.status(502).json({ 
        error: "Supabase service error",
        code: "SUPABASE_ERROR",
        details: supabaseError.message,
        timing: {
          processingTime: processingTime,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("❌ Proxy error after", processingTime, "ms:", error.message);
    
    return res.status(500).json({ 
      error: error.message,
      type: error.name,
      timing: {
        processingTime: processingTime,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "2.0.1",
    uptime: process.uptime()
  });
});

export default serverless(app);