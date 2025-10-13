// test-webhook.js - Test script to simulate TradingView webhook
import axios from 'axios';
import fs from 'fs';

// Read the example payload
const examplePayload = JSON.parse(fs.readFileSync('./1month_candle.json', 'utf8'));

async function testWebhook() {
  try {
    console.log('🧪 Testing TradingView webhook payload...');
    console.log('📊 Payload structure:', {
      isArray: Array.isArray(examplePayload),
      length: examplePayload.length,
      hasBody: 'body' in examplePayload[0],
      symbol: examplePayload[0].body.symbol,
      interval: examplePayload[0].body.interval,
      barsCount: examplePayload[0].body.bars.length
    });

    // Test with your proxy endpoint
    const response = await axios.post(
      'https://your-vercel-app.vercel.app/api/proxy-candlestick',
      examplePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TradingView-Webhook-Test/1.0'
        },
        timeout: 15000
      }
    );

    console.log('✅ Test successful:', response.data);
  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

// Run the test
testWebhook();
