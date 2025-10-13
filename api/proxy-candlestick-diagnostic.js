// api/proxy-candlestick-diagnostic.js - Diagnostic version based on Supabase webhook patterns
import express from "express";
import serverless from "serverless-http";

const app = express();

// Minimal middleware - no body parsing to avoid any parsing issues
app.use((req, res, next) => {
  console.log(`🔹 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`🔹 Headers:`, Object.keys(req.headers));
  next();
});

app.post("/proxy-candlestick", async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log("🔹 Diagnostic proxy started");
    
    // Return immediately without processing body
    const response = {
      success: true,
      message: "Diagnostic proxy working",
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      headers: req.headers,
      method: req.method,
      url: req.url
    };
    
    console.log("🔹 Sending response:", response);
    return res.status(200).json(response);
    
  } catch (error) {
    console.error("❌ Diagnostic error:", error.message);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "diagnostic"
  });
});

export default serverless(app);
