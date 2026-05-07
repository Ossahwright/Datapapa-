import { supabase, sendSMS, buildSuccessSMS, syncWalletSilently, logWebhook } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside datahub-webhook");

export default async function handler(req: any, res: any) {
  console.log("datahub-webhook handler booted");
  let providerRef = "unknown";
  let payload: any = {};
  
  try {
    payload = req.body;
    const data = payload?.data || payload; 
    
    // 🔍 Extract reference with extreme fallback logic
    providerRef = data?.reference || data?.orderNumber || data?.external_reference || data?.client_reference || data?.request_id || payload?.reference || "unknown";

    console.log("WEBHOOK RECEIVED:", JSON.stringify(payload));

    if (!providerRef || providerRef === "unknown") {
      // Last ditch effort: scan entire payload for something that looks like our UUID
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const payloadString = JSON.stringify(payload);
      const match = payloadString.match(uuidRegex);
      if (match) {
        providerRef = match[0];
        console.log("🧩 [Webhook] Extracted UUID from payload body:", providerRef);
      }
    }

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
      console.warn("Transaction not found via reference:", providerRef);
      
      // 🔍 STEP 6: MULTI-STRATEGY RECONCILIATION
      // If no reference match, try matching by recipient + capacity proximity within last 30 mins
      const recipient = data?.recipient || data?.number || data?.phone;
      const amount = data?.amount || data?.volume || data?.plan;
      
      if (recipient) {
        console.log("🧩 [Reconciliation] Attempting proximity match for:", recipient);
        const normalizedRecipient = recipient.trim().replace(/\D/g, "").slice(-9); // Match last 9 digits
        
        const { data: proximityTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("vtu_status", "processing")
          .order("created_at", { ascending: false })
          .limit(10); // Check recent processing transactions
        
        const matched = proximityTx?.find(t => {
          const tRecipient = (t.recipient_phone || "").trim().replace(/\D/g, "").slice(-9);
          const isRecent = (Date.now() - new Date(t.created_at).getTime()) < 1800000; // 30 mins
          return tRecipient === normalizedRecipient && isRecent;
        });

        if (matched) {
          console.log("✅ [Reconciliation] Webhook matched via proximity for tx:", matched.id);
          tx = matched;
        }
      }

      if (!tx) {
        await logWebhook({ reference: providerRef, payload, status: 'ignored' });
        return res.status(200).json({ message: "Ignored" });
      }
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

