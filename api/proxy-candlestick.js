// api/proxy-candlestick.js - Vercel-optimized TradingView proxy

import express from "express";
import axios from "axios";
import serverless from "serverless-http";

const app = express();

// Vercel best practice: Use express.raw() with proper error handling
app.use(express.raw({ 
  type: "*/*", 
  limit: "4.5mb", // Vercel's maximum request body size
  verify: (req, res, buf, encoding) => {
    // Custom verification to handle Content-Length mismatches
    const contentLength = req.headers['content-length'];
    if (contentLength && buf.length !== parseInt(contentLength)) {
      console.warn(`⚠️ Content-Length mismatch: header=${contentLength}, actual=${buf.length}`);
      // Don't throw error, just log the mismatch
    }
  }
}));

app.post("/proxy-candlestick", async (req, res) => {
  try {
    // Vercel best practice: Check if body exists before processing
    if (!req.body || req.body.length === 0) {
      console.error("❌ Empty request body");
      return res.status(400).json({ 
        error: "Empty request body",
        code: "EMPTY_BODY" 
      });
    }

    console.log("🔹 Request Headers:", JSON.stringify(req.headers, null, 2));
    console.log("🔹 Content-Length:", req.headers['content-length']);
    console.log("🔹 Actual Body Length:", req.body?.length || 0);

    // Convert buffer to string safely
    let rawBody;
    try {
      rawBody = req.body.toString('utf8');
    } catch (encodingError) {
      console.error("❌ Body encoding error:", encodingError.message);
      return res.status(400).json({ 
        error: "Invalid body encoding",
        code: "ENCODING_ERROR",
        details: encodingError.message 
      });
    }

    console.log("🔹 Raw Body Length:", rawBody.length);
    console.log("🔹 Raw Body Preview:", rawBody.substring(0, 300) + (rawBody.length > 300 ? "..." : ""));

    // Parse JSON with comprehensive error handling
    let webhookPayload;
    try {
      webhookPayload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError.message);
      console.error("❌ Raw body that failed to parse:", rawBody.substring(0, 500));
      return res.status(400).json({ 
        error: "Invalid JSON payload", 
        code: "INVALID_JSON",
        details: parseError.message,
        bodyPreview: rawBody.substring(0, 200)
      });
    }

    console.log("🔹 Webhook Payload Structure:", {
      isArray: Array.isArray(webhookPayload),
      length: Array.isArray(webhookPayload) ? webhookPayload.length : 'N/A',
      hasBody: Array.isArray(webhookPayload) && webhookPayload[0] ? 'body' in webhookPayload[0] : 'N/A'
    });

    // Extract candlestick data with validation
    let candlestickData;
    if (Array.isArray(webhookPayload) && webhookPayload.length > 0) {
      const webhookItem = webhookPayload[0];
      
      // Validate webhook structure
      if (!webhookItem.body) {
        console.error("❌ Missing body in webhook payload");
        return res.status(400).json({ 
          error: "Missing body in webhook payload",
          code: "MISSING_BODY"
        });
      }
      
      candlestickData = webhookItem.body;
      
      console.log("🔹 Extracted Candlestick Data:", {
        symbol: candlestickData?.symbol,
        interval: candlestickData?.interval,
        barsCount: candlestickData?.bars?.length || 0,
        webhookUrl: webhookItem.webhookUrl,
        executionMode: webhookItem.executionMode
      });
    } else {
      // Fallback for direct payload format
      candlestickData = webhookPayload;
    }

    // Validate candlestick data structure
    if (!candlestickData || !candlestickData.symbol) {
      console.error("❌ Invalid candlestick data structure");
      return res.status(400).json({ 
        error: "Invalid candlestick data structure",
        code: "INVALID_CANDLESTICK_DATA",
        received: {
          hasSymbol: !!candlestickData?.symbol,
          hasBars: !!candlestickData?.bars,
          barsCount: candlestickData?.bars?.length || 0
        }
      });
    }

    console.log("🔹 Final Payload Size:", JSON.stringify(candlestickData).length, "bytes");

    // TEMPORARY: Bypass Supabase for testing
    console.log("🔹 Bypassing Supabase call for testing");
    return res.status(200).json({ 
      success: true, 
      data: { message: "Proxy working - Supabase call bypassed for testing" },
      processed: {
        symbol: candlestickData.symbol,
        interval: candlestickData.interval,
        barsCount: candlestickData.bars?.length || 0
      },
      debug: {
        payloadSize: JSON.stringify(candlestickData).length,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        timestamp: new Date().toISOString()
      }
    });

    // Forward to Supabase with enhanced error handling (DISABLED FOR TESTING)
    /*
    try {
      const response = await axios.post(
        "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook",
        candlestickData,
        {
          headers: {
            Authorization: "Bearer " + process.env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          timeout: 15000, // Increased timeout for large payloads
          maxContentLength: 50 * 1024 * 1024, // 50MB max response
        }
      );

      console.log("✅ Supabase Response:", response.data);
      return res.status(200).json({ 
        success: true, 
        data: response.data,
        processed: {
          symbol: candlestickData.symbol,
          interval: candlestickData.interval,
          barsCount: candlestickData.bars?.length || 0
        }
      });
    } catch (supabaseError) {
      console.error("❌ Supabase Error:", supabaseError.message);
      console.error("❌ Supabase Response:", supabaseError.response?.data);
      
      return res.status(502).json({ 
        error: "Supabase service error",
        code: "SUPABASE_ERROR",
        details: supabaseError.message,
        supabaseResponse: supabaseError.response?.data
      });
    }
    */

  } catch (error) {
    console.error("❌ Unexpected Proxy Error:", error.message);
    console.error("❌ Error Stack:", error.stack);
    
    return res.status(500).json({ 
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      details: error.message,
      type: error.name
    });
  }
});

// Health check endpoint for monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

export default serverless(app);