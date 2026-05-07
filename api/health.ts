import { supabase } from '../lib/server-utils.js';
import axios from 'axios';

console.log("server-utils loaded successfully inside health");

export default async function handler(req: any, res: any) {
  console.log("health handler booted");
  try {
    const healthData: any = {
      success: true,
      status: "ok",
      time: new Date().toISOString(),
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
      const { data: config } = await supabase.from('settings').select('*').eq('id', 'datahub_config').single();
      if (config) {
        // DataHub Status Check
        try {
          const dhRes = await axios.get("https://app.datahubgh.com/api/external/status", { timeout: 5000 });
          healthData.services.datahub.status = dhRes.status === 200 ? "online" : "degraded";
        } catch (e: any) {
          healthData.services.datahub.status = "degraded";
          healthData.services.datahub.error = e.message;
        }

        // Wallet Balance
        if (config.api_key) {
          try {
            const walletRes = await axios.get("https://app.datahubgh.com/api/external/wallet", {
              headers: { "Authorization": `Token ${config.api_key}` },
              timeout: 5000
            });
            healthData.services.datahub.balance = walletRes.data.balance;
          } catch (e) {}
        }
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

    res.status(200).json(healthData);
  } catch (error: any) {
    res.status(500).json({ status: "error", error: error.message });
  }
}
