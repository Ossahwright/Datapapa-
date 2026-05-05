import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { callDataHubWithRetry } from '../lib/datahub';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bundle, phone, paystack_ref, transaction_id, payer_phone_number } = req.body;
  const finalTransactionId = transaction_id || paystack_ref;

  console.log(`💰 [API] PAYMENT SUCCESS: ${finalTransactionId}`);

  try {
    // 1. Fetch transaction
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', finalTransactionId)
      .single();

    if (txError || !txData) {
      console.error(`❌ [API] TRANSACTION NOT FOUND: ${finalTransactionId}`);
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Update payer phone if provided
    if (payer_phone_number) {
      await supabase.from('transactions').update({ payer_phone_number }).eq('id', txData.id);
    }

    // 2. Prepare payload for DataHub
    const networkMapping: Record<string, string> = {
      'mtn': 'YELLO',
      'telecel': 'TELECEL',
      'vodafone': 'TELECEL',
      'airteltigo': 'AT_PREMIUM',
      'at': 'AT_PREMIUM'
    };

    const rawNetwork = String(txData.network || "").toLowerCase();
    
    // Normalize DataHub payload explicitly
    const networkKey = txData.datahub_network_key || txData.network_key || networkMapping[rawNetwork] || txData.network;
    const recipient = String(txData.recipient_phone || "").replace(/\s+/g, '');
    const capacity = String(txData.datahub_capacity || txData.capacity || "").toUpperCase().replace("GB", "").trim();

    const datahubPayload = {
      networkKey,
      recipient,
      capacity,
      reference: String(txData.id)
    };

    console.log(`📱 [API] DATAHUB REQUEST ->`, JSON.stringify(datahubPayload));

    if (!recipient || !capacity || !networkKey) {
      console.error("❌ [API] Missing critical data for VTU:", { networkKey, recipient, capacity });
      return res.status(400).json({ success: false, error: 'Invalid transaction data for VTU' });
    }

    // Update status to processing
    await supabase.from('transactions').update({
      vtu_status: 'processing',
      status: 'success', 
      updated_at: new Date().toISOString()
    }).eq('id', txData.id);

    // 3. Call DataHub with Retry
    console.log("🚀 [API] SENDING DATAHUB REQUEST (WITH RETRY)");
    const dhResult = await callDataHubWithRetry(datahubPayload);

    console.log("📡 [API] DATAHUB SUCCESS:", JSON.stringify(dhResult));

    // Update with API response
    await supabase.from('transactions').update({
      api_response: dhResult,
      updated_at: new Date().toISOString()
    }).eq('id', txData.id);

    return res.status(200).json({ success: true, ...dhResult });
  } catch (err: any) {
    console.error("❌ [API] ERROR:", err.message);
    
    // Attempt to log failure to DB
    if (finalTransactionId) {
       await supabase.from('transactions').update({
        vtu_status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
      }).eq('id', finalTransactionId);
    }

    return res.status(500).json({ success: false, error: err.message });
  }
}
