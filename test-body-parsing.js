// Test script to verify body parsing fixes
const axios = require('axios');

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
    console.error("❌ Direct payload test failed:", error.response?.data || error.message);
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
if (require.main === module) {
  testBodyParsing();
}

module.exports = { testBodyParsing };
