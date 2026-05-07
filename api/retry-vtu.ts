import { supabase, purchaseData, syncWalletSilently } from '../lib/server-utils';

const globalRateLimit = new Map<string, number[]>();

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Rate Limiting: Max 5 retries per minute per IP
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let calls = globalRateLimit.get(ip) || [];
  calls = calls.filter(t => now - t < 60000);
  if (calls.length >= 5) {
    return res.status(429).json({ success: false, error: 'Too many retry attempts. Please wait 1 minute.' });
  }
  calls.push(now);
  globalRateLimit.set(ip, calls);

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    console.log("=== RETRY ATTEMPT START ===");
    console.log("TRANSACTION ID:", transactionId);

    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !tx) {
      console.error("❌ Transaction not found for retry:", transactionId);
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    console.log("CURRENT STATE:", {
      status: tx.status,
      vtu_status: tx.vtu_status,
      ext_ref: tx.external_reference
    });

    // 🚫 Block invalid retries (Already successful)
    const isAlreadyDelivered = tx.vtu_status === "success" || tx.vtu_status === "completed" || tx.vtu_status === "delivered";
    if (isAlreadyDelivered || tx.external_reference) {
      console.log("✅ [Retry Blocked] Already delivered/has reference.");
      return res.json({ success: false, message: "Already delivered or has provider reference — no retry allowed" });
    }

    // ⏳ Block if still processing recently or retried too soon
    const lastUpdate = tx.updated_at ? new Date(tx.updated_at).getTime() : 0;
    const isRecentlyProcessed = (Date.now() - lastUpdate < 60000); // 1 minute cooldown
    if (isRecentlyProcessed) {
      console.log("⏳ [Retry Blocked] Retried too recently.");
      return res.status(429).json({ success: false, message: "Please wait 60 seconds between retry attempts." });
    }

    // ✅ ALLOW RETRY IF:
    // 1. It explicitly failed
    // 2. OR it is "stuck" (paid/success but not success/processing)
    const isExplicitlyFailed = tx.status === "failed" || tx.vtu_status === "failed";
    const isStuck = (tx.status === "paid" || tx.status === "success") && !tx.vtu_status;
    
    console.log("RETRY QUALIFICATION:", { isExplicitlyFailed, isStuck });

    if (!isExplicitlyFailed && !isStuck && tx.vtu_status !== "processing") {
      console.error("❌ [Retry Blocked] Not eligible for retry.");
      return res.json({ success: false, message: `Retry not allowed (Current state: ${tx.vtu_status || tx.status})` });
    }

    console.log("=== INCREMENTING RETRY ATTEMPTS ===");
    await supabase.from('transactions').update({
       delivery_attempts: (tx.delivery_attempts || 0) + 1,
       updated_at: new Date().toISOString()
    }).eq('id', tx.id);

    // 🔁 Use purchaseData directly
    console.log("=== RE-EXECUTING purchaseData ===");
    try {
      // 🛡️ CRITICAL: If we are retrying a "stuck" but "paid" transaction, 
      // ensure we pass the correct object state
      const retryObject = { ...tx };
      if (isStuck) retryObject.status = "paid";

      const result = await purchaseData(retryObject, "manual_retry");
      console.log("=== RETRY EXECUTION RESULT ===");
      console.log(JSON.stringify(result, null, 2));
      
      // Update transaction status if successful
      if (result.success) {
        const providerReference = result.external_reference || result.data?.reference || result.data?.id || result.reference;
        await supabase.from("transactions").update({
          api_status: "success",
          vtu_status: "processing",
          external_reference: providerReference || tx.external_reference,
          updated_at: new Date().toISOString()
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
