// api/proxy-candlestick.js - Vercel-Optimized Version

export const config = {
  runtime: 'nodejs20.x',
  maxDuration: 10,
};

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    console.log("🔹 Function started at:", new Date().toISOString());
    console.log("🔹 Method:", req.method);
    console.log("🔹 Headers:", Object.keys(req.headers));

    // Health check
    if (req.method === 'GET') {
      return res.status(200).json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        config: config
      });
    }

    // Handle POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Check environment variables
    if (!process.env.SUPABASE_ANON_KEY) {
      throw new Error("SUPABASE_ANON_KEY environment variable is missing");
    }

    // Parse body
    let payload;
    try {
      payload = JSON.parse(req.body);
    } catch (parseError) {
      console.warn("⚠️ JSON parse failed:", parseError.message);
      throw new Error(`Invalid JSON: ${parseError.message}`);
    }

    // Handle TradingView array format
    if (Array.isArray(payload) && payload.length > 0) {
      payload = payload[0].body || payload[0];
    }

    console.log("🔹 Payload:", JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.symbol || !payload.interval || !payload.bars) {
      throw new Error("Missing required fields: symbol, interval, or bars");
    }

    // Forward to Supabase - CORRECT ENDPOINT
    const supabaseUrl = "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candlestick-webhook";
    
    const response = await fetch(supabaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} - ${responseData.error || 'Unknown error'}`);
    }

    console.log("✅ Success:", responseData);
    console.log("✅ Duration:", duration + "ms");

    return res.status(200).json({ 
      success: true, 
      data: responseData,
      duration: duration + "ms"
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("❌ Error:", error.message);
    console.error("❌ Duration:", duration + "ms");
    
    return res.status(500).json({ 
      error: error.message,
      duration: duration + "ms"
    });
  }
}
