import express from "express";
import axios from "axios";
import serverless from "serverless-http";
import bodyParser from "body-parser";

const app = express();

// --- Vercel-safe body parser setup ---
app.use(bodyParser.json({ limit: "1mb", strict: false }));
app.use(bodyParser.text({ type: "*/*" }));

// --- Main webhook route ---
app.post("/proxy-candlestick", async (req, res) => {
  try {
    // Handle TradingView stringified JSON safely
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        console.warn("⚠️ Could not parse string payload as JSON. Using raw text.");
      }
    }

    console.log("🔹 Incoming webhook payload:", payload);

    // Forward the payload to Supabase Edge Function
    const response = await axios.post(
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
      payload,
      {
        headers: {
          Authorization: "Bearer " + process.env.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000, // 5s timeout to prevent hanging
      }
    );

    console.log("✅ Supabase response:", response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error("❌ Proxy error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- Export Express app as Vercel serverless handler ---
export default serverless(app);