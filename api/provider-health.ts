/**
 * 🛡️ AUTHORITATIVE PROVIDER HEALTH SERVICE
 * Responsibility: Single source of truth for provider health intelligence.
 * Path: api/provider-health.ts -> /api/provider-health
 */

import { supabase, getDataHubConfig, isAdminAuth } from '../lib/server-utils.js';
import { LOG_MARKERS, PROVIDER_HEALTH } from '../lib/constants.js';

// 🚀 STEP 6 — IMPLEMENT CACHED HEALTH STATE (60 seconds)
let providerHealthCache: {
  state: any;
  expiresAt: number;
} | null = null;

const CACHE_TTL_MS = 60000;

export default async function handler(req: any, res: any) {
  // Only allow GET for health checks
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Admin optional? No, the prompt says "Admin health panel", usually these are admin-only.
  // But STEP 9 says "disable purchases temporarily", which means the public purchase logic needs to know the state.
  // So this endpoint might be public OR the purchase logic should call a internal version.
  // I'll make it public but with rate limiting, or just accessible by the frontend.
  
  // Actually, to implement STEP 9, the purchase logic will need to check this.
  // Let's make it public for now so the frontend can display it, but keep secrets safe.

  const now = Date.now();
  if (providerHealthCache && now < providerHealthCache.expiresAt) {
    return res.status(200).json(providerHealthCache.state);
  }

  console.log(LOG_MARKERS.PROVIDER_HEALTH_CHECK_START);

  const stats: {
    provider: string;
    status: string;
    last_checked_at: string;
    provider_response_time_ms: number;
    services: Record<string, string>;
    latency: number;
  } = {
    provider: "DataHubGH",
    status: PROVIDER_HEALTH.UNREACHABLE,
    last_checked_at: new Date().toISOString(),
    provider_response_time_ms: 0,
    services: {
      api: "unknown",
      database: "unknown",
      voucherPurchase: "unknown"
    },
    latency: 0
  };

  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/status`;
    
    const startTime = Date.now();
    
    // 🚀 STEP 3 — IMPLEMENT SAFE SERVER-SIDE FETCHING (5000ms timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey || "",
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    stats.provider_response_time_ms = Date.now() - startTime;
    stats.latency = stats.provider_response_time_ms;

    if (!response.ok) {
        throw new Error(`Provider returned ${response.status}`);
    }

    const data = await response.json();
    console.log(LOG_MARKERS.PROVIDER_STATUS_RECEIVED);

    // 🚀 STEP 5 — IMPLEMENT OPERATIONAL CLASSIFICATION
    /**
     * HEALTHY: status=operational && voucherPurchase=healthy
     * DEGRADED: Latency > 5s OR voucherPurchase unhealthy
     * OUTAGE: Fetch fails, unreachable, invalid payload
     */
    
    stats.services = {
        api: data.services?.api || "unknown",
        database: data.services?.database || "unknown",
        voucherPurchase: data.services?.voucherPurchase || "unknown"
    };

    const isVoucherHealthy = stats.services.voucherPurchase === 'healthy';
    const isOperational = data.status === 'operational';

    if (isOperational && isVoucherHealthy) {
        stats.status = PROVIDER_HEALTH.OPERATIONAL;
    } else if (stats.provider_response_time_ms > 5000 || !isVoucherHealthy) {
        stats.status = PROVIDER_HEALTH.DEGRADED;
        console.warn(LOG_MARKERS.PROVIDER_DEGRADED);
    } else {
        stats.status = PROVIDER_HEALTH.OUTAGE;
        console.error(LOG_MARKERS.PROVIDER_OUTAGE_DETECTED);
    }

    // Persist metrics if needed (STEP 10)
    try {
        await supabase.from('provider_settings').update({
            last_health_check_at: stats.last_checked_at,
            last_response_time_ms: stats.provider_response_time_ms,
            health_status: stats.status
        }).eq('provider_name', 'datahubgh');
    } catch (saveErr) {
        console.warn("Could not persist health metrics to DB (likely missing columns):", saveErr);
    }

  } catch (error: any) {
    console.error(LOG_MARKERS.PROVIDER_OUTAGE_DETECTED, error.message);
    stats.status = PROVIDER_HEALTH.OUTAGE;
    stats.services.api = "outage";
    stats.services.voucherPurchase = "outage";
  }

  // 🚀 STEP 6 — CACHE THE RESULT
  providerHealthCache = {
    state: stats,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return res.status(200).json(stats);
}
