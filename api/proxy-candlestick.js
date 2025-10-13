// api/proxy-candlestick.js - Simplified TradingView proxy

import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Simplified body parsing - use JSON instead of raw
app.use(express.json({ 
  limit: "4.5mb",
  type: "application/json"
}));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    console.log("🔹 Simplified proxy - Request received");
    console.log("🔹 Body type:", typeof req.body);
    console.log("🔹 Body keys:", req.body ? Object.keys(req.body) : 'no body');

    // Check if body exists
    if (!req.body) {
      return res.status(400).json({ 
        error: "No request body",
        code: "NO_BODY" 
      });
    }

    // Handle TradingView's array-wrapped format
    let candlestickData;
    if (Array.isArray(req.body) && req.body.length > 0) {
      // TradingView wraps the data in an array
      const webhookItem = req.body[0];
      candlestickData = webhookItem.body;
      
      console.log("🔹 Extracted from array format:", {
        symbol: candlestickData?.symbol,
        interval: candlestickData?.interval,
        barsCount: candlestickData?.bars?.length || 0
      });
    } else {
      // Direct payload format
      candlestickData = req.body;
      console.log("🔹 Direct payload format:", {
        symbol: candlestickData?.symbol,
        interval: candlestickData?.interval,
        barsCount: candlestickData?.bars?.length || 0
      });
    }

    // Validate candlestick data
    if (!candlestickData || !candlestickData.symbol) {
      return res.status(400).json({ 
        error: "Invalid candlestick data",
        code: "INVALID_DATA",
        received: req.body
      });
    }

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: "Proxy working - simplified version",
      processed: {
        symbol: candlestickData.symbol,
        interval: candlestickData.interval,
        barsCount: candlestickData.bars?.length || 0
      },
      debug: {
        payloadSize: JSON.stringify(candlestickData).length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Simplified proxy error:", error.message);
    return res.status(500).json({ 
      error: error.message,
      type: error.name
    });
  }
});

// Health check endpoint for monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

export default serverless(app);