import { supabase, purchaseData, syncWalletSilently, apiClient } from '../lib/server-utils.js';
import { PAYMENT_STATUSES, VTU_STATUSES, EXECUTION_SOURCES, API_ROUTES, LOG_MARKERS } from '../lib/constants.js';

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

    console.log(`📍 [API] Transaction found for UUID: ${txData.id}`);
    console.log(`📍 [API] Reference: ${txData.reference}, Amount: ${txData.amount}`);
    console.log(`📍 [API] Current State: status=${txData.status}, vtu_status=${txData.vtu_status}`);

    if (txData.status === VTU_STATUSES.FULFILLMENT_PROCESSING || txData.status === VTU_STATUSES.FULFILLED || txData.vtu_status === VTU_STATUSES.DELIVERED) {
      console.log(`♻️ [API] Idempotency: Transaction ${finalTransactionId} already processing or completed. Skipping.`);
      return res.json({ 
        success: true, 
        message: "Already processing or completed",
        status: txData.status 
      });
    }

    if ((txData.status === PAYMENT_STATUSES.PAYMENT_SUCCESS || txData.status === PAYMENT_STATUSES.SUCCESS) && txData.status !== VTU_STATUSES.FULFILLED) {
      // Re-trigger fulfillment if needed
      console.log("♻️ [API] Payment confirmed but not fulfilled. Proceeding...");
    }

    // Update payer phone if provided
    if (payer_phone_number) {
      await supabase.from('transactions').update({ payer_phone_number }).eq('id', txData.id);
    }

    // Use the unified logic from server-utils.ts
    // 🛡️ SPEED OPTIMIZATION: If initialized, check Paystack Truth directly to avoid waiting for webhook
    let finalTxData = txData;
    if (txData.status === PAYMENT_STATUSES.INITIALIZED || txData.status === PAYMENT_STATUSES.PAYMENT_PENDING) {
      console.log("⏳ [API] Transaction in early state. Verifying with Paystack directly for speed...");
      try {
        const psRes = await supabase.from('transactions').select('paystack_receipt').eq('id', finalTransactionId).single();
        const receipt = txData.paystack_receipt || psRes.data?.paystack_receipt;
        
        if (receipt) {
          const { data: psVerify } = await apiClient.get(`https://api.paystack.co/transaction/verify/${receipt}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
          });
          
          if (psVerify?.data?.status === PAYMENT_STATUSES.SUCCESS) {
            console.log("✅ [API] Paystack confirms success. Self-promoting for speed.");
            const { data: promoted } = await supabase
              .from('transactions')
              .update({ 
                status: PAYMENT_STATUSES.SUCCESS,
                payment_status: PAYMENT_STATUSES.SUCCESS,
                webhook_verified: true,
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
      
      // Fallback: If still not success after direct check, wait a tiny bit (max 1s) as a safety buffer
      if (finalTxData.status === PAYMENT_STATUSES.INITIALIZED) {
        await new Promise(r => setTimeout(r, 800));
        const { data: refreshedTx } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', finalTransactionId)
          .single();
        if (refreshedTx) finalTxData = refreshedTx;
      }
    }

    if (finalTxData.status === PAYMENT_STATUSES.INITIALIZED || finalTxData.status === PAYMENT_STATUSES.PAYMENT_PENDING) {
      console.warn("⚠️ [API] Transaction still pending after wait. Webhook might be slow.");
      return res.status(200).json({ 
        success: true, 
        message: "Payment verification in progress. Orders are processed automatically once payment is confirmed.",
        status: finalTxData.status,
        trace_id: finalTransactionId
      });
    }

    const isConfirmed = finalTxData.status === PAYMENT_STATUSES.PAYMENT_SUCCESS || finalTxData.status === PAYMENT_STATUSES.SUCCESS || finalTxData.status === VTU_STATUSES.FULFILLMENT_PROCESSING || finalTxData.status === VTU_STATUSES.FULFILLED;
    if (!isConfirmed) {
      console.error(`❌ [API] Safety Block: Status is ${finalTxData.status}. Expected payment confirmation.`);
      return res.status(400).json({ success: false, error: `Payment not confirmed (${finalTxData.status})` });
    }

    console.log("=== API TRIGGERING purchaseData ===");
    
    // 🚀 STEP 9 — IMPLEMENT PURCHASE SAFETY GATING
    try {
      const healthRes = await fetch(`http://localhost:3000${API_ROUTES.PROVIDER_HEALTH}`);
      if (healthRes.ok) {
        const health = await healthRes.json();
        if (health.status === "outage") {
          console.error(LOG_MARKERS.PURCHASE_GATING_ACTIVATED);
          return res.status(503).json({ 
            success: false, 
            error: "Data provider currently experiencing issues. Purchases temporarily paused.",
            retry_after: 60
          });
        }
      }
    } catch (e) {
      console.warn("⚠️ [API] Health check failed, proceeding with caution:", e);
    }

    const result = await purchaseData(finalTxData, EXECUTION_SOURCES.DIRECT_API);

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
