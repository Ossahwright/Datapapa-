import { supabase, getDataHubConfig, logDataHubApiCall } from './server-utils.js';
import { callDataHubAPI } from './datahub-client.js';

export enum ProviderState {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  OFFLINE = "offline",
  MAINTENANCE = "maintenance",
  UNKNOWN = "unknown"
}

export interface ProviderHealthReport {
  status: ProviderState;
  latency_ms: number;
  last_synced_at: string;
  wallet_balance: number;
  error?: string;
  details?: any;
}

/**
 * Robust URL normalization using new URL()
 */
export function normalizeProviderUrl(baseUrl: string, endpoint: string): string {
  try {
    // 🛡️ Ensure base ends with a slash for proper relative resolution if needed, 
    // or use direct joins if we want absolute control.
    const base = baseUrl.replace(/\/+$/, "");
    const cleanEndpoint = endpoint.replace(/^\/+/, "");
    
    // Using new URL construction to prevent double slashes and malformations
    const url = new URL(cleanEndpoint, base + "/");
    return url.toString();
  } catch (e) {
    console.error("❌ [Normalizer] Failed to normalize URL:", { baseUrl, endpoint });
    // Fallback to manual join if New URL fails (e.g. invalid base)
    return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
  }
}

/**
 * Authoritative Provider Health Engine
 */
export async function checkProviderHealth(): Promise<ProviderHealthReport> {
  const startTime = Date.now();
  const report: ProviderHealthReport = {
    status: ProviderState.UNKNOWN,
    latency_ms: 0,
    last_synced_at: new Date().toISOString(),
    wallet_balance: 0
  };

  try {
    const config = await getDataHubConfig();
    if (!config.apiKey || !config.baseUrl) {
      report.status = ProviderState.DEGRADED;
      report.error = "Missing Provider DataHub configuration";
      return report;
    }

    // Attempt status check first
    const statusUrl = normalizeProviderUrl(config.baseUrl, "status");
    console.log("=== PROVIDER HEALTH CHECK START ===");
    console.log("=== TARGET URL ===", statusUrl);

    let dhRes;
    try {
      dhRes = await fetch(statusUrl, {
        method: 'GET',
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000)
      });
    } catch (e: any) {
      console.warn("⚠️ [Health Engine] Primary status endpoint failed, falling back to discovery...");
      return await performExhaustiveDiscovery(config);
    }

    report.latency_ms = Date.now() - startTime;
    const contentType = dhRes.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html");

    if (isHtml) {
      console.error("📡 [Health Engine] Provider returned HTML instead of JSON. Infrastructure mismatch.");
      report.status = ProviderState.OFFLINE;
      report.error = `Provider returned HTML ${dhRes.status}`;
      return report;
    }

    if (dhRes.ok) {
      const data = await dhRes.json();
      report.status = ProviderState.HEALTHY;
      report.details = data;
    } else {
      report.status = ProviderState.DEGRADED;
      report.error = `HTTP ${dhRes.status}`;
      
      // 🛡️ TELECOM-GRADE UPGRADE: Check for recent successful execution
      // If we've had successful transactions in the last 30 mins, 
      // the provider is effectively HEALTHY for execution despite sync issues.
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: 'exact', head: true })
        .eq("vtu_status", "delivered")
        .gt("updated_at", thirtyMinsAgo);

      if (count && count > 0) {
        console.log(`📡 [Health Engine] Observability failing but ${count} successful executions in last 30m. Marking as HEALTHY.`);
        report.status = ProviderState.HEALTHY;
        report.error = "Observability degraded, but execution pipeline healthy.";
      }
    }

    return report;
  } catch (error: any) {
    report.status = ProviderState.OFFLINE;
    report.error = error.message;
    return report;
  }
}

/**
 * Performs exhaustive discovery across known DataHub endpoints
 */
async function performExhaustiveDiscovery(config: any): Promise<ProviderHealthReport> {
  const candidates = ["status", "user", "balance", "profile", "wallet"];
  const startTime = Date.now();
  
  console.log("🔄 [Discovery] Starting exhaustive provider endpoint discovery...");

  for (const endpoint of candidates) {
    const url = normalizeProviderUrl(config.baseUrl, endpoint);
    const method = 'GET';
    const sanitizedHeaders = { "X-API-Key": "sk_***" + (config.apiKey || "").slice(-4), "Accept": "application/json" };

    console.log("--- DISCOVERY ATTEMPT ---");
    console.log("=== NORMALIZED PROVIDER URL ===", url);
    console.log("=== REQUEST METHOD ===", method);
    console.log("=== PROVIDER HEADERS ===", sanitizedHeaders);

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "X-API-Key": config.apiKey || "", 
          "Accept": "application/json" 
        },
        signal: AbortSignal.timeout(5000)
      });

      console.log("=== PROVIDER RESPONSE STATUS ===", res.status);
      const text = await res.text();
      
      const isHtml = text.trim().toLowerCase().startsWith("<!doctype html>") || text.trim().toLowerCase().startsWith("<html>");
      if (isHtml) {
        console.warn("⚠️ [Discovery] HTML DETECTED (Likely 404 or Maintenance). Skipping endpoint:", endpoint);
        continue;
      }

      if (res.ok) {
        let data;
        try {
          data = JSON.parse(text);
          console.log(`✅ [Discovery] Reachable endpoint found: /${endpoint}`);
          
          return {
            status: ProviderState.HEALTHY,
            latency_ms: Date.now() - startTime,
            last_synced_at: new Date().toISOString(),
            wallet_balance: extractBalance(data),
            details: { reachable_endpoint: endpoint }
          };
        } catch (e) {
          console.warn("⚠️ [Discovery] Failed to parse JSON even though 200 OK (Might be text/plain):", endpoint);
        }
      }
    } catch (e: any) {
      console.log(`ℹ️ [Discovery] Endpoint /${endpoint} skipped:`, e.message);
    }
  }

  // 🛡️ TELECOM-GRADE UPGRADE: Even if all discovery endpoints fail, 
  // check if the provider is actually executing transactions successfully.
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: 'exact', head: true })
    .eq("vtu_status", "delivered")
    .gt("updated_at", thirtyMinsAgo);

  const isExecuting = count && count > 0;

  return {
    status: isExecuting ? ProviderState.HEALTHY : ProviderState.DEGRADED,
    latency_ms: Date.now() - startTime,
    last_synced_at: new Date().toISOString(),
    wallet_balance: 0,
    error: isExecuting 
      ? "Provider observability endpoints unreachable (404/HTML Drift), but execution pipeline is ACTIVE."
      : "Provider observability unreachable and no recent successful executions found."
  };
}

/**
 * Stabilized Wallet Synchronization with Throttling & Degradation Handling
 */
export async function syncProviderWallet(force = false): Promise<any> {
  const { data: currentSettings } = await supabase
    .from("provider_settings")
    .select("*")
    .eq("provider_name", "datahubgh")
    .single();

  // 🛡️ Prevent log flooding and excessive retries (15 Minute Cooldown)
  if (!force && currentSettings?.next_retry_at) {
    const nextRetry = new Date(currentSettings.next_retry_at).getTime();
    if (Date.now() < nextRetry) {
      return { success: true, throttled: true, balance: currentSettings.wallet_balance, status: "degraded" };
    }
  }

  console.log("=== PROVIDER OBSERVABILITY SYNC START ===");
  const config = await getDataHubConfig();
  const report = await performExhaustiveDiscovery(config);

  const updateData: any = {
    // 🛡️ Note: "degraded" means observability is failing, but execution may still work.
    status: report.status === ProviderState.HEALTHY ? "online" : "degraded",
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (report.status === ProviderState.HEALTHY) {
    updateData.wallet_balance = report.wallet_balance;
    updateData.next_retry_at = null; // Reset retry timer on success
    console.log("✅ [Sync Wallet] Successfully synchronized with provider.");
  } else {
    // 🛡️ 15 Minute Cooldown on failure to prevent log spamming
    const cooldownMinutes = 15; 
    const nextRetryAt = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
    updateData.next_retry_at = nextRetryAt;
    console.warn(`⚠️ [Sync Wallet] Observability degraded. Using cached balance. Next retry at: ${nextRetryAt}`);
  }

  await supabase
    .from("provider_settings")
    .update(updateData)
    .eq("provider_name", "datahubgh");

  return { 
    success: true, // We return success: true because we are non-blocking and using a cache
    balance: report.status === ProviderState.HEALTHY ? report.wallet_balance : (currentSettings?.wallet_balance || 0),
    status: updateData.status,
    error: report.error
  };
}

function extractBalance(data: any): number {
  const walletData = data?.data || data;
  return walletData?.wallet_balance ?? walletData?.balance ?? walletData?.user?.wallet_balance ?? walletData?.user?.balance ?? 0;
}
