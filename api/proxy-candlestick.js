// api/proxy-candlestick.js

import express from "express";
import axios from "axios";
import serverless from "serverless-http";
import bodyParser from "body-parser";

const app = express();

// ---- FIX: More tolerant parsing ----
app.use(bodyParser.text({ type: "*/*", limit: "2mb" }));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    // TradingView sometimes sends stringified JSON
    let payload;
    try {
      payload = JSON.parse(req.body);
    } catch {
      console.warn("⚠️ Payload not JSON, using raw body");
      payload = req.body;
    }

    // Handle TradingView’s array-wrapped format
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
    res.status(500).json({ error: error.message });
  }
});

export default serverless(app);