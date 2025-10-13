import express from "express";
import axios from "axios";
import serverless from "serverless-http";

// Initialize Express
const app = express();
app.use(express.json());

// Define route (same as your local version)
app.post("/proxy-candlestick", async (req, res) => {
  try {
    const response = await axios.post(
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
      req.body,
      {
        headers: {
          Authorization: "Bearer " + process.env.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Proxy error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Export Express app as serverless handler
export default serverless(app);