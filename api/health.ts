import { supabase, validateEnv, isAdminAuth, getDataHubConfig } from '../lib/server-utils.js';
import axios from 'axios';

console.log("server-utils loaded successfully inside health");

export default async function handler(req: any, res: any) {
  console.log("health handler booted");
  try {
    // 🛡️ Admin Auth Enforcement
    const isAuthorized = await isAdminAuth(req);
    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 🛡️ STEP 4: STARTUP ENV VALIDATION
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

    // 1. Check Database
    const { error: dbError } = await supabase.from('transactions').select('id').limit(1);
    healthData.services.database.status = dbError ? "error" : "online";
    if (dbError) healthData.services.database.error = dbError.message;

    // 2. Check DataHub (Wallet & Status)
    try {
      const { apiKey, baseUrl } = await getDataHubConfig();
      if (apiKey) {
        // DataHub Status Check
        try {
          const statusEndpoint = `${baseUrl.replace(/\/+$/, "")}/status`;
          const dhRes = await axios.get(statusEndpoint, { timeout: 5000 });
          healthData.services.datahub.status = dhRes.status === 200 ? "online" : "degraded";
        } catch (e: any) {
          healthData.services.datahub.status = "degraded";
          healthData.services.datahub.error = e.message;
        }

        // Wallet Balance
        try {
          const walletEndpoint = `${baseUrl.replace(/\/+$/, "")}/user`;
          const walletRes = await axios.get(walletEndpoint, {
            headers: { "X-API-Key": apiKey },
            timeout: 5000
          });
          const walletData = walletRes.data?.data || walletRes.data;
          healthData.services.datahub.balance = walletData?.wallet_balance || walletData?.balance || 0;
        } catch (e) {}
      } else {
        healthData.services.datahub.status = "unknown";
      }
    } catch (e) {
      healthData.services.datahub.status = "error";
    }

    // 3. Webhook Activity (Last 1 hour)
    try {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data: recentWebhooks, count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gt('updated_at', oneHourAgo)
        .not('external_reference', 'is', null);
      
      healthData.services.webhooks.status = (count && count > 0) ? "online" : "idle";
      healthData.services.webhooks.count_1h = count || 0;
    } catch (e) {
      healthData.services.webhooks.status = "error";
    }

    return res.status(200).json(healthData);
  } catch (error: any) {
    console.error("❌ [API] Health Check Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}
