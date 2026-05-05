import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from '../lib/server-utils.js';
import { callDataHubAPI } from '../lib/datahub-client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Allow GET (for quick browser test) and POST
    if (!["GET", "POST"].includes(req.method || "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("🔄 [Sync] DataHub Wallet Sync Triggered");

    const result = await callDataHubAPI("balance", { method: 'GET' });

    if (!result.success) {
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
