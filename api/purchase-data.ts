import { supabase, purchaseData, syncWalletSilently } from '../lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paystack_ref, transaction_id, payer_phone_number } = req.body;
  const finalTransactionId = transaction_id || paystack_ref;

  if (!finalTransactionId) {
    return res.status(400).json({ error: 'Missing transaction ID' });
  }

  console.log(`💰 [API] PURCHASE ROUTE TRIGGERED for: ${finalTransactionId}`);

  try {
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', finalTransactionId)
      .single();

    if (txError || !txData) {
      console.error(`❌ [API] TRANSACTION NOT FOUND: ${finalTransactionId}`);
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (txData.status === "processing") {
      return res.json({ message: "Already processing" });
    }

    if (txData.status === "success") {
      return res.json({ message: "Already completed" });
    }

    // Update payer phone if provided
    if (payer_phone_number) {
      await supabase.from('transactions').update({ payer_phone_number }).eq('id', txData.id);
    }

    // Use the unified logic from server-utils.ts
    // 🛡️ RACE CONDITION PROTECTION: If status is still pending, wait a moment and re-fetch 
    // to see if the webhook has finished processing.
    let finalTxData = txData;
    if (txData.status === "pending") {
      console.log("⏳ [API] Transaction pending. Waiting for webhook sync...");
      await new Promise(r => setTimeout(r, 2000));
      const { data: refreshedTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', finalTransactionId)
        .single();
      if (refreshedTx) finalTxData = refreshedTx;
    }

    if (finalTxData.status === "pending") {
      console.warn("⚠️ [API] Transaction still pending after wait. Webhook might be slow. Purchase will be handled by webhook once payment is confirmed.");
      return res.status(200).json({ 
        success: true, 
        message: "Payment verification in progress. Orders are processed automatically once payment is confirmed.",
        vtu_status: "pending",
        trace_id: finalTransactionId
      });
    }

    console.log("=== API TRIGGERING purchaseData ===");
    const result = await purchaseData(finalTxData, "direct_api");

    console.log("DataHub purchase result", result);

    if (result.success) {
      if (!finalTransactionId) {
        console.error("Missing finalTransactionId");
      }

      const providerReference = result.data?.reference || result.data?.id || result.reference;
      
      if (!providerReference) {
        console.error("Missing providerReference");
      }

      const updatePayload: any = {
        api_status: "success",
        delivery_status: "processing"
      };

      // Only set external_reference if we received one AND we don't already have one
      if (providerReference && !txData.external_reference) {
        updatePayload.external_reference = providerReference;
      }

      console.log("Updating transaction with SERVICE ROLE permissions", {
        transaction_id: txData.id,
        providerReference,
        updatePayload
      });

      const { data: updatedTx, error: updateError } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", txData.id)
        .select();

      console.log("Transaction update result", {
        updatedTx,
        updateError
      });
    }

    // Sync wallet in background
    syncWalletSilently().catch(console.error);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }

  } catch (error: any) {
    console.error("PURCHASE ERROR:", error);
    syncWalletSilently().catch(console.error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
