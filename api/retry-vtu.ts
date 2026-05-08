/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * Handles Manual VTU Retries for failed or stuck transactions.
 * Unauthorized modifications may break live purchases.
 */

import { supabase, purchaseData, syncWalletSilently, isAdminAuth } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside retry-vtu");

const globalRateLimit = new Map<string, number[]>();

export default async function handler(req: any, res: any) {
  console.log("retry-vtu handler booted");
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 🛡️ Admin Auth Enforcement
  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    console.warn("🔐 [Unauthorized Access] Blocked manual retry attempt.");
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin access required' });
  }

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

  let transactionId = null;
  try {
    const body = req.body || {};
    transactionId = body.transactionId;
    if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

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
    const isAlreadyDelivered = tx.vtu_status === "delivered" || tx.vtu_status === "success";
    if (isAlreadyDelivered) {
      console.log("✅ [Retry Blocked] Already delivered.");
      return res.json({ success: false, message: "Already delivered — no retry allowed" });
    }

    // 🛡️ RECONCILIATION OVERRIDE GUARD (INDUSTRY STANDARD)
    // If the provider previously accepted or gave a reference, NEVER repurchase.
    const hasProviderFootprint = 
      !!tx.provider_reference || 
      !!tx.external_reference || 
      ["provider_accepted", "awaiting_provider_confirmation", "reconciliation_pending", "delayed_provider_processing", "manual_review_required"].includes(tx.vtu_status);

    if (hasProviderFootprint) {
      console.log("🛡️ [Retry Firewall] Transaction has provider footprint. Diverting to Reconciliation.");
      return res.status(200).json({ 
        success: false, 
        message: "Repurchase Denied: Transaction is already known by provider. Use 'Sync Status' to check current state, or wait for webhook.",
        divertedToReconciliation: true 
      });
    }

    // ⏳ Block if still processing recently or retried too soon
    const lastUpdate = tx.updated_at ? new Date(tx.updated_at).getTime() : 0;
    const isRecentlyProcessed = (Date.now() - lastUpdate < 30000); // 30 second cooldown
    if (isRecentlyProcessed && (tx.vtu_status === "provider_execution_started" || tx.vtu_status === "processing")) {
      console.log("⏳ [Retry Blocked] Retried too recently.");
      return res.status(429).json({ success: false, message: "Please wait 30 seconds between retry attempts." });
    }

    // ✅ ALLOW REPURCHASE ONLY IF:
    // 1. It explicitly failed or provider rejected it natively
    // 2. OR it is "stuck" natively
    const isExplicitlyFailed = tx.status === "failed" || tx.vtu_status === "failed" || tx.vtu_status === "provider_rejected";
    const isStuck = (tx.status === "paid" || tx.status === "payment_verified" || tx.status === "success") && (!tx.vtu_status || tx.vtu_status === 'pending');
    
    console.log("RETRY QUALIFICATION:", { isExplicitlyFailed, isStuck, vtu_status: tx.vtu_status });

    if (!isExplicitlyFailed && !isStuck) {
      console.error("❌ [Retry Blocked] Not eligible for repurchase.");
      return res.json({ success: false, message: `Repurchase not allowed (Current state: ${tx.vtu_status || tx.status})` });
    }

    console.log("=== INCREMENTING RETRY ATTEMPTS ===");
    await supabase.from('transactions').update({
       delivery_attempts: (tx.delivery_attempts || 0) + 1,
       vtu_status: 'provider_execution_started',
       updated_at: new Date().toISOString()
    }).eq('id', tx.id);

    // 🔁 Use purchaseData directly
    console.log("=== RE-EXECUTE REPURCHASE ===");
    try {
      // 🛡️ FORCE fresh retry 
      const retryObject = { ...tx };
      retryObject.status = "paid";
      delete retryObject.external_reference;

      const result = await purchaseData(retryObject, "manual_retry");
      console.log("=== REPURCHASE EXECUTION RESULT ===");
      console.log(JSON.stringify(result, null, 2));
      
      // Update transaction status if successful
      if (result.success) {
        const providerReference = result.provider_reference || result.external_reference || result.data?.reference || result.data?.id || result.reference;
        
        const updates: any = {
           status: "paid",
           payment_status: "paid",
           api_status: "success",
           vtu_status: result.vtu_status || "provider_accepted",
           provider_reference: providerReference,
           external_reference: providerReference,
           reconciliation_state: "awaiting_provider_confirmation",
           updated_at: new Date().toISOString()
        };
        
        await supabase.from("transactions").update(updates).eq("id", tx.id);
      }

      // Sync wallet in background
      syncWalletSilently().catch(console.error);

      // We return 200 even for logical failures so the frontend can read the JSON payload
      // Otherwise Axios throws, and if standard parsing fails, it shows "Request failed with status code 400"
      return res.status(200).json(result);
    } catch (processErr: any) {
      console.error("[RetryVTU] Processing error:", processErr);
      return res.status(500).json({ success: false, error: `Internal processing error: ${processErr.message}` });
    }

  } catch (err: any) {
    console.error(`[RetryVTU] SYSTEM ERROR for ${transactionId || 'unknown'}:`, err);
    return res.status(500).json({ success: false, error: "Retry failed due to a system error" });
  }
}
