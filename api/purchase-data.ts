import { supabase, purchaseData, syncWalletSilently } from '../lib/server-utils.js';

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
    const result = await purchaseData(txData);

    if (result.success) {
      const providerReference = result.data?.reference || result.data?.id || result.reference;
      
      const updatePayload: any = {
        api_status: "success",
        delivery_status: "processing"
      };

      // Only set external_reference if we received one AND we don't already have one
      if (providerReference && !txData.external_reference) {
        updatePayload.external_reference = providerReference;
      }

      await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", finalTransactionId);
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
