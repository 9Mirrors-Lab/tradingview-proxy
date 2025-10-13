// Test script to verify body parsing fixes
import axios from 'axios';

const testData = {
  symbol: "BTCUSDT",
  interval: "1h",
  bars: [
    {
      time: 1640995200,
      open: 47000,
      high: 47500,
      low: 46800,
      close: 47200,
      volume: 1000
    }
  ]
};

async function testDeployedEndpoint() {
  console.log("\n🌐 Testing deployed Vercel endpoint...");
  
  // You'll need to replace this with your actual Vercel URL
  const deployedUrl = "https://tradingview-proxy-h0tuci42v-ryan-s-projects-311c1e92.vercel.app/api/proxy-candlestick";
  
  try {
    const response = await axios.post(
      deployedUrl,
      testData,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    
    console.log("✅ Deployed endpoint test passed:", response.data);
  } catch (error) {
    console.error("❌ Deployed endpoint test failed:", error.response?.data || error.message);
    if (error.response?.data) {
      console.log("   → Response status:", error.response.status);
      console.log("   → Response headers:", error.response.headers);
    }
  }
}

async function testBodyParsing() {
  console.log("🧪 Testing body parsing with direct payload...");
  
  try {
    const response = await axios.post(
      "http://localhost:3000/api/proxy-candlestick",
      testData,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Direct payload test passed:", response.data);
  } catch (error) {
    console.error("❌ Direct payload test failed:", error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log("   → No local server running. Testing against deployed endpoint...");
      await testDeployedEndpoint();
    }
  }
  
  console.log("\n🧪 Testing body parsing with array-wrapped payload...");
  
  try {
    const response = await axios.post(
      "http://localhost:3000/api/proxy-candlestick",
      [testData],
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Array-wrapped test passed:", response.data);
  } catch (error) {
    console.error("❌ Array-wrapped test failed:", error.response?.data || error.message);
  }
  
  console.log("\n🧪 Testing body parsing with nested body payload...");
  
  try {
    const response = await axios.post(
      "http://localhost:3000/api/proxy-candlestick",
      [{ body: testData }],
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Nested body test passed:", response.data);
  } catch (error) {
    console.error("❌ Nested body test failed:", error.response?.data || error.message);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBodyParsing();
}

export { testBodyParsing };
