import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase, getDataHubConfig } from '../lib/server-utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Allow GET (for quick browser test) and POST
    if (!["GET", "POST"].includes(req.method || "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("SYNC ROUTE HIT");

    const { apiKey } = await getDataHubConfig();

    if (!apiKey) {
      throw new Error("DataHub API key not configured");
    }

    const response = await fetch("https://datahubgh.com/api/balance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const result = await response.json();
    console.log("DATAHUB RESPONSE:", result);

    // Flexible parsing (DataHubGH responses vary)
    const balance =
      result?.balance ??
      result?.data?.balance ??
      result?.wallet ??
      0;

    const { error } = await supabase
      .from("provider_settings")
      .update({
        wallet_balance: balance,
        last_synced_at: new Date().toISOString(),
        status: "online",
      })
      .eq("provider_name", "datahubgh");

    if (error) {
      console.error("DB UPDATE ERROR:", error);
      throw error;
    }

    return res.status(200).json({ success: true, balance });
  } catch (err: any) {
    console.error("SYNC ERROR:", err);

    await supabase
      .from("provider_settings")
      .update({ status: "offline" })
      .eq("provider_name", "datahubgh");

    return res.status(500).json({ success: false, error: "Sync failed" });
  }
}
