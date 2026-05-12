/**
 * 🛡️ PAYSTACK AUTHORITATIVE WEBHOOK (STABILIZED)
 * Responsibility: Handle payment verification and trigger fulfillment.
 * Path: api/paystack-webhook.ts -> /api/paystack-webhook
 */

import { supabase, purchaseData } from '../lib/server-utils.js';
import { PAYMENT_STATUSES, EXECUTION_SOURCES, RECONCILIATION_STATES, LOG_MARKERS } from '../lib/constants.js';
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
  console.log(LOG_MARKERS.PAYSTACK_WEBHOOK_HIT);
  
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

    // Priority 1: reference (Paystack reference is now our UUID)
    if (paystackReference) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", paystackReference)
        .maybeSingle();
      tx = data;
      if (tx) console.log(`=== TRANSACTION FOUND (Direct ID Match: ${tx.id}) ===`);
    }

    // Priority 2: metadata.transaction_id
    if (!tx && transactionIdFromMetadata) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionIdFromMetadata)
        .maybeSingle();
      tx = data;
      if (tx) console.log(`=== TRANSACTION FOUND (Metadata ID: ${tx.id}) ===`);
    }

    // Priority 3: internal_reference
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
  // 🚀 STEP 1 & 5 — IMPLEMENT FORENSIC STATE LOGGING
  console.log("=== PRE-UPDATE TRANSACTION STATE ===", {
    id: tx.id,
    status: tx.status,
    payment_status: tx.payment_status,
    vtu_status: tx.vtu_status
  });

  // STEP 10: IMPLEMENT WEBHOOK IDEMPOTENCY
  if (tx.payment_status === PAYMENT_STATUSES.SUCCESS && tx.provider_execution_started_at) {
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

  console.log(`🚀 [StateMachine] Transitioning ${tx.id}: ${tx.status} -> ${PAYMENT_STATUSES.SUCCESS}`);

  // 🚀 STEP 1 — AUTHORITATIVE WEBHOOK UPDATE (NO CONDITIONAL FILTERS)
  const { error: updateError, count } = await supabase
    .from("transactions")
    .update({
      status: PAYMENT_STATUSES.SUCCESS, 
      payment_status: PAYMENT_STATUSES.SUCCESS,
      webhook_verified: true,
      paystack_receipt: paystackData.reference,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { count: "exact" })
    .eq("id", tx.id);

  // 🚀 STEP 2 — VERIFY UPDATE ROW COUNT
  console.log("=== PAYMENT UPDATE ROW COUNT ===", count);

  if (updateError || count === 0) {
    console.error("❌ [Webhook] Payment convergence failed:", updateError || "Zero rows updated");
    
    // ESCALATION
    await supabase.from("transactions").update({ 
      reconciliation_state: RECONCILIATION_STATES.PAYMENT_VERIFICATION_FAILED,
      updated_at: new Date().toISOString()
    }).eq("id", tx.id);

    return res.status(500).json({
      error: "Payment Convergence Failed"
    });
  }

  // 🚀 STEP 3 — IMPLEMENT AUTHORITATIVE DB REFETCH
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

  // 🚀 STEP 4 & 5 — VALIDATE PAYMENT CONVERGENCE STRICTLY + FORENSIC LOGGING
  console.log("=== POST-UPDATE TRANSACTION STATE ===", {
    id: updatedTx.id,
    status: updatedTx.status,
    payment_status: updatedTx.payment_status
  });

  if (
    updatedTx.payment_status !== PAYMENT_STATUSES.SUCCESS ||
    updatedTx.status !== PAYMENT_STATUSES.SUCCESS
  ) {
    console.error("❌ [Webhook] AUTHORITATIVE CONVERGENCE MISMATCH", {
       status: updatedTx.status,
       payment_status: updatedTx.payment_status
    });
    
    // Escalate
    await supabase.from("transactions").update({ 
      reconciliation_state: RECONCILIATION_STATES.PAYMENT_VERIFICATION_FAILED,
      updated_at: new Date().toISOString()
    }).eq("id", tx.id);

    return res.status(500).json({
      error: "Convergence Validation Failed"
    });
  }

  console.log("=== AUTHORITATIVE PAYMENT CONVERGENCE VERIFIED ===", {
    status: updatedTx.status,
    payment_status: updatedTx.payment_status
  });

  console.log(LOG_MARKERS.PAYMENT_PROMOTED);
  
  try {
    // 🚀 STEP 9 & 10: Provider execution starts only after success
    const result = await purchaseData(updatedTx, EXECUTION_SOURCES.PAYSTACK_WEBHOOK);
    
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
        reconciliation_state: RECONCILIATION_STATES.PAYMENT_VERIFIED_EXECUTION_FAILED,
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
      reconciliation_state: RECONCILIATION_STATES.PAYMENT_VERIFIED_EXECUTION_FAILED,
      error_message: "Fulfillment system crash: " + error.message,
      updated_at: new Date().toISOString()
    }).eq("id", tx.id);
    return res.status(200).json({
      success: false,
      message: "Payment Processed, Execution Crashed Managed"
    });
  }
}
