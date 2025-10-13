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
    console.log("🔹 Raw Body:", rawBody.substring(0, 200) + (rawBody.length > 200 ? "..." : ""));

    // TradingView sometimes sends stringified JSON
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.warn("⚠️ Payload not JSON, using raw body:", parseError.message);
      payload = rawBody;
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

export default serverless(app);