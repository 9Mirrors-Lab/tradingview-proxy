import express from "express";
import axios from "axios";

const app = express();

// ❌ Do NOT call express.json() here — Vercel parses JSON automatically

app.post("/api/proxy-candlestick", async (req, res) => {
  try {
    // --------------------------
    // 🪵 DEBUG: Inspect raw body
    // --------------------------
    console.log("🔹 Method:", req.method);
    console.log("🔹 Raw req.body type:", typeof req.body);
    console.log(
      "🔹 Raw req.body keys:",
      req.body && typeof req.body === "object" ? Object.keys(req.body) : "no body"
    );

    // If req.body is undefined, read raw text stream manually
    let rawBody = req.body;
    if (!rawBody && req.method === "POST") {
      const text = await new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
      });
      try {
        rawBody = JSON.parse(text);
        console.log("✅ Parsed rawBody manually:", Object.keys(rawBody));
      } catch {
        console.log(
          "⚠️ Could not parse rawBody as JSON. Raw snippet:",
          text.slice(0, 200)
        );
      }
    }

    // --------------------------
    // 🧩 Normalize structure
    // --------------------------
    const incoming = Array.isArray(rawBody) ? rawBody[0] : rawBody;
    console.log("🔹 Incoming type:", typeof incoming);
    console.log(
      "🔹 Incoming keys:",
      incoming && typeof incoming === "object" ? Object.keys(incoming) : "no incoming"
    );

    const body = incoming?.body || incoming;
    console.log(
      "🔹 Final body keys:",
      body && typeof body === "object" ? Object.keys(body) : "no body"
    );

    if (!body) {
      throw new Error("❌ No valid body payload found in request.");
    }

    // --------------------------
    // 🕹️ Extract candle data
    // --------------------------
    const symbol = body.symbol || "UNKNOWN";
    const timeframe = body.interval || "unknown";
    const bars = Array.isArray(body.bars) ? body.bars : [];

    console.log(`📊 Processing ${bars.length} candles for ${symbol} ${timeframe}`);

    // Helper: convert epoch (ms or s) to epoch seconds
    function toEpochSeconds(rawTime) {
      const t = Number(rawTime);
      if (!Number.isFinite(t)) return null;

      // Milliseconds are typically >= 1e12 (13+ digits)
      // Seconds are typically >= 1e9 (10 digits)
      if (t >= 1e12) {
        // milliseconds
        return Math.floor(t / 1000);
      } else if (t >= 1e9) {
        // seconds
        return Math.floor(t);
      } else {
        // clearly invalid/too small
        return null;
      }
    }

    // Helper: produce an ISO-ish eastern time string with DST using Intl
    function toEasternISOStringFromEpochMs(epochMs) {
      // Use Intl.DateTimeFormat to get timezone-aware components
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: false,
      });

      // Format parts and reconstruct ISO-like string
      const parts = dtf.formatToParts(new Date(epochMs));
      const map = {};
      for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
      }

      // Calculate offset by constructing two dates and measuring difference
      const utcMs = new Date(epochMs).getTime();
      const nyDate = new Date(
        Date.parse(new Date(epochMs).toLocaleString('en-US', { timeZone: 'America/New_York' }))
      );
      const tzOffsetMinutes = Math.round((utcMs - nyDate.getTime()) / 60000);

      const sign = tzOffsetMinutes >= 0 ? '+' : '-';
      const absMinutes = Math.abs(tzOffsetMinutes);
      const hh = String(Math.floor(absMinutes / 60)).padStart(2, '0');
      const mm = String(absMinutes % 60).padStart(2, '0');
      const offset = `${sign}${hh}:${mm}`;

      // Construct ISO-like string from parts
      const iso = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.${map.fractionalSecond || '000'}${offset}`;

      return iso;
    }

    const formatted = bars.map((bar, i) => {
      const rawTime = bar.time;
      const epochSeconds = toEpochSeconds(rawTime);

      if (epochSeconds === null) {
        console.warn(`⚠️ Bar ${i} has invalid time value: ${rawTime}. Skipping.`);
        return null; // will filter out later
      }

      const epochMs = epochSeconds * 1000;

      // Use Intl to compute timezone-aware eastern time (handles DST)
      let easternTimeIso = null;
      try {
        easternTimeIso = toEasternISOStringFromEpochMs(epochMs);
      } catch (err) {
        console.warn('⚠️ Failed to compute eastern time via Intl, falling back to fixed -05:00 offset', err);
        // Fallback: fixed -5 hours (not DST aware)
        const fallback = new Date(epochMs - 5 * 60 * 60 * 1000).toISOString();
        easternTimeIso = fallback;
      }

      // Convert volume to integer
      const volumeInt = Math.round(Number(bar.volume || 0));

      console.log(`✅ [${i + 1}/${bars.length}] ${symbol} rawTime=${rawTime}, epochSeconds=${epochSeconds}, eastern=${easternTimeIso}, volume=${volumeInt}`);

      return {
        symbol,
        timeframe,
        timestamp_utc: epochSeconds,
        candle_time: easternTimeIso,
        eastern_time: easternTimeIso,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: volumeInt,
        _processed_at: new Date().toISOString(),
      };
    })
    // Remove any null entries we skipped due to invalid times
    .filter(Boolean);

    // --------------------------
    // 🚀 Forward to Supabase Edge Function
    // --------------------------
    // The Edge Function expects: { symbol, interval, bars: [...] }
    const payload = {
      symbol,
      interval: timeframe,
      bars: formatted.map((bar) => ({
        time: bar.timestamp_utc,
        timestamp_utc: bar.timestamp_utc,
        eastern_time: bar.eastern_time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
    };

    console.log("🔹 Payload shape for Supabase:", Object.keys(payload));
    console.log("🔹 bars count:", payload.bars.length);

    const response = await axios.post(
      "https://mqnhqdtxruwyrinlhgox.supabase.co/functions/v1/candles_fractal_metadatav2",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `✅ Forwarded ${formatted.length} candles to Supabase | Status: ${response.status}`
    );

    res.status(200).json({
      status: "ok",
      symbol,
      timeframe,
      inserted: formatted.length,
    });
  } catch (error) {
    console.error("❌ Proxy Error:", error.message);
    res
      .status(500)
      .json({ error: error.message || "Internal proxy server error" });
  }
});

export default app;