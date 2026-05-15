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
import { checkProviderHealth, ProviderState } from '../lib/provider-health.js';

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
        const report = await checkProviderHealth();
        healthData.services.datahub.status = report.status === ProviderState.HEALTHY ? "online" : "degraded";
        healthData.services.datahub.balance = report.wallet_balance;
        healthData.services.datahub.details = report.details;
        if (report.error) healthData.services.datahub.error = report.error;
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
    
    try {
      const report = await checkProviderHealth();
      const stats: any = {
        status: report.status === ProviderState.HEALTHY ? PROVIDER_HEALTH.OPERATIONAL : report.status.toUpperCase(),
        latency: report.latency_ms,
        provider_response_time_ms: report.latency_ms,
        timestamp: new Date().toISOString(),
        services: { 
          api: report.status === ProviderState.HEALTHY ? "operational" : "degraded", 
          database: "operational", 
          voucherPurchase: report.status === ProviderState.HEALTHY ? "healthy" : "degraded" 
        }
      };

      if (report.error && isAuthorized) stats.error = report.error;
      if (report.details) stats.details = report.details;

      return res.status(200).json(stats);
    } catch (fetchErr: any) {
      return res.status(200).json({
        status: PROVIDER_HEALTH.OUTAGE,
        services: { api: "unreachable", database: "operational", voucherPurchase: "unknown" },
        error: isAuthorized ? fetchErr.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }

  // DataHub detail check (GET /api/system-status?feature=datahub)
  if (feature === 'datahub') {
    const isAuthorized = await isAdminAuth(req);
    if (!isAuthorized) return res.status(401).json({ success: false, error: 'Unauthorized' });

    try {
      const report = await checkProviderHealth();
      
      let currentBalance = 0;
      const { data: ps } = await supabase.from("provider_settings").select("wallet_balance").eq("provider_name", "datahubgh").single();
      if (ps) currentBalance = ps.wallet_balance;

      return res.status(200).json({ 
        success: true, 
        status: report.status === ProviderState.HEALTHY ? "online" : "degraded", 
        online: report.status === ProviderState.HEALTHY, 
        timestamp: new Date().toISOString(), 
        responseTime: report.latency_ms, 
        provider: "DataHubGH", 
        balance: { current: currentBalance },
        error: report.error
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, status: "down", online: false, error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid feature requested' });
}
