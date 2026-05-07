import { supabase } from '../lib/server-utils';
import { callDataHubAPI } from '../lib/datahub-client';

export default async function handler(req: any, res: any) {
  try {
    // Allow GET (for quick browser test) and POST
    if (!["GET", "POST"].includes(req.method || "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("🔄 [Sync] DataHub Wallet Sync Triggered");

    const result = await callDataHubAPI("user", { method: 'GET' });

    if (!result.success) {
      if (result.error && result.error.includes("404")) {
        console.warn("⚠️ [Sync] User endpoint 404. Falling back to DB balance.");
        // Try to fetch existing balance from DB to prevent fatal UI errors
        const { data: ps } = await supabase
          .from("provider_settings")
          .select("wallet_balance")
          .eq("provider_name", "datahubgh")
          .single();
        
        return res.status(200).json({ 
          success: true, 
          balance: ps?.wallet_balance || 0,
          warning: "API endpoint unavailable, showing cached balance"
        });
      }
      throw new Error(result.error);
    }

    const data = result.data;
    // Flexible parsing (DataHubGH responses vary)
    const balance =
      data?.wallet_balance ??
      data?.balance ??
      data?.user?.wallet_balance ??
      data?.user?.balance ??
      0;

    const { error } = await supabase
      .from("provider_settings")
      .update({
        wallet_balance: balance,
        last_synced_at: new Date().toISOString(),
        status: "online",
      })
      .eq("provider_name", "datahubgh");

    if (error) throw error;

    return res.status(200).json({ success: true, balance });
  } catch (err: any) {
    console.error("❌ [Sync] Fatal Error:", err.message);

    await supabase
      .from("provider_settings")
      .update({ status: "offline" })
      .eq("provider_name", "datahubgh");

    return res.status(200).json({ success: false, error: "Sync failed", message: err.message });
  }
}
