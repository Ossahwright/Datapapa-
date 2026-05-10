/**
 * 🛡️ PAYSTACK V2 AUTHORITATIVE WEBHOOK
 * Responsibility: Handle payment verification and trigger fulfillment.
 * State Machine: initialized -> payment_success -> fulfillment_processing -> fulfilled | failed
 */

import { supabase, purchaseData } from '../../lib/server-utils.js';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  console.log("=== WEBHOOK RECEIVED ===");
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ [Webhook] Missing PAYSTACK_SECRET_KEY");
      return res.status(500).send("Misconfigured Server");
    }

    // 1. SIGNATURE VERIFICATION (STRICT)
    const signature = req.headers["x-paystack-signature"];
    const bodyStr = req.rawBody || JSON.stringify(req.body);
    
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(bodyStr)
      .digest("hex");

    if (hash !== signature) {
      console.error("❌ [Webhook] Invalid Signature Detected");
      return res.status(401).send("Invalid Signature");
    }

    const event = req.body;
    if (event.event !== "charge.success") {
      console.log(`ℹ️ [Webhook] Ignoring event: ${event.event}`);
      return res.status(200).send("Event Ignored");
    }

    console.log("=== PAYMENT VERIFIED ===");
    const paystackData = event.data;
    const reference = paystackData.reference;
    let metadata = paystackData.metadata;

    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch(e) { /* ignore */ }
    }

    const transactionId = metadata?.transaction_id;
    console.log(`🔗 Correlating reference: ${reference} -> Tx: ${transactionId}`);

    // 2. TRANSACTION RETRIEVAL
    const { data: tx, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !tx) {
      // Fallback search by reference if metadata correlation fails
      const { data: fallbackTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("internal_reference", reference)
        .maybeSingle();
      
      if (!fallbackTx) {
        console.error("❌ [Webhook] Potential Orphaned Payment. No match for reference:", reference);
        // Important: Still return 200 to Paystack so they stop retrying, but log for admin.
        return res.status(200).send("Orphaned Payment Logged");
      }
      return processTransaction(fallbackTx, paystackData, res);
    }

    return processTransaction(tx, paystackData, res);

  } catch (error: any) {
    console.error("❌ [Webhook] Critical Failure:", error);
    return res.status(500).send("Webhook Error");
  }
}

async function processTransaction(tx: any, paystackData: any, res: any) {
  // 3. IDEMPOTENCY PROTECTION
  if (tx.status === 'fulfilled' || tx.status === 'fulfillment_processing' || tx.webhook_verified) {
    console.log(`♻️ [Idempotency] Transaction ${tx.id} already processed.`);
    return res.status(200).send("Already Processed");
  }

  console.log(`🚀 [StateMachine] Transitioning ${tx.id}: ${tx.status} -> payment_success`);

  // 4. UPDATE STATUS TO PAYMENT_SUCCESS
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "payment_success", // STATE MACHINE
      paystack_receipt: paystackData.reference,
      webhook_verified: true,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", tx.id);

  if (updateError) {
    console.error("❌ [Webhook] Failed to update payment status:", updateError);
    return res.status(500).send("DB Error");
  }

  // 5. QUEUE FULFILLMENT (IMMEDIATE EXECUTION IN THIS SERVERLESS CONTEXT)
  console.log("=== FULFILLMENT QUEUED ===");
  
  // Update state to processing before calling provider
  await supabase.from("transactions").update({ 
    status: "fulfillment_processing",
    vtu_status: "processing", // Legacy support
    updated_at: new Date().toISOString()
  }).eq("id", tx.id);

  try {
    // 6. TELECOM EXECUTION
    const result = await purchaseData({ ...tx, status: 'payment_success' }, "paystack_v2_webhook");
    
    if (result.success) {
      console.log("=== TRANSACTION COMPLETED ===");
      await supabase.from("transactions").update({ 
        status: "fulfilled", // FINAL STATE
        delivery_status: "delivered",
        vtu_status: "delivered",
        updated_at: new Date().toISOString()
      }).eq("id", tx.id);
    } else {
      console.error("❌ [Fulfillment] Telecom Provider Rejection:", result.error);
      await supabase.from("transactions").update({ 
        status: "failed",
        error_message: result.error,
        delivery_status: "failed",
        vtu_status: "failed",
        updated_at: new Date().toISOString()
      }).eq("id", tx.id);
    }
  } catch (error: any) {
    console.error("❌ [Fulfillment] Execution Unhandled Crash:", error);
    await supabase.from("transactions").update({ 
      status: "failed",
      error_message: "Fulfillment system crash: " + error.message,
      updated_at: new Date().toISOString()
    }).eq("id", tx.id);
  }

  return res.status(200).send("OK");
}
