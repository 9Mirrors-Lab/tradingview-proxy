// api/proxy-candlestick.js

import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Disable body parsing middleware to handle raw body manually
app.use(express.raw({ type: "*/*", limit: "2mb" }));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    console.log("🔹 Request Headers:", JSON.stringify(req.headers, null, 2));
    console.log("🔹 Content-Length:", req.headers['content-length']);
    console.log("🔹 Actual Body Length:", req.body?.length || 0);

    // Get raw body as string
    const rawBody = req.body.toString('utf8');
    console.log("🔹 Raw Body Length:", rawBody.length);
    console.log("🔹 Raw Body Preview:", rawBody.substring(0, 300) + (rawBody.length > 300 ? "..." : ""));

    // Parse the JSON payload
    let webhookPayload;
    try {
      webhookPayload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError.message);
      return res.status(400).json({ error: "Invalid JSON payload", details: parseError.message });
    }

    console.log("🔹 Webhook Payload Structure:", {
      isArray: Array.isArray(webhookPayload),
      length: Array.isArray(webhookPayload) ? webhookPayload.length : 'N/A',
      hasBody: Array.isArray(webhookPayload) && webhookPayload[0] ? 'body' in webhookPayload[0] : 'N/A'
    });

    // Extract the actual candlestick data from TradingView's format
    let candlestickData;
    if (Array.isArray(webhookPayload) && webhookPayload.length > 0) {
      // TradingView wraps the data in an array with headers, body, etc.
      const webhookItem = webhookPayload[0];
      candlestickData = webhookItem.body;
      
      console.log("🔹 Extracted Candlestick Data:", {
        symbol: candlestickData?.symbol,
        interval: candlestickData?.interval,
        barsCount: candlestickData?.bars?.length || 0,
        webhookUrl: webhookItem.webhookUrl,
        executionMode: webhookItem.executionMode
      });
    } else {
      // Fallback for direct payload format
      candlestickData = webhookPayload;
    }

    if (!candlestickData) {
      console.error("❌ No candlestick data found in payload");
      return res.status(400).json({ error: "No candlestick data found in payload" });
    }

    console.log("🔹 Final Payload Size:", JSON.stringify(candlestickData).length, "bytes");

    // Forward to Supabase
    const response = await axios.post(
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
      candlestickData,
      {
        headers: {
          Authorization: "Bearer " + process.env.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000, // Increased timeout for large payloads
      }
    );

    console.log("✅ Supabase Response:", response.data);
    res.status(200).json({ 
      success: true, 
      data: response.data,
      processed: {
        symbol: candlestickData.symbol,
        interval: candlestickData.interval,
        barsCount: candlestickData.bars?.length || 0
      }
    });
  } catch (error) {
    console.error("❌ Proxy Error:", error.message);
    console.error("❌ Error Stack:", error.stack);
    
    // More detailed error response
    res.status(500).json({ 
      error: error.message,
      type: error.name,
      ...(error.response && {
        supabaseError: {
          status: error.response.status,
          data: error.response.data
        }
      })
    });
  }
});

export default serverless(app);