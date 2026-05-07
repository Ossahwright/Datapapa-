/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * Handles transactional execution pipeline for Paystack Webhooks.
 * Unauthorized modifications may break live purchases.
 * 
 * Flow: Paystack -> verification -> status update -> DataHub purchase -> delivery update
 */

import { supabase, sendSMS, syncWalletSilently, purchaseData } from '../lib/server-utils.js';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  console.log("=== PAYSTACK WEBHOOK HIT ===");
  console.log("Method:", req.method);
  console.log("Timestamp:", new Date().toISOString());

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ Missing PAYSTACK_SECRET_KEY");
      return res.status(200).send("env missing");
    }

    console.log("Paystack webhook received", {
      event: req.body?.event,
      reference: req.body?.data?.reference
    });

    // SIGNATURE VERIFICATION
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    const isValidSignature = hash === signature;
    console.log("Signature Valid:", isValidSignature);

    if (!isValidSignature) {
      console.error("❌ [Webhook] Invalid signature");
      return res.status(401).send("invalid signature");
    }

    const event = req.body;
    console.log("Webhook Event:", event);
    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    console.log("Paystack payment verified successfully");

    const paystackReference = event.data?.reference;
    const customerPhone = event.data?.customer?.phone;
    let metadata = event.data?.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { console.error("❌ Metadata parse failed"); }
    }

    const transactionId = metadata?.transaction_id;
    console.log("=== TRANSACTION IDENTIFICATION ===");
    console.log("TRANSACTION ID FROM METADATA:", transactionId);
    console.log("PAYSTACK REF:", paystackReference);

    if (!transactionId) {
      console.log("❌ No transaction ID in metadata");
      return res.status(200).send("no transaction id");
    }

    // FETCH TRANSACTION
    console.log("=== FETCHING TRANSACTION FROM DB ===");
    const { data: transaction, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (findError || !transaction) {
      console.error("❌ Transaction not found:", transactionId);
      return res.status(200).send("transaction not found");
    }

    console.log("TRANSACTION FOUND:", {
      id: transaction.id,
      current_status: transaction.status,
      current_vtu: transaction.vtu_status,
      ext_ref: transaction.external_reference
    });

    // 🛡️ HARDENED WEBHOOK IDEMPOTENCY (STEP 5)
    console.log("=== CHECKING WEBHOOK IDEMPOTENCY ===");
    if (
      transaction.status === "paid" || 
      transaction.status === "success" ||
      transaction.status === "completed" ||
      transaction.vtu_status === "success" || 
      transaction.vtu_status === "completed" ||
      transaction.vtu_status === "processing" || 
      transaction.external_reference
    ) {
      console.log("♻️ [Webhook] Duplicate webhook or already processed transaction ignored:", {
        id: transaction.id,
        status: transaction.status,
        vtu_status: transaction.vtu_status,
        external_reference: transaction.external_reference
      });
      return res.status(200).json({ 
        ignored: true, 
        message: "Duplicate or already processed" 
      });
    }

    // UPDATE STATUS TO PAID
    console.log("=== UPDATING STATUS TO PAID ===");
    const { error: updateErr } = await supabase
      .from("transactions")
      .update({
        paystack_receipt: paystackReference,
        payer_phone_number: customerPhone || transaction.payer_phone_number,
        status: "paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    if (updateErr) {
      console.error("❌ Failed to update status to paid:", updateErr);
      throw new Error("Local DB update failed before provider execution");
    }

    console.log("=== RE-FETCHING FRESH TRANSACTION ===");
    const { data: updatedTransaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction.id)
      .single();

    if (fetchErr || !updatedTransaction) {
      console.error("❌ Failed to refetch updated transaction:", fetchErr);
      throw new Error("Transaction refetch failed after payment update");
    }

    console.log("=== FRESH STATE LOADED ===");
    console.log({
      id: updatedTransaction.id,
      status: updatedTransaction.status,
      vtu_status: updatedTransaction.vtu_status,
      updated_at: updatedTransaction.updated_at
    });

    // 📩 CUSTOMER SMS: PAYMENT RECEIVED
    console.log("=== SENDING PAYMENT CONFIRMATION SMS ===");
    await sendSMS(
      updatedTransaction.recipient_phone,
      `Datapapa: Your order is being processed for ${updatedTransaction.recipient_phone}.`
    );

    // TRIGGER VTU
    console.log("=== TRIGGERING DATAHUB PURCHASE ===");
    try {
      const result = await purchaseData(updatedTransaction, "paystack_webhook");
      console.log("=== PURCHASE EXECUTION RESULT ===");
      console.log(JSON.stringify(result, null, 2));
      
      if (result?.success) {
        // 📩 CUSTOMER SMS: SUCCESS
        const successMsg = `Datapapa: ${updatedTransaction.capacity} ${updatedTransaction.network} data sent to ${updatedTransaction.recipient_phone}. Ref: ${updatedTransaction.id}`;
        console.log("=== SENDING DELIVERY SUCCESS SMS ===");
        const smsResponse = await sendSMS(updatedTransaction.recipient_phone, successMsg);
        
        // Update transaction to show SMS was sent
        await supabase
          .from("transactions")
          .update({ 
            sms_status: "sent",
            sms_response: smsResponse,
            updated_at: new Date().toISOString()
          })
          .eq("id", updatedTransaction.id);
      }
    } catch (error: any) {
       console.error("=== DATAHUB PURCHASE FAILED ===");
       console.error(error.message);
    }

    return res.status(200).send("ok");
  } catch (error: any) {
    console.error("❌ [Webhook] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}
