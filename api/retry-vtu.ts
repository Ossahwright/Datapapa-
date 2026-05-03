import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { transactionId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const { data: transaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchErr || !transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Call DataHub again
    const payload = {
      networkKey: transaction.datahub_network_key,
      recipient: transaction.recipient_phone,
      capacity: transaction.datahub_capacity.toString().replace("GB", ""),
    };

    console.log("📤 RETRY DATAHUB REQUEST:", payload);

    const r = await fetch("https://app.datahubgh.com/api/external/data-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.DATAHUB_API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    const result: any = await r.json();
    console.log("📥 RETRY DATAHUB RESPONSE:", result);

    // Update database with new result
    if (result?.success || result?.status === 'SUCCESSFUL' || result?.status === 'PROCESSING') {
      await supabase.from("transactions").update({
        vtu_status: "success",
        status: "completed",
        api_response: result,
        updated_at: new Date().toISOString()
      }).eq("id", transactionId);
      
      return res.json({ message: "Retry executed: Success", result });
    } else {
      await supabase.from("transactions").update({
        vtu_status: "failed",
        api_response: result,
        updated_at: new Date().toISOString()
      }).eq("id", transactionId);
      
      return res.json({ message: `Retry executed: Failed (${result?.message || 'Unknown error'})`, result });
    }
  } catch (err: any) {
    console.error("❌ RETRY ERROR:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
