import { supabase } from '../lib/server-utils.js';
import { callDataHubWithRetry } from '../lib/datahub.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    console.log(`[RetryVTU] Triggered for ID: ${transactionId}`);
    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // 🚫 Block invalid retries
    if (tx.delivery_status === "delivered" || tx.vtu_status === "delivered" || tx.vtu_status === "success" || tx.delivery_status === "success") {
      return res.json({ success: false, message: "Already delivered — no retry allowed" });
    }

    if (tx.delivery_status === "delivering" || tx.vtu_status === "processing" || tx.status === "processing") {
      return res.json({ success: false, message: "Transaction is still being processed" });
    }

    if (tx.delivery_status !== "failed" && tx.vtu_status !== "failed" && tx.status !== "failed") {
      return res.json({ success: false, message: `Retry not allowed (Status: ${tx.delivery_status || tx.status})` });
    }

    await supabase.from('transactions').update({
       delivery_attempts: (tx.delivery_attempts || 0) + 1,
       updated_at: new Date().toISOString()
    }).eq('id', tx.id);

    // 🔁 Reuse same id → call purchase API again
    const baseUrl = process.env.BASE_URL || `https://${process.env.VERCEL_URL}`;
    const rawNetwork = String(tx.network || "").toLowerCase();
    const capacity = String(tx.datahub_capacity || tx.capacity || "").toUpperCase().replace("GB", "").trim();

    try {
      const response = await fetch(`${baseUrl}/api/purchase-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bundle: capacity,
          phone: tx.recipient_phone,
          network: rawNetwork,
          transaction_id: tx.id, // 🔥 CRITICAL
          payer_phone_number: tx.payer_phone_number
        }),
      });

      const respData = await response.json();
      return res.status(response.status).json(respData);
    } catch (fetchErr: any) {
      console.error("Fetch purchase-data error:", fetchErr);
      return res.status(500).json({ success: false, error: `Internal communication error: ${fetchErr.message}` });
    }

  } catch (err: any) {
    console.error(`[RetryVTU] SYSTEM ERROR for ${transactionId || 'unknown'}:`, err);
    return res.status(500).json({ success: false, error: "Retry failed due to a system error" });
  }
}
