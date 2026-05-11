// api/tradingview-alert.js - Vercel serverless webhook for TradingView alerts (parallel to proxy-candlestick.js).
// POST inserts one row into public.tradingview_alerts via Supabase REST (service role).

export const config = {
  runtime: "nodejs22.x",
  maxDuration: 10,
};

const DEFAULT_SUPABASE_ORIGIN = "https://mqnhqdtxruwyrinlhgox.supabase.co";

function supabaseOrigin() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_ORIGIN;
  return String(fromEnv).replace(/\/$/, "");
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded && typeof forwarded === "string") {
    return forwarded.split(",")[0].trim() || null;
  }
  if (req.headers["x-real-ip"] && typeof req.headers["x-real-ip"] === "string") {
    return req.headers["x-real-ip"];
  }
  return null;
}

function querySecret(req) {
  const direct =
    typeof req.query?.secret === "string"
      ? req.query.secret
      : Array.isArray(req.query?.secret)
        ? req.query.secret[0]
        : null;
  if (direct) return direct;
  try {
    const url = typeof req.url === "string" ? req.url : "";
    const qmark = url.indexOf("?");
    if (qmark === -1) return null;
    return new URLSearchParams(url.slice(qmark)).get("secret");
  } catch {
    return null;
  }
}

function secretOk(req) {
  const expected = process.env.TRADINGVIEW_ALERT_WEBHOOK_SECRET;
  if (!expected) return true;
  const qs = querySecret(req);
  const header = req.headers["x-alert-secret"];
  const headerVal = typeof header === "string" ? header : null;
  return qs === expected || headerVal === expected;
}

function parseAlertPayload(raw, contentType) {
  const ct = (contentType || "").toLowerCase();
  const trimmed = raw.trim();
  if (!trimmed) {
    return { emptyBody: true };
  }
  const maybeJson =
    ct.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (maybeJson) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return { raw: trimmed, jsonParseFailed: true };
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function parsedBodyToPayload(body, contentType) {
  if (body == null || body === "") {
    return { emptyBody: true };
  }
  if (Buffer.isBuffer(body)) {
    return parseAlertPayload(body.toString("utf8"), contentType);
  }
  if (typeof body === "string") {
    return parseAlertPayload(body, contentType);
  }
  if (typeof body === "object") {
    return body;
  }
  return { value: body };
}

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    console.log("[tradingview-alert] Method:", req.method);
    console.log("[tradingview-alert] Headers keys:", Object.keys(req.headers));

    if (req.method === "GET") {
      return res.status(200).json({
        status: "healthy",
        purpose: "TradingView alert webhook → Supabase tradingview_alerts",
        timestamp: new Date().toISOString(),
        config,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!secretOk(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing");
    }

    const contentType = req.headers["content-type"] || "";
    let nested = parsedBodyToPayload(req.body, contentType);

    if (Array.isArray(nested) && nested.length > 0) {
      nested = nested[0].body != null ? nested[0].body : nested[0];
    }

    const payload =
      nested !== null && typeof nested === "object" ? nested : { value: nested };

    const row = {
      payload,
      content_type: typeof contentType === "string" ? contentType : null,
      source_ip: clientIp(req),
    };

    const restUrl = `${supabaseOrigin()}/rest/v1/tradingview_alerts`;

    console.log("[tradingview-alert] Insert payload keys:", Object.keys(row));
    console.log("[tradingview-alert] Payload preview:", JSON.stringify(payload).slice(0, 400));

    const response = await fetch(restUrl, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    const responseText = await response.text();
    console.log("[tradingview-alert] Supabase status:", response.status);
    console.log("[tradingview-alert] Supabase body preview:", responseText.slice(0, 500));

    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      throw new Error(
        `Supabase error: ${response.status}: ${
          typeof responseData === "object" && responseData?.message
            ? responseData.message
            : responseText.slice(0, 200)
        }`,
      );
    }

    const inserted = Array.isArray(responseData) ? responseData[0] : responseData;
    const duration = Date.now() - startTime;
    console.log("[tradingview-alert] OK id=", inserted?.id, "duration=", duration + "ms");

    return res.status(200).json({
      success: true,
      id: inserted?.id ?? null,
      data: inserted,
      duration: duration + "ms",
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[tradingview-alert] Error:", error.message);
    console.error("[tradingview-alert] Duration:", duration + "ms");

    return res.status(500).json({
      error: error.message,
      duration: duration + "ms",
    });
  }
}
