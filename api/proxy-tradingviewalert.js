// api/proxy-tradingviewalert.js - Same handler as tradingview-alert.js (TradingView → Supabase tradingview_alerts).
// POST https://<project>.vercel.app/api/proxy-tradingviewalert

export { config, default } from "./tradingview-alert.js";
