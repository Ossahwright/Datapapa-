import { supabase, sendSMS, syncWalletSilently, purchaseData } from '../lib/server-utils.js';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ Missing PAYSTACK_SECRET_KEY");
      return res.status(200).send("env missing");
    }

    // SIGNATURE VERIFICATION
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      console.error("❌ [Webhook] Invalid signature");
      return res.status(401).send("invalid signature");
    }

    const event = req.body;
    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    const paystackReference = event.data?.reference;
    const customerPhone = event.data?.customer?.phone;
    let metadata = event.data?.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { console.error("❌ Metadata parse failed"); }
    }

    const transactionId = metadata?.transaction_id;
    if (!transactionId) {
      return res.status(200).send("no transaction id");
    }

    // FETCH TRANSACTION
    const { data: transaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchErr || !transaction) {
      return res.status(200).send("transaction not found");
    }

    // IDEMPOTENCY CHECK
    if (transaction.status === "paid" || transaction.vtu_status === "success") {
      return res.status(200).send("already processed");
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
    console.log("🚀 [Webhook] Triggering purchaseData for:", transactionId);
    const result = await purchaseData(transaction);
    
    if (result?.success) {
      // 📩 CUSTOMER SMS: SUCCESS
      await sendSMS(
        transaction.recipient_phone,
        `Datapapa: ${transaction.capacity} ${transaction.network} data sent to ${transaction.recipient_phone}. Ref: ${transaction.id}`
      );
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ [Webhook] Error:", err.message);
    return res.status(200).send("error");
  }
}
