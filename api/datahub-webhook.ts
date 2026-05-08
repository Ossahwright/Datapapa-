import { supabase, syncWalletSilently, logWebhook } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside datahub-webhook");

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`=== [${timestamp}] DATAHUB WEBHOOK BOOTED ===`);
  console.log("WEBHOOK METHOD:", req.method);
  console.log("WEBHOOK HEADERS:", JSON.stringify(req.headers));
  console.log("WEBHOOK USER-AGENT:", req.headers["user-agent"] || "unknown");
  console.log("WEBHOOK BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    console.log("⚠️ [Webhook] Ignoring non-POST request");
    return res.status(200).json({
      success: true,
      message: "DataHub webhook endpoint online"
    });
  }

  if (!req.body || typeof req.body !== "object") {
    console.error("❌ [Webhook] Invalid payload received");
    return res.status(400).json({
      success: false,
      error: "Invalid payload"
    });
  }
  let providerRef = "unknown";
  let payload: any = req.body;
  
  try {
    const data = payload?.data || payload; 
    
    // 🔍 Extract reference with extreme fallback logic
    providerRef = data?.reference || data?.orderNumber || data?.external_reference || data?.client_reference || data?.request_id || payload?.reference || "unknown";

    console.log("=== [Webhook] Reconciliation Audit Start ===");
    console.log("PROVIDER REFERENCE EXTRACTED:", providerRef);

    if (!providerRef || providerRef === "unknown") {
      // Last ditch effort: scan entire payload for something that looks like our UUID
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const payloadString = JSON.stringify(payload);
      const match = typeof payloadString === "string" ? payloadString.match(uuidRegex) : null;
      if (match) {
        providerRef = match[0];
        console.log("🧩 [Webhook] Extracted UUID from payload string scan:", providerRef);
      }
    }

    if (!providerRef || providerRef === "unknown") {
      console.warn("⚠️ [Webhook] No provider reference found in payload");
      await logWebhook({ reference: "unknown", payload, status: 'ignored' });
      return res.status(200).json({ message: "No reference found, skipping" });
    }

    // 🔍 Find transaction (try external_reference then id)
    let { data: tx, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .or(`external_reference.eq."${providerRef}",id.eq."${providerRef}"`)
      .maybeSingle();

    if (findError) {
      console.error("❌ [Webhook] Supabase find error:", findError.message);
      throw findError;
    }

    if (!tx) {
      console.warn("🔍 [Webhook] Transaction not found via direct reference:", providerRef);
      
      // 🔍 PROXIMITY RECONCILIATION
      const recipient = data?.recipient || data?.number || data?.phone;
      if (recipient) {
        const normalizedRecipient = String(recipient).trim().replace(/\D/g, "").slice(-9);
        console.log("🧩 [Reconciliation] Attempting proximity match for last 9 digits:", normalizedRecipient);
        
        const { data: recentTxs } = await supabase
          .from("transactions")
          .select("*")
          .eq("vtu_status", "processing")
          .order("created_at", { ascending: false })
          .limit(20);
        
        tx = recentTxs?.find(t => {
          const tRecipient = String(t.recipient_phone || "").trim().replace(/\D/g, "").slice(-9);
          const isRecent = (Date.now() - new Date(t.created_at).getTime()) < 3600000; // 1 hour
          return tRecipient === normalizedRecipient && isRecent;
        });

        if (tx) console.log("✅ [Reconciliation] Matched via proximity! TxId:", tx.id);
      }

      if (!tx) {
        console.error("❌ [Webhook] Reconciliation Failed: No matching transaction found.");
        await logWebhook({ reference: providerRef, payload, status: 'ignored' });
        return res.status(200).json({ message: "Transaction not found" });
      }
    }

    console.log("=== WEBHOOK CONVERGENCE START ===");
    console.log("Matched Transaction:", tx.id);
    console.log("Provider Reference:", providerRef);
    console.log("Current Local State:", { delivery: tx.delivery_status, vtu: tx.vtu_status });

    // 🚫 Idempotency: Never downgrade from a terminal success state
    if (tx.delivery_status === "delivered" || tx.vtu_status === "success") {
      console.log("✅ [Webhook] Transaction already fulfilled. Convergence complete. Skipping.");
      return res.status(200).json({ message: "Already fulfilled" });
    }

    const statusStr = String(data.status || payload.status || "").toUpperCase();
    console.log("Incoming Provider Status:", statusStr);

    const isSuccess = ["DELIVERED", "SUCCESS", "COMPLETED", "SUCCESSFUL"].includes(statusStr);
    const isFailed = ["FAILED", "REJECTED", "REVERSED", "CANCELLED"].includes(statusStr);

    if (!isSuccess && !isFailed) {
      console.log(`⏳ [Webhook] Intermediate state received (${statusStr}). Enforcing convergence...`);
      // Even for intermediate states, ensure we are in 'processing' to avoid 'failed' false positives
      if (tx.vtu_status !== 'processing') {
         await supabase.from("transactions").update({ vtu_status: 'processing', updated_at: timestamp }).eq("id", tx.id);
      }
      return res.status(200).json({ message: "Converged to processing" });
    }

    const deliveryStatus = isSuccess ? "delivered" : "failed";
    const vtuStatus = isSuccess ? "success" : "failed";

    console.log(`📝 [Webhook] Converging truth to: ${deliveryStatus}`);

    const { data: updatedRows, error: updateError } = await supabase
      .from("transactions")
      .update({
        delivery_status: deliveryStatus,
        vtu_status: vtuStatus,
        delivery_updated_at: timestamp,
        updated_at: timestamp,
        api_response: payload,
        external_reference: providerRef || tx.external_reference,
        error_message: isSuccess ? null : (data.message || data.error || "Provider reported failure")
      })
      .eq("id", tx.id)
      .select();

    if (updateError) {
      console.error("❌ [Webhook] Supabase Update Error (Possible RLS?):", updateError.message);
      console.log("RLS Error Details:", JSON.stringify(updateError));
      throw updateError;
    }

    console.log("DB Update Result: SUCCESS");
    console.log("Rows Updated:", updatedRows?.length || 0);
    console.log("=== WEBHOOK RECONCILIATION SUCCESS ===");

    await logWebhook({ reference: providerRef, payload, status: 'processed' });
    syncWalletSilently().catch(console.error);

    return res.status(200).json({ 
      success: true, 
      id: tx.id, 
      status: deliveryStatus 
    });

  } catch (error: any) {
    console.error("❌ [Webhook] Critical Failure:", error.message);
    if (providerRef) {
       await logWebhook({ reference: providerRef, payload, status: 'error' });
    }
    return res.status(500).json({ error: "Internal processing error" });
  }
}

