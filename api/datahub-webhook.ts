import { supabase, sendSMS, buildSuccessSMS, syncWalletSilently, logWebhook } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  const payload = req.body;
  const data = payload?.data || payload; 
  const providerRef = data.reference || data.orderNumber || data.external_reference;

  try {
    console.log("WEBHOOK RECEIVED:", JSON.stringify(payload));

    if (!providerRef) {
      await logWebhook({ reference: "unknown", payload, status: 'ignored' });
      return res.status(200).json({ message: "No reference, ignored" });
    }

    // 🔍 Find transaction (try external_reference then id)
    let { data: tx, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .eq("external_reference", providerRef)
      .maybeSingle();

    if (!tx && !findError) {
       // Try matching by internal ID if provider sends it back in reference
       const { data: txById, error: findByIdError } = await supabase
         .from("transactions")
         .select("*")
         .eq("id", providerRef)
         .maybeSingle();
       
       tx = txById;
       findError = findByIdError;
    }

    if (findError) throw findError;

    if (!tx) {
      console.warn("Transaction not found:", providerRef);
      await logWebhook({ reference: providerRef, payload, status: 'ignored' });
      return res.status(200).json({ message: "Ignored" });
    }

    console.log("MATCHED TX:", tx.id);

    // 🚫 Prevent duplication
    if (tx.delivery_status === "delivered") {
      await logWebhook({ reference: providerRef, payload, status: 'ignored' });
      return res.status(200).json({ message: "Already delivered" });
    }

    const statusStr = String(data.status || "").toLowerCase();
    const isSuccess =
      statusStr === "delivered" ||
      statusStr === "success" ||
      statusStr === "completed" ||
      statusStr === "successful";

    const isFailed = 
      statusStr === "failed" || 
      statusStr === "rejected" || 
      statusStr === "reversed";

    if (!isSuccess && !isFailed) {
      // It might be "PENDING" or "PROCESSING" - don't mark as delivered/failed yet
      await logWebhook({ reference: providerRef, payload, status: 'ignored' });
      return res.status(200).json({ message: "Still processing" });
    }

    const deliveryStatus = isSuccess ? "delivered" : "failed";
    console.log("DELIVERY STATUS:", deliveryStatus);

    // 📝 Update database first
    const { error: updateError } = await supabase.from("transactions").update({
      delivery_status: deliveryStatus,
      vtu_status: isSuccess ? "success" : "failed",
      delivery_updated_at: new Date().toISOString(),
      api_response: payload,
      error_message: isSuccess ? null : (data.message || data.error || "Delivery failed")
    }).eq("id", tx.id);

    if (updateError) throw updateError;

    // 🔥 Trigger SMS (only if delivered and not sent)
    if (isSuccess && tx.sms_status !== "sent") {
      try {
        const message = buildSuccessSMS({
          volume: tx.capacity || "data",
          network: tx.network || "provider",
          phone: tx.recipient_phone,
          transactionId: tx.id
        });

        console.log("🚀 Sending SMS to:", tx.recipient_phone);
        const smsResult = await sendSMS(tx.recipient_phone, message);

        await supabase
          .from("transactions")
          .update({ 
            sms_status: "sent",
            sms_response: smsResult 
          })
          .eq("id", tx.id);

      } catch (err: any) {
        console.error("SMS ERROR:", err.message);
        await supabase
          .from("transactions")
          .update({ sms_status: "failed" })
          .eq("id", tx.id);
      }
    }

    await logWebhook({ reference: providerRef, payload, status: 'processed' });

    // 🔄 background wallet sync
    syncWalletSilently().catch(console.error);

    return res.status(200).json({ 
      success: true, 
      id: tx.id, 
      status: deliveryStatus 
    });

  } catch (error: any) {
    console.error("❌ [Webhook] Fatal Error:", error.message);
    if (providerRef) {
       await logWebhook({ reference: providerRef, payload, status: 'error' });
    }
    return res.status(200).json({ error: "Processing failed" });
  }
}

