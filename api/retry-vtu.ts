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

  // Rate Limiting: Max 20 retries per minute per IP for Admins, 5 for others
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let calls = globalRateLimit.get(ip) || [];
  calls = calls.filter(t => now - t < 60000);
  const limit = isAuthorized ? 20 : 5;
  if (calls.length >= limit) {
    return res.status(429).json({ 
      success: false, 
      error: `Too many retry attempts. Max ${limit} per minute. Please wait.` 
    });
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
      return res.status(200).json({ success: false, message: "Please wait 30 seconds between retry attempts." });
    }

    // ✅ ALLOW REPURCHASE
    // Since we've passed the "Delivered" and "Footprint" guards, and it's an authenticated Admin,
    // we allow the repurchase attempt to proceed. This covers failed, stuck, and stale transactions.
    
    console.log("RETRY QUALIFICATION: ACCEPTED (Admin Override)");

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
      retryObject.status = "success";
      delete retryObject.external_reference;

      const result = await purchaseData(retryObject, "manual_retry");
      
      // Sync wallet in background
      syncWalletSilently().catch(console.error);

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
