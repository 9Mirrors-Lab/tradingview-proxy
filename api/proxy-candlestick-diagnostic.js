// api/proxy-candlestick-diagnostic.js - Enhanced debugging version
import express from "express";
import axios from "axios";

const app = express();

// Enable JSON parsing with safety limits
app.use(express.json({ 
  limit: "4.5mb",
  type: "application/json"
}));

app.post("/api/proxy-candlestick-diagnostic", async (req, res) => {
  try {
    // 🔍 Comprehensive request analysis
    const diagnostic = {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      method: req.method,
      url: req.url,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'no body',
      bodyLength: req.body ? JSON.stringify(req.body).length : 0,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent'],
      rawBody: req.body
    };

    console.log("🔍 DIAGNOSTIC REPORT:", JSON.stringify(diagnostic, null, 2));

    // Safety check: ensure we have a body
    if (!req.body) {
      return res.status(400).json({ 
        error: "No request body received",
        code: "NO_BODY",
        diagnostic: diagnostic
      });
    }

    // Handle different payload formats
    let processedData = null;
    let processingSteps = [];

    // Step 1: Check if it's an array
    if (Array.isArray(req.body)) {
      processingSteps.push("Array format detected");
      if (req.body.length > 0) {
        processingSteps.push(`Array has ${req.body.length} items`);
        processedData = req.body[0];
        processingSteps.push("Using first array item");
      } else {
        processingSteps.push("Array is empty");
      }
    } else {
      processingSteps.push("Non-array format detected");
      processedData = req.body;
    }

    // Step 2: Check for nested body
    if (processedData && processedData.body) {
      processingSteps.push("Nested body found, unwrapping");
      processedData = processedData.body;
    }

    // Step 3: Validate required fields
    const validation = {
      hasSymbol: !!processedData?.symbol,
      hasInterval: !!processedData?.interval,
      hasBars: !!processedData?.bars,
      barsIsArray: Array.isArray(processedData?.bars),
      barsLength: processedData?.bars?.length || 0
    };

    processingSteps.push("Validation results: " + JSON.stringify(validation));

    // Return diagnostic information
    res.status(200).json({
      success: true,
      diagnostic: {
        ...diagnostic,
        processingSteps,
        validation,
        processedData: processedData ? {
          symbol: processedData.symbol,
          interval: processedData.interval,
          barsCount: processedData.bars?.length || 0,
          sampleBar: processedData.bars?.[0] || null
        } : null
      }
    });

  } catch (error) {
    console.error("❌ Diagnostic Error:", error.message);
    console.error("❌ Error Stack:", error.stack);
    
    res.status(500).json({ 
      error: error.message,
      code: "DIAGNOSTIC_ERROR",
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default app;