import { supabase, purchaseData, syncWalletSilently, apiClient } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside purchase-data");

export default async function handler(req: any, res: any) {
  console.log("purchase-data handler booted");
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { paystack_ref, transaction_id, payer_phone_number } = req.body;
    const finalTransactionId = transaction_id || paystack_ref;

    if (!finalTransactionId) {
      return res.status(400).json({ error: 'Missing transaction ID' });
    }

    console.log(`💰 [API] PURCHASE ROUTE TRIGGERED for: ${finalTransactionId}`);
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
    // 🛡️ SPEED OPTIMIZATION: If pending, check Paystack Truth directly to avoid waiting for webhook
    let finalTxData = txData;
    if (txData.status === "pending") {
      console.log("⏳ [API] Transaction pending. Verifying with Paystack directly for speed...");
      try {
        const psRes = await supabase.from('transactions').select('paystack_receipt').eq('id', finalTransactionId).single();
        const receipt = txData.paystack_receipt || psRes.data?.paystack_receipt;
        
        if (receipt) {
          const { data: psVerify } = await apiClient.get(`https://api.paystack.co/transaction/verify/${receipt}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
          });
          
          if (psVerify?.data?.status === "success") {
            console.log("✅ [API] Paystack confirms success. Self-promoting for speed.");
            const { data: promoted } = await supabase
              .from('transactions')
              .update({ 
                status: 'success', 
                payment_verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString() 
              })
              .eq('id', finalTransactionId)
              .select()
              .single();
            if (promoted) finalTxData = promoted;
          }
        }
      } catch (err) {
        console.error("Paystack direct verify failed in purchase-data logic:", err);
      }
      
      // Fallback: If still pending after direct check, wait a tiny bit (max 1s) as a safety buffer
      if (finalTxData.status === "pending") {
        await new Promise(r => setTimeout(r, 800));
        const { data: refreshedTx } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', finalTransactionId)
          .single();
        if (refreshedTx) finalTxData = refreshedTx;
      }
    }

    if (finalTxData.status === "pending") {
      console.warn("⚠️ [API] Transaction still pending after wait. Webhook might be slow.");
      return res.status(200).json({ 
        success: true, 
        message: "Payment verification in progress. Orders are processed automatically once payment is confirmed.",
        vtu_status: "pending",
        trace_id: finalTransactionId
      });
    }

    if (finalTxData.status !== "success") {
      console.error(`❌ [API] Safety Block: Status is ${finalTxData.status}. Expected success.`);
      return res.status(400).json({ success: false, error: `Payment not confirmed (${finalTxData.status})` });
    }

    console.log("=== API TRIGGERING purchaseData ===");
    const result = await purchaseData(finalTxData, "direct_api");

    console.log("DataHub purchase result", result);

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
