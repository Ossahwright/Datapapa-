import { supabase, syncWalletSilently, logWebhook, normalizeProviderDeliveryStatus } from '../lib/server-utils.js';
import { sendTelegramNotification } from '../lib/sendTelegramNotification.js';
import { VTU_STATUSES, RECONCILIATION_STATES, LOG_MARKERS } from '../lib/constants.js';

console.log("server-utils loaded successfully inside datahub-webhook");

export default async function handler(req: any, res: any) {
  const timestamp = new Date().toISOString();
  console.log(`=== [${timestamp}] DATAHUB WEBHOOK BOOTED ===`);
  console.log("=== WEBHOOK RECEIVED ===");
  console.log("WEBHOOK BODY:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(200).json({ success: true, message: "Endpoint online" });
  }

  let payload = req.body;
  let providerRef = "unknown";
  
  try {
    const data = payload?.data || payload; 
    providerRef = data?.reference || data?.orderNumber || data?.external_reference || data?.client_reference || data?.request_id || payload?.reference || "unknown";

    if (providerRef === "unknown") {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = JSON.stringify(payload).match(uuidRegex);
      if (match) providerRef = match[0];
    }

    if (providerRef === "unknown") {
      await logWebhook({ reference: "unknown", payload, status: 'ignored' });
      return res.status(200).json({ message: "No reference found" });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerRef);
    let query = supabase.from("transactions").select("*");
    if (isUuid) {
      query = query.or(`provider_reference.eq.${providerRef},external_reference.eq.${providerRef},internal_reference.eq.${providerRef},id.eq.${providerRef}`);
    } else {
      query = query.or(`provider_reference.eq.${providerRef},external_reference.eq.${providerRef},internal_reference.eq.${providerRef}`);
    }

    let { data: tx, error: findError } = await query.maybeSingle();
    if (!tx) {
      console.warn("🔍 [Webhook] Transaction not found via direct reference:", providerRef);
      await logWebhook({ reference: providerRef, payload, status: 'ignored' });
      return res.status(200).json({ message: "Transaction not found" });
    }

    console.log(`=== PROVIDER DELIVERY RECONCILIATION START ===`);
    console.log(`Matched Tx ID: ${tx.id}`);
    
    // Idempotency
    if (tx.delivery_status === VTU_STATUSES.DELIVERED) {
      console.log("✅ [Webhook] Transaction already delivered. Skipping.");
      return res.status(200).json({ message: "Already delivered" });
    }

    const rawStatus = data.status || payload.status || "";
    const normalized = normalizeProviderDeliveryStatus(rawStatus);

    console.log("=== DATAHUB DELIVERY RESPONSE ===", payload);
    console.log("=== NORMALIZED DELIVERY STATUS ===", normalized);

    if (normalized === "processing") {
      console.log(`⏳ [Webhook] Intermediate state: ${rawStatus}. Staying in awaiting confirmation.`);
      return res.status(200).json({ message: "Acknowledged intermediate state" });
    }

    const isSuccess = normalized === "delivered";
    const deliveryStatus = isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.FAILED;
    const vtuStatus = isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.PROVIDER_REJECTED;
    const finalStatus = isSuccess ? VTU_STATUSES.FULFILLED : tx.status; // Keep existing status if failed, or update if we have a failure status

    if (isSuccess) {
      console.log("=== TRANSACTION PROMOTED TO DELIVERED ===");
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("transactions")
      .update({
        status: finalStatus,
        delivery_status: deliveryStatus,
        vtu_status: vtuStatus,
        reconciliation_state: RECONCILIATION_STATES.COMPLETED,
        delivery_updated_at: timestamp,
        updated_at: timestamp,
        api_response: payload,
        external_reference: providerRef || tx.external_reference,
        error_message: isSuccess ? null : (data.message || data.error || "Provider reported failure")
      })
      .eq("id", tx.id)
      .select();

    if (updateError) throw updateError;

    // Trigger Notifications
    if (isSuccess) {
      sendTelegramNotification({ category: 'vtu_delivered', title: 'VTU Delivered via Webhook', transaction: updatedRows![0] }).catch(console.error);
    } else {
      sendTelegramNotification({ category: 'vtu_failed', title: 'VTU Failed via Webhook', transaction: updatedRows![0], metadata: { error: data?.message || data?.error || "Provider reported failure" } }).catch(console.error);
    }

    await logWebhook({ reference: providerRef, payload, status: 'processed' });
    syncWalletSilently().catch(console.error);

    return res.status(200).json({ success: true, id: tx.id, status: deliveryStatus });

  } catch (error: any) {
    console.error("❌ [Webhook] Failure:", error.message);
    if (providerRef) await logWebhook({ reference: providerRef, payload, status: 'error' });
    return res.status(200).json({ error: error.message }); // Return 200 to acknowledge webhook receipt even if processing failed internally
  }
}

