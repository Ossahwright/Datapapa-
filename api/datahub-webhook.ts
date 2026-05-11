import { supabase, syncWalletSilently, logWebhook, sendTelegramNotification } from '../lib/server-utils.js';
import { VTU_STATUSES, RECONCILIATION_STATES, LOG_MARKERS } from '../lib/constants.js';

console.log("server-utils loaded successfully inside datahub-webhook");

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`=== [${timestamp}] DATAHUB WEBHOOK BOOTED ===`);
  console.log("=== WEBHOOK RECEIVED ===");
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

    console.log(`=== WEBHOOK RECONCILIATION ===`);
    if (!providerRef || providerRef === "unknown") {
      console.warn("⚠️ [Webhook] No provider reference found in payload");
      await logWebhook({ reference: "unknown", payload, status: 'ignored' });
      return res.status(200).json({ message: "No reference found, skipping" });
    }

    // 🔍 Find transaction Priority
    // 1. provider_reference exact match
    // 2. external_reference match (fallback)
    // 3. internal_reference / id exact match
    
    let { data: tx, error: findError } = await supabase
      .from("transactions")
      .select("*")
      .or(`provider_reference.eq."${providerRef}",external_reference.eq."${providerRef}",internal_reference.eq."${providerRef}",id.eq."${providerRef}"`)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error("❌ [Webhook] Supabase find error:", findError.message);
      throw findError;
    }

    if (!tx) {
      console.warn("🔍 [Webhook] Transaction not found via direct reference:", providerRef);
      
      // 🔍 PROXIMITY RECONCILIATION (Emergency Only)
      const recipient = data?.recipient || data?.number || data?.phone;
      if (recipient) {
        const normalizedRecipient = String(recipient).trim().replace(/\D/g, "").slice(-9);
        console.log("🧩 [Reconciliation] EMERGENCY proximity match for last 9 digits:", normalizedRecipient);
        
        const { data: recentTxs } = await supabase
          .from("transactions")
          .select("*")
          .in("vtu_status", [
            VTU_STATUSES.PROVIDER_EXECUTION_STARTED, 
            VTU_STATUSES.PROVIDER_ACCEPTED, 
            VTU_STATUSES.AWAITING_PROVIDER_CONFIRMATION, 
            VTU_STATUSES.RECONCILIATION_PENDING, 
            VTU_STATUSES.DELAYED_PROVIDER_PROCESSING
          ])
          .order("created_at", { ascending: false })
          .limit(20);
        
        tx = recentTxs?.find(t => {
          const tRecipient = String(t.recipient_phone || "").trim().replace(/\D/g, "").slice(-9);
          const isRecent = (Date.now() - new Date(t.created_at).getTime()) < 3600000; // 1 hour
          return tRecipient === normalizedRecipient && isRecent;
        });

        if (tx) {
           console.log("✅ [Reconciliation] EMERGENCY proximity matched! TxId:", tx.id);
        }
      }

      if (!tx) {
        console.error("❌ [Webhook] Reconciliation Failed: No matching transaction found.");
        await logWebhook({ reference: providerRef, payload, status: 'ignored' });
        return res.status(200).json({ message: "Transaction not found" });
      }
    }
    
    console.log(`=== PROVIDER TRUTH MATCH ===`);
    console.log(`Matched Tx ID: ${tx.id}`);

    console.log("=== STATE CONVERGENCE ===");
    console.log("Matched Transaction:", tx.id);
    console.log("Provider Reference:", providerRef);
    console.log("Current Local State:", { delivery: tx.delivery_status, vtu: tx.vtu_status });

    // 🚫 Idempotency: Never downgrade from a terminal success state
    if (tx.delivery_status === VTU_STATUSES.DELIVERED || tx.vtu_status === VTU_STATUSES.DELIVERED) {
      console.log("✅ [Webhook] Transaction already fulfilled. Convergence complete. Skipping.");
      return res.status(200).json({ message: "Already fulfilled" });
    }

    const statusStr = String(data.status || payload.status || "").toUpperCase();
    console.log("Incoming Provider Status:", statusStr);

    const isSuccess = ["DELIVERED", "SUCCESS", "COMPLETED", "SUCCESSFUL"].includes(statusStr);
    const isFailed = ["FAILED", "REJECTED", "REVERSED", "CANCELLED", "ERROR"].includes(statusStr);

    if (!isSuccess && !isFailed) {
      console.log(`=== PROVIDER ACCEPTED ===`);
      console.log(`⏳ [Webhook] Intermediate state received (${statusStr}). Enforcing convergence...`);
      // Even for intermediate states, ensure we are in a valid waiting state
      if (![VTU_STATUSES.PROVIDER_ACCEPTED, VTU_STATUSES.AWAITING_PROVIDER_CONFIRMATION, VTU_STATUSES.RECONCILIATION_PENDING].includes(tx.vtu_status)) {
         await supabase.from("transactions").update({ 
           vtu_status: VTU_STATUSES.AWAITING_PROVIDER_CONFIRMATION, 
           reconciliation_state: RECONCILIATION_STATES.AWAITING_PROVIDER_CONFIRMATION,
           updated_at: timestamp 
         }).eq("id", tx.id);
      }
      return res.status(200).json({ message: "Converged to waiting" });
    }

    console.log(`=== DELIVERY CONFIRMATION RECEIVED ===`);
    console.log("Provider Payload:", JSON.stringify(payload));

    const deliveryStatus = isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.FAILED;
    const vtuStatus = isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.PROVIDER_REJECTED;
    const reconciliationState = isSuccess ? RECONCILIATION_STATES.COMPLETED : RECONCILIATION_STATES.FAILED;

    console.log(LOG_MARKERS.DELIVERY_CONFIRMED);
    console.log(timestamp);

    const { data: updatedRows, error: updateError } = await supabase
      .from("transactions")
      .update({
        delivery_status: deliveryStatus,
        vtu_status: vtuStatus,
        reconciliation_state: reconciliationState,
        delivery_updated_at: timestamp,
        delivered_at: isSuccess ? timestamp : null, 
        reconciliation_completed_at: isSuccess ? timestamp : null,
        updated_at: timestamp,
        api_response: payload,
        external_reference: providerRef || tx.external_reference,
        error_message: isSuccess ? null : (data.message || data.error || "Provider reported failure")
      })
      .eq("id", tx.id)
      .select();

    if (updateError) {
      console.error("❌ [Webhook] Supabase Update Error:", updateError.message);
      throw updateError;
    }

    if (isSuccess) {
      console.log('=== VTU STATUS UPDATED TO DELIVERED ===');
      // 📱 TRIGGER TELEGRAM ALERT (Non-blocking)
      if (updatedRows && updatedRows[0]) {
        sendTelegramNotification(updatedRows[0]).catch(err => {
          console.error("❌ [Telegram Trigger] Failed:", err.message);
        });
      }
    } else {
      console.log('=== VTU STATUS UPDATED TO REJECTED ===');
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

