#!/bin/bash

echo "🧪 Testing TradingView Proxy Endpoint"
echo "======================================"

# Test with a simple payload
echo "📤 Sending test payload..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","interval":"1h","bars":[{"time":1640995200,"open":47000,"high":47500,"low":46800,"close":47200,"volume":1000}]}' \
  https://tradingview-proxy-h0tuci42v-ryan-s-projects-311c1e92.vercel.app/api/proxy-candlestick \
  -w "\n\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -v

echo ""
echo "======================================"
echo "Test completed"
