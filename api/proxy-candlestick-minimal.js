// api/proxy-candlestick-minimal.js - Minimal test version
import express from "express";
import serverless from "serverless-http";

const app = express();

// Minimal body parsing
app.use(express.json({ limit: "4.5mb" }));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    console.log("🔹 Minimal test - Request received");
    console.log("🔹 Body type:", typeof req.body);
    console.log("🔹 Body length:", req.body ? JSON.stringify(req.body).length : 0);
    
    return res.status(200).json({ 
      success: true, 
      message: "Minimal proxy working",
      received: {
        bodyType: typeof req.body,
        bodyLength: req.body ? JSON.stringify(req.body).length : 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("❌ Minimal test error:", error.message);
    return res.status(500).json({ 
      error: error.message,
      type: error.name
    });
  }
});

export default serverless(app);
