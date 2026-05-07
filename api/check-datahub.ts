/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * DataHub Connectivity and Status Monitoring.
 * 
 * 🛡️ BLOCK RULE: NEVER use this file to simulate purchases or send POST payloads.
 * Strictly checks connectivity via GET /status only.
 */

import { supabase, getDataHubConfig, isAdminAuth } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside check-datahub");

// Simple in-memory global rate limiter since we run in a long-lived process
const globalRateLimit = new Map<string, number>();

export default async function handler(req: any, res: any) {
  console.log("check-datahub handler booted");

  // 🛡️ Admin Auth Enforcement
  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed. This endpoint only accepts GET requests."
    });
  }
  
  // Rate limits: 1 request per 30 seconds per IP
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const lastCall = globalRateLimit.get(ip) || 0;
  if (now - lastCall < 30000) {
    return res.status(429).json({
      success: false,
      error: "Too Many Requests. Health ping limited to 1 per 30 seconds."
    });
  }
  globalRateLimit.set(ip, now);

  const startTime = Date.now();
  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/status`;

    // 🛡️ Production Safety: We MUST use the /status endpoint.
    // NEVER use the /data-purchase endpoint for health checks, as it counts 
    // against the provider's API limits and can accidentally trigger logic.
    
    // Attempt to GET the status/ping endpoint first
    const response = await fetch(
      endpoint,
      {
        method: "GET",
        headers: {
          "X-API-Key": apiKey || "",
          "Content-Type": "application/json"
        }
      }
    );

    const text = await response.text();
    
    // 🛡️ Handle HTML response
    if (text.includes('<!DOCTYPE html>')) {
      return res.status(500).json({
        success: false,
        error: "Provider returned HTML (likely 404). Check API URL.",
        status: "down"
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    const responseTime = Date.now() - startTime;

    // Validation errors imply that authentication succeeded and the endpoint is responding to our API key.
    const isAuthAccepted = response.ok 
       || (data?.error && data.error.toLowerCase().includes("required"))
       || (data?.error && data.error.toLowerCase().includes("networkkey"));
       
    const isInvalidKey = data?.error === 'Invalid or inactive API key';

    if (isInvalidKey) {
      return res.status(401).json({
        success: false,
        status: "down",
        online: false,
        providerStatus: response.status,
        responseTime,
        error: "Invalid or inactive API key"
      });
    }

    if (isAuthAccepted) {
      // Fetch latest known balance from database to satisfy expected JSON output
      let currentBalance = 0;
      try {
        const { data: ps } = await supabase
          .from("provider_settings")
          .select("wallet_balance")
          .eq("provider_name", "datahubgh")
          .single();
        if (ps) {
          currentBalance = ps.wallet_balance;
        }
      } catch (err) {
        // ignore
      }

      return res.status(200).json({
        success: true,
        status: "online",
        online: true,
        providerStatus: response.status,
        timestamp: new Date().toISOString(),
        responseTime,
        provider: "DataHubGH",
        balance: {
          current: currentBalance
        }
      });
    }

    return res.status(500).json({
      success: false,
      status: "down",
      online: false,
      providerStatus: response.status,
      responseTime,
      error: data?.error || "Provider unavailable"
    });
  } catch (error: any) {
    console.error("❌ [API] DataHub Check Error:", error);
    return res.status(500).json({
      success: false,
      status: "down",
      online: false,
      providerStatus: 500,
      responseTime: 0,
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}
