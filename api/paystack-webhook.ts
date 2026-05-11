/**
 * 🛡️ PAYSTACK AUTHORITATIVE WEBHOOK (STABILIZED)
 * Responsibility: Handle payment verification and trigger fulfillment.
 * Path: api/paystack-webhook.ts -> /api/paystack-webhook
 */

import { supabase, purchaseData } from '../lib/server-utils.js';
import crypto from 'crypto';

// 🛡️ Vercel Config: Need the raw body for Paystack signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read the raw body from the request stream
async function readRawBody(req: any): Promise<string> {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: any, res: any) {
  console.log("=== PAYSTACK WEBHOOK ROUTE HIT ===");
  
  // SUPPORTED METHODS ONLY
  if (req.method !== 'POST') {
    console.warn(`⚠️ [Webhook] Method ${req.method} not allowed`);
    return res.status(405).json({
      error: "Method not allowed. Webhook requires POST."
    });
  }

  const timestamp = new Date().toISOString();
  console.log(`=== [${timestamp}] PAYSTACK WEBHOOK RECEIVED ===`);

  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ [Webhook] Missing PAYSTACK_SECRET_KEY");
      return res.status(500).send("Misconfigured Server: Missing Secret Key");
    }

    // STEP 5 — VERIFY RAW BODY HANDLING
    // We read the raw body once and use it for both signature and JSON parsing
    const rawBodyData = await readRawBody(req);
    
    if (!rawBodyData) {
      console.error("❌ [Webhook] Empty Body Received");
      return res.status(400).send("Empty Payload");
    }

    // STEP 2 — VERIFY PAYSTACK SIGNATURE AUTHORITATIVELY
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(rawBodyData)
      .digest("hex");

    if (hash !== signature) {
      console.error("❌ [Webhook] INVALID PAYSTACK SIGNATURE");
      return res.status(401).send("Invalid Signature");
    }
    console.log("=== PAYSTACK SIGNATURE VERIFIED ===");

    // Parse the body now that we verified the signature
    let event: any;
    try {
      event = JSON.parse(rawBodyData);
    } catch (e: any) {
      console.error("❌ [Webhook] Failed to parse JSON:", e.message);
      return res.status(400).send("Invalid JSON");
    }

    // STEP 1 — HARDEN PAYSTACK WEBHOOK ENTRYPOINT
    if (!event.event || !event.data) {
      console.error("❌ [Webhook] Malformed Payload Structure");
      return res.status(400).send("Malformed Payload Structure");
    }

    if (event.event !== "charge.success") {
      console.log(`ℹ️ [Webhook] Ignoring event: ${event.event}`);
      return res.status(200).json({
        success: true,
        message: "Event ignored"
      });
    }

    console.log("=== PAYMENT VERIFIED ===");
    const paystackData = event.data;
    const reference = paystackData.reference;
    let metadata = paystackData.metadata;

    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch(e) { /* ignore */ }
    }

    // STEP 3 — IMPLEMENT DETERMINISTIC TRANSACTION LOOKUP
    console.log("=== TRANSACTION LOOKUP START ===");
    const transactionIdFromMetadata = metadata?.transaction_id;
    const paystackReference = reference;
    
    let tx = null;

    // Priority 1: metadata.transaction_id
    if (transactionIdFromMetadata) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionIdFromMetadata)
        .maybeSingle();
      tx = data;
      if (tx) console.log(`=== TRANSACTION FOUND (Metadata ID: ${tx.id}) ===`);
    }

    // Priority 2: paystack_receipt (matching reference)
    if (!tx && paystackReference) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("paystack_receipt", paystackReference)
        .maybeSingle();
      tx = data;
      if (tx) console.log(`=== TRANSACTION FOUND (Paystack RefMatch ID: ${tx.id}) ===`);
    }

    // Priority 3: reference (internal_reference)
    if (!tx && paystackReference) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("internal_reference", paystackReference)
        .maybeSingle();
      tx = data;
      if (tx) console.log(`=== TRANSACTION FOUND (Internal RefMatch ID: ${tx.id}) ===`);
    }

    if (!tx) {
      console.error("=== TRANSACTION NOT FOUND ===");
      console.error("❌ [Webhook] Potential Orphaned Payment. No match for reference:", reference);
      // Important: Still return 200 to Paystack so they stop retrying, but log for admin.
      return res.status(200).json({
        success: false,
        error: "Orphaned Payment Logged"
      });
    }

    return processTransaction(tx, paystackData, res);

  } catch (error: any) {
    console.error("❌ [Webhook] Critical Failure:", error);
    return res.status(500).send("Webhook Execution Error: " + error.message);
  }
}

