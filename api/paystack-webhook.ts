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
    // Check if the Vite bridge already parsed it early
    let rawBodyData = req.rawBody;
    
    if (!rawBodyData) {
      try {
        rawBodyData = await readRawBody(req);
      } catch (e) {
        console.warn("Could not read stream:", e);
      }
    }
    
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

    console.log("=== [Webhook] Auth Payment Success Event Verified ===");
    const paystackData = event.data;
    const reference = paystackData.reference;
    let metadata = paystackData.metadata;

    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch(e) { /* ignore */ }
    }

    // STEP 3 — IMPLEMENT DETERMINISTIC TRANSACTION LOOKUP
    // 🚀 Authoritative Transaction Identity Convergence
    const txId = metadata?.transaction_id || reference;

    console.log("=== [Webhook] Forensic Lookup Start ===");
    console.log("📍 Paystack Target UUID:", txId);
    console.log("📍 Paystack Event Reference:", reference);
    console.log("📍 Metadata ID:", metadata?.transaction_id);
    
    if (!txId) {
      console.error("❌ [Webhook] CRITICAL: No transaction identity found in payload.");
      return res.status(400).send("No transaction identity");
    }

    // Determine if txId is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txId);

    // Build the query dynamically to prevent 22P02 Postgres errors (invalid UUID syntax)
    let query = supabase.from("transactions").select("*");
    
    if (isUuid) {
      query = query.or(`id.eq."${txId}",external_reference.eq."${txId}",paystack_receipt.eq."${txId}"`);
    } else {
      query = query.or(`internal_reference.eq."${txId}",external_reference.eq."${txId}",paystack_receipt.eq."${txId}"`);
    }

    const { data: tx, error: lookupError } = await query.maybeSingle();

    if (lookupError || !tx) {
      console.error("❌ [Webhook] CRITICAL: Reconciler could not find transaction for identity:", txId);
      // Still return 200 to Paystack to stop retries, but this is a critical orphaned payment.
      return res.status(200).json({
        success: false,
        error: "Orphaned Payment: Transaction record not found"
      });
    }

    console.log(`✅ [Webhook] Authoritative Match Found: ${tx.id}`);
    console.log(`🚀 [Webhook] Handing off to processTransaction for UUID: ${tx.id}`);
    return processTransaction(tx, paystackData, res);

  } catch (error: any) {
    console.error("❌ [Webhook] Critical Failure:", error);
    return res.status(500).send("Webhook Execution Error: " + error.message);
  }
}

async function processTransaction(tx: any, paystackData: any, res: any) {
  // 🚀 STEP 1 — FORENSIC PRE-UPDATE LOGGING
  console.log("=== PRE-UPDATE TX STATE ===", {
    id: tx.id,
    status: tx.status,
    payment_status: tx.payment_status,
    external_reference: tx.external_reference
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

  // 🚀 STEP 2 — HARDEN PAYMENT UPDATE OPERATION
  const {
    data: promotedRows,
    error: updateError
  } = await supabase
    .from("transactions")
    .update({
      status: "success",
      payment_status: "success",
      external_reference: tx.id,
      webhook_verified: true,
      paystack_receipt: paystackData.reference || tx.id,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", tx.id)
    .select();

  const count = promotedRows ? promotedRows.length : 0;

  // 🚀 STEP 3 — IMPLEMENT STRICT UPDATE VERIFICATION
  console.log("=== PAYMENT UPDATE RESULT ===", {
    count,
    updateError,
    promotedRows
  });

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

  // 🚀 STEP 4 — AUTHORITATIVE DATABASE REFETCH
  const { data: updatedTx, error: refetchError } =
    await supabase
      .from("transactions")
      .select("*")
      .eq("id", tx.id)
      .single();

  if (refetchError || !updatedTx) {
    console.error("❌ [Webhook] Convergence Verification Failed:", refetchError);
    return res.status(500).json({
      error: "Database Verification Failed"
    });
  }

  // 🚀 STEP 5 — STRICT CONVERGENCE VALIDATION
  console.log("=== POST-UPDATE TX STATE ===", {
    id: updatedTx.id,
    status: updatedTx.status,
    payment_status: updatedTx.payment_status
  });

  if (
    updatedTx.payment_status !== "success" ||
    updatedTx.status !== "success"
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
