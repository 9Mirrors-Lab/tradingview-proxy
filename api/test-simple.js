import express from "express";

const app = express();

app.post("/api/test-simple", async (req, res) => {
  try {
    console.log("🔹 Test endpoint called");
    console.log("🔹 Body type:", typeof req.body);
    console.log("🔹 Body:", req.body);
    
    res.status(200).json({ 
      success: true, 
      message: "Test endpoint working",
      body: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Test Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default app;
