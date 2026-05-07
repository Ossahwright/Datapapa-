import { supabase, purchaseData, syncWalletSilently } from '../lib/server-utils';

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

    // 🔁 Use purchaseData directly
    try {
      const result = await purchaseData(tx);
      
      // Update transaction status if successful (purchaseData handles failed state updates internally)
      if (result.success) {
        const providerReference = result.data?.reference || result.data?.id || result.reference;
        await supabase.from("transactions").update({
          api_status: "success",
          delivery_status: "processing",
          external_reference: providerReference || tx.external_reference
        }).eq("id", tx.id);
      }

      // Sync wallet in background
      syncWalletSilently().catch(console.error);

      return res.status(result.success ? 200 : 400).json(result);
    } catch (processErr: any) {
      console.error("[RetryVTU] Processing error:", processErr);
      return res.status(500).json({ success: false, error: `Internal processing error: ${processErr.message}` });
    }

  } catch (err: any) {
    console.error(`[RetryVTU] SYSTEM ERROR for ${transactionId || 'unknown'}:`, err);
    return res.status(500).json({ success: false, error: "Retry failed due to a system error" });
  }
}
