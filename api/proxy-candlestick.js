import express from "express";
import axios from "axios";
import serverless from "serverless-http";
import bodyParser from "body-parser";

const app = express();

// --- Vercel-safe body parser ---
app.use(bodyParser.json({ limit: "1mb", strict: false }));
app.use(bodyParser.text({ type: "*/*" }));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    let payload = req.body;

    // Handle stringified JSON (TradingView sometimes wraps it)
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        console.warn("⚠️ Could not parse string payload as JSON. Using raw text.");
      }
    }

    // Handle TradingView’s outer array wrapper
    if (Array.isArray(payload) && payload.length > 0) {
      console.log("🔹 Detected TradingView webhook array format");
      payload = payload[0].body || payload[0];
    }

    console.log("🔹 Normalized Payload:", JSON.stringify(payload, null, 2));

    // Forward just the useful payload to Supabase
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
    res.status(200).json(response.data);
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default serverless(app);