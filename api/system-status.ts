import { 
  supabase, 
  validateEnv, 
  isAdminAuth, 
  getDataHubConfig,
  apiClient,
  logDataHubApiCall
} from '../lib/server-utils.js';
import axios from 'axios';
import { LOG_MARKERS, PROVIDER_HEALTH } from '../lib/constants.js';

export default async function handler(req: any, res: any) {
  const query = req.query || {};
  const { feature } = query;

  // General health check (GET /api/system-status?feature=health)
  if (feature === 'health') {
    try {
      const isAuthorized = await isAdminAuth(req);
      if (!isAuthorized) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const envCheck = validateEnv();
      const healthData: any = {
        success: true,
        status: envCheck.valid ? "ok" : "degraded",
        time: new Date().toISOString(),
        env: envCheck,
        services: {
          database: { status: "checking" },
          datahub: { status: "checking" },
          webhooks: { status: "checking" }
        }
      };

      const { error: dbError } = await supabase.from('transactions').select('id').limit(1);
      healthData.services.database.status = dbError ? "error" : "online";

      try {
        const { apiKey, baseUrl } = await getDataHubConfig();
        if (apiKey) {
          const statusEndpoint = `${baseUrl.replace(/\/+$/, "")}/status`;
          const sStartTime = Date.now();
          const dhRes = await axios.get(statusEndpoint, { timeout: 5000, validateStatus: () => true });
          const sDuration = Date.now() - sStartTime;

          await logDataHubApiCall({
            endpoint: "/status (system-health)",
            httpStatus: dhRes.status,
            duration: sDuration,
            response: dhRes.data
          });

          healthData.services.datahub.status = dhRes.status === 200 ? "online" : "degraded";

          const walletEndpoint = `${baseUrl.replace(/\/+$/, "")}/user`;
          const wStartTime = Date.now();
          const walletRes = await axios.get(walletEndpoint, {
            headers: { "X-API-Key": apiKey },
            timeout: 5000,
            validateStatus: () => true
          });
          const wDuration = Date.now() - wStartTime;

          const walletData = walletRes.data?.data || walletRes.data;

          await logDataHubApiCall({
            endpoint: "/user (system-health)",
            httpStatus: walletRes.status,
            duration: wDuration,
            response: walletData
          });

          healthData.services.datahub.balance = walletData?.wallet_balance || walletData?.balance || 0;
        }
      } catch (e: any) {
        healthData.services.datahub.status = "error";
        await logDataHubApiCall({
          endpoint: "system-health-check-failed",
          errorMessage: e.message
        });
      }

      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).gt('updated_at', oneHourAgo).not('external_reference', 'is', null);
      healthData.services.webhooks.status = (count && count > 0) ? "online" : "idle";
      healthData.services.webhooks.count_1h = count || 0;

      return res.status(200).json(healthData);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Provider health check (GET /api/system-status?feature=provider-health)
  if (feature === 'provider-health') {
    const isAuthorized = await isAdminAuth(req);
    const stats: any = {
      status: PROVIDER_HEALTH.OPERATIONAL,
      latency: 0,
      provider_response_time_ms: 0,
      timestamp: new Date().toISOString(),
      services: { api: "operational", database: "operational", voucherPurchase: "healthy" }
    };

    let startTime = Date.now();
    try {
      const { apiKey, baseUrl } = await getDataHubConfig();
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/status`;
      startTime = Date.now();
      
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'GET',
          headers: { "X-API-Key": apiKey || "", "Accept": "application/json", "User-Agent": "Datapapa-Health-Checker/1.0" },
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok && response.status !== 401 && response.status !== 403) throw new Error(`Primary failed`);
      } catch (e) {
        const userEndpoint = `${baseUrl.replace(/\/+$/, "")}/user`;
        response = await fetch(userEndpoint, {
          method: 'GET',
          headers: { "X-API-Key": apiKey || "", "Accept": "application/json", "User-Agent": "Datapapa-Health-Checker/1.0" },
          signal: AbortSignal.timeout(10000)
        });
      }

      stats.provider_response_time_ms = Date.now() - startTime;
      stats.latency = stats.provider_response_time_ms;

      await logDataHubApiCall({
        endpoint: "provider-health-check",
        httpStatus: response.status,
        duration: stats.provider_response_time_ms,
        response: response.ok ? await response.clone().json().catch(() => ({})) : null
      });

      if (!response.ok) {
        const errorText = await response.text();
        stats.status = PROVIDER_HEALTH.DEGRADED;
        stats.services.api = "error";
        if (isAuthorized) stats.error_details = errorText;
      } else {
        const rawData: any = await response.json();
        const data = rawData?.data || rawData;
        stats.services = {
          api: data.services?.api || "operational",
          database: data.services?.database || "operational",
          voucherPurchase: data.services?.voucherPurchase || "healthy"
        };
        const isVoucherHealthy = stats.services.voucherPurchase === 'healthy' || stats.services.voucherPurchase === 'operational';
        const isOperational = data.status === 'operational' || data.success === true;
        stats.status = (isOperational && isVoucherHealthy) ? PROVIDER_HEALTH.OPERATIONAL : PROVIDER_HEALTH.DEGRADED;
      }
    } catch (fetchErr: any) {
      stats.status = PROVIDER_HEALTH.OUTAGE;
      stats.services.api = "unreachable";
      stats.provider_response_time_ms = Date.now() - startTime;
      if (isAuthorized) { stats.error = fetchErr.message; stats.stack = fetchErr.stack; }
    }

    return res.status(200).json(stats);
  }

  // DataHub detail check (GET /api/system-status?feature=datahub)
  if (feature === 'datahub') {
    const isAuthorized = await isAdminAuth(req);
    if (!isAuthorized) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const startTime = Date.now();
    try {
      const { apiKey, baseUrl } = await getDataHubConfig();
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/status`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { "X-API-Key": apiKey || "", "Content-Type": "application/json" }
      });
      const responseTime = Date.now() - startTime;
      const text = await response.text();

      await logDataHubApiCall({
        endpoint: "/status (datahub-detail-check)",
        httpStatus: response.status,
        duration: responseTime,
        response: text.includes('<!DOCTYPE html>') ? "HTML ERROR" : text
      });

      if (text.includes('<!DOCTYPE html>')) return res.status(500).json({ success: false, error: "Provider returned HTML", status: "down" });

      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      const isAuthAccepted = response.ok || (data?.error && (data.error.toLowerCase().includes("required") || data.error.toLowerCase().includes("networkkey")));
      
      if (data?.error === 'Invalid or inactive API key') return res.status(401).json({ success: false, status: "down", online: false, providerStatus: response.status, responseTime, error: "Invalid or inactive API key" });

      if (isAuthAccepted) {
        let currentBalance = 0;
        const { data: ps } = await supabase.from("provider_settings").select("wallet_balance").eq("provider_name", "datahubgh").single();
        if (ps) currentBalance = ps.wallet_balance;

        return res.status(200).json({ success: true, status: "online", online: true, providerStatus: response.status, timestamp: new Date().toISOString(), responseTime, provider: "DataHubGH", balance: { current: currentBalance } });
      }

      return res.status(500).json({ success: false, status: "down", online: false, providerStatus: response.status, responseTime, error: data?.error || "Provider unavailable" });
    } catch (error: any) {
      return res.status(500).json({ success: false, status: "down", online: false, providerStatus: 500, responseTime: 0, error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid feature requested' });
}
