import { supabase, sendSMS, syncWalletSilently, purchaseData } from '../lib/server-utils';
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
    if (!transactionId) {
      console.log("No transaction ID in metadata");
      return res.status(200).send("no transaction id");
    }

    // FETCH TRANSACTION
    const { data: transaction, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    const tx = transaction;
    console.log("Transaction Lookup Result:", {
      transactionId: tx?.id,
      reference: tx?.reference,
      phone: tx?.phone,
      error: findError
    });

    if (findError || !transaction) {
      return res.status(200).send("transaction not found");
    }

    // 🛡️ HARDENED WEBHOOK IDEMPOTENCY (STEP 5)
    if (
      transaction.status === "paid" || 
      transaction.status === "success" ||
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
    await supabase
      .from("transactions")
      .update({
        paystack_receipt: paystackReference,
        payer_phone_number: customerPhone || transaction.payer_phone_number,
        status: "paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    // 📩 CUSTOMER SMS: PAYMENT RECEIVED
    await sendSMS(
      transaction.recipient_phone,
      `Datapapa: Your order is being processed for ${transaction.recipient_phone}.`
    );

    // TRIGGER VTU
    console.log("=== ABOUT TO TRIGGER DATAHUB PURCHASE ===");
    console.log({
      transactionId: tx?.id,
      network: tx?.network,
      phone: tx?.phone || tx?.recipient_phone,
      bundle: tx?.plan_name || tx?.capacity
    });

    try {
      const result = await purchaseData(transaction);
      console.log("DataHub purchase response", result);
      
      if (result?.success) {
        // 📩 CUSTOMER SMS: SUCCESS
        const successMsg = `Datapapa: ${transaction.capacity} ${transaction.network} data sent to ${transaction.recipient_phone}. Ref: ${transaction.id}`;
        const smsResponse = await sendSMS(transaction.recipient_phone, successMsg);
        
        // Update transaction to show SMS was sent
        await supabase
          .from("transactions")
          .update({ 
            sms_status: "sent",
            sms_response: smsResponse,
            updated_at: new Date().toISOString()
          })
          .eq("id", transaction.id);
      }
    } catch (error) {
       console.error("DataHub purchase trigger failed", error);
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ [Webhook] Error:", err.message);
    return res.status(200).send("error");
  }
}
