/**
 * 🛡️ AUTHORITATIVE PROVIDER HEALTH SERVICE
 * Responsibility: Single source of truth for provider health intelligence.
 * Path: api/provider-health.ts -> /api/provider-health
 */

import { supabase, getDataHubConfig, isAdminAuth, apiClient } from '../lib/server-utils.js';
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

  const now = Date.now();
  if (providerHealthCache && now < providerHealthCache.expiresAt) {
    return res.status(200).json(providerHealthCache.state);
  }

  // 🛡️ Admin Auth Enforcement
  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
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
    
    console.log(`🌐 [Health Check] Pinging: ${endpoint}`);
    const startTime = Date.now();
    
    try {
      // Use standard axios to avoid any potential agent issues in bridge
      const response = await axios.get(endpoint, {
        headers: {
          "X-API-Key": apiKey || "",
          "Accept": "application/json"
        },
        timeout: 6000,
        validateStatus: () => true
      });

      stats.provider_response_time_ms = Date.now() - startTime;
      stats.latency = stats.provider_response_time_ms;

      if (response.status !== 200) {
        console.warn(`⚠️ [Health Check] Provider returned HTTP ${response.status}`);
        stats.status = PROVIDER_HEALTH.DEGRADED;
        stats.services.api = "error";
      } else {
        const data = response.data?.data || response.data;
        console.log(LOG_MARKERS.PROVIDER_STATUS_RECEIVED);

        stats.services = {
          api: data.services?.api || "operational",
          database: data.services?.database || "operational",
          voucherPurchase: data.services?.voucherPurchase || "healthy"
        };

        const isVoucherHealthy = stats.services.voucherPurchase === 'healthy' || stats.services.voucherPurchase === 'operational';
        const isOperational = data.status === 'operational' || data.success === true || response.status === 200;

        if (isOperational && isVoucherHealthy) {
          stats.status = PROVIDER_HEALTH.OPERATIONAL;
        } else {
          stats.status = PROVIDER_HEALTH.DEGRADED;
        }
      }
    } catch (fetchErr: any) {
      console.error("❌ [Health Check] Connection failed:", fetchErr.message);
      stats.status = PROVIDER_HEALTH.OUTAGE;
      stats.services.api = "unreachable";
      stats.provider_response_time_ms = Date.now() - startTime;
    }

    // Persist metrics if needed
    try {
        await supabase.from('provider_settings').update({
            last_synced_at: stats.last_checked_at,
            last_health_check_at: stats.last_checked_at,
            last_response_time_ms: stats.provider_response_time_ms,
            health_status: stats.status
        }).eq('provider_name', 'datahubgh');
    } catch (saveErr) {
        // Silently fail if columns are missing (expected until migration)
    }

  } catch (error: any) {
    console.error(LOG_MARKERS.PROVIDER_OUTAGE_DETECTED, error.message);
    stats.status = PROVIDER_HEALTH.OUTAGE;
  }

  // 🚀 STEP 6 — CACHE THE RESULT
  providerHealthCache = {
    state: stats,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return res.status(200).json(stats);
}
