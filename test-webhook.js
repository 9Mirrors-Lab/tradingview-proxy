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

    // Calculate payload size
    const payloadString = JSON.stringify(examplePayload);
    console.log('📏 Payload size:', payloadString.length, 'bytes');

    // Test with your proxy endpoint (replace with your actual Vercel URL)
    const proxyUrl = process.env.PROXY_URL || 'https://your-vercel-app.vercel.app/api/proxy-candlestick';
    
    console.log('🚀 Sending request to:', proxyUrl);
    
    const response = await axios.post(
      proxyUrl,
      examplePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TradingView-Webhook-Test/1.0',
          'Content-Length': payloadString.length.toString()
        },
        timeout: 20000,
        maxContentLength: 50 * 1024 * 1024, // 50MB
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      }
    );

    console.log('✅ Test successful!');
    console.log('📊 Response:', {
      status: response.status,
      success: response.data.success,
      processed: response.data.processed,
      dataSize: JSON.stringify(response.data).length
    });
  } catch (error) {
    console.error('❌ Test failed:');
    console.error('📊 Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
    
    // If it's a Content-Length error, provide specific guidance
    if (error.message.includes('Content-Length') || error.message.includes('request size')) {
      console.log('\n💡 Content-Length troubleshooting tips:');
      console.log('1. Check if TradingView is sending compressed data');
      console.log('2. Verify the Content-Length header matches actual body size');
      console.log('3. Look for middleware that might modify the request');
      console.log('4. Check Vercel function logs for detailed error information');
    }
  }
}

// Test health endpoint first
async function testHealth() {
  try {
    const healthUrl = process.env.PROXY_URL?.replace('/proxy-candlestick', '/health') || 'https://your-vercel-app.vercel.app/api/health';
    console.log('🏥 Testing health endpoint:', healthUrl);
    
    const response = await axios.get(healthUrl, { timeout: 5000 });
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('🧪 Starting TradingView proxy tests...\n');
  
  const healthOk = await testHealth();
  if (healthOk) {
    console.log('\n📡 Testing webhook endpoint...\n');
    await testWebhook();
  } else {
    console.log('⚠️ Skipping webhook test due to health check failure');
  }
}

runTests();
