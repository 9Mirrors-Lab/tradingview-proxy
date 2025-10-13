// api/proxy-candlestick-v2.js - Alternative approach for Content-Length issues

import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Skip body parsing entirely and handle it manually
app.use((req, res, next) => {
  // Set a custom property to bypass body parsing
  req._skipBodyParsing = true;
  next();
});

app.post("/proxy-candlestick", async (req, res) => {
  try {
    console.log("🔹 Request Headers:", JSON.stringify(req.headers, null, 2));
    
    // Manually read the raw body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        console.log("🔹 Content-Length Header:", req.headers['content-length']);
        console.log("🔹 Actual Body Length:", body.length);
        console.log("🔹 Raw Body:", body.substring(0, 200) + (body.length > 200 ? "..." : ""));

        // TradingView sometimes sends stringified JSON
        let payload;
        try {
          payload = JSON.parse(body);
        } catch (parseError) {
          console.warn("⚠️ Payload not JSON, using raw body:", parseError.message);
          payload = body;
        }

        // Handle TradingView's array-wrapped format
        if (Array.isArray(payload) && payload.length > 0) {
          payload = payload[0].body || payload[0];
        }

        console.log("🔹 Normalized Payload:", JSON.stringify(payload, null, 2));

        // Forward to Supabase
        const response = await axios.post(
          "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
          payload,
          {
            headers: {
              Authorization: "Bearer " + process.env.SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          }
        );

        console.log("✅ Supabase Response:", response.data);
        res.status(200).json({ success: true, data: response.data });
      } catch (error) {
        console.error("❌ Proxy Error:", error.message);
        console.error("❌ Error Stack:", error.stack);
        res.status(500).json({ error: error.message });
      }
    });
    
  } catch (error) {
    console.error("❌ Request Setup Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default serverless(app);