async function processTransaction(tx: any, paystackData: any, res: any) {
  // STEP 10: IMPLEMENT WEBHOOK IDEMPOTENCY
  if (tx.payment_status === "success" && tx.provider_execution_started_at) {
    console.log(`♻️ === DUPLICATE WEBHOOK IGNORED (Tx: ${tx.id}) ===`);
    return res.status(200).json({
      success: true,
      message: "Already Processed"
    });
  }

  // If already fulfilled, definitely ignore
  if (tx.status === 'fulfilled' || tx.vtu_status === 'delivered') {
    console.log(`♻️ [Idempotency] Transaction ${tx.id} already fulfilled.`);
    return res.status(200).json({
      success: true,
      message: "Already Processed"
    });
  }

  console.log(`🚀 [StateMachine] Transitioning ${tx.id}: ${tx.status} -> success`);

  // STEP 4: STRICT PAYMENT STATUS PROMOTION
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "success", // AUTHORITATIVE PROMOTION
      payment_status: "success",
      paystack_receipt: paystackData.reference,
      webhook_verified: true,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", tx.id)
    .in("status", ["initialized", "payment_pending", "pending"]); // Allow pending too for safety

  if (updateError) {
    console.error("❌ [Webhook] Failed to update payment status:", updateError);
    return res.status(500).json({
      error: "DB Error"
    });
  }

  // STEP 5: VERIFY DATABASE PERSISTENCE (STRICT RE-FETCH)
  const { data: updatedTx, error: verifyError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', tx.id)
    .single();

  if (verifyError || !updatedTx) {
    console.error("❌ [Webhook] Convergence Verification Failed:", verifyError);
    return res.status(500).json({
      error: "Database Verification Failed"
    });
  }

  console.log("=== PAYMENT STATUS PROMOTED ===");
  console.log(`Validated Status: ${updatedTx.payment_status} | Status: ${updatedTx.status}`);

  // STEP 6: AUTOMATIC VTU EXECUTION
  console.log("=== VTU EXECUTION STARTED ===");
  
  try {
    // purchaseData handles its own atomicity for fulfillment_processing
    const result = await purchaseData(updatedTx, "paystack_v2_webhook");
    
    if (result.success) {
      console.log("=== TRANSACTION COMPLETED (SUCCESS) ===");
      return res.status(200).json({
        success: true,
        message: "OK"
      });
    } else {
      console.error("❌ [Webhook] VTU Execution Failed:", result.error);
      // STEP 11: Persist failures safely
      await supabase.from("transactions").update({ 
        reconciliation_state: "payment_verified_execution_failed",
        error_message: result.error,
        updated_at: new Date().toISOString()
      }).eq("id", tx.id);
      return res.status(200).json({
        success: false,
        message: "Payment Processed, VTU Failed Managed"
      });
    }
  } catch (error: any) {
    console.error("❌ [Webhook] Critical VTU Unhandled Crash:", error);
    await supabase.from("transactions").update({ 
      reconciliation_state: "payment_verified_execution_failed",
      error_message: "Fulfillment system crash: " + error.message,
      updated_at: new Date().toISOString()
    }).eq("id", tx.id);
    return res.status(200).json({
      success: false,
      message: "Payment Processed, Execution Crashed Managed"
    });
  }
}
