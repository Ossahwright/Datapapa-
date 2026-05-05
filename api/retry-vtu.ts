import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { callDataHubWithRetry } from '../lib/datahub';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    console.log(`[RetryVTU] Triggered for ID: ${transactionId}`);
    const { data: transaction, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const networkMapping: Record<string, string> = {
      'mtn': 'YELLO',
      'telecel': 'TELECEL',
      'vodafone': 'TELECEL',
      'airteltigo': 'AT_PREMIUM',
      'at': 'AT_PREMIUM'
    };

    const rawNetwork = String(transaction.network || "").toLowerCase();
    const networkKey = transaction.datahub_network_key || transaction.network_key || networkMapping[rawNetwork] || transaction.network;
    const recipient = String(transaction.recipient_phone || "").replace(/\s+/g, '');
    const capacity = String(transaction.datahub_capacity || transaction.capacity || "").toUpperCase().replace("GB", "").trim();

    const datahubPayload = {
      networkKey,
      recipient,
      capacity,
      reference: String(transaction.id)
    };

    console.log(`[RetryVTU] Calling DataHub (Retry) for ID: ${transaction.id}`);
    
    // Update status to processing first
    await supabase.from('transactions').update({
        vtu_status: 'processing',
        updated_at: new Date().toISOString(),
        retry_count: (transaction.retry_count || 0) + 1
    }).eq('id', transaction.id);

    const vtuResult = await callDataHubWithRetry(datahubPayload);

    // Update with API response
    await supabase.from('transactions').update({
      api_response: vtuResult,
      updated_at: new Date().toISOString()
    }).eq('id', transaction.id);

    // SMS if successful
    const isSuccess = vtuResult.status?.toUpperCase() === 'SUCCESSFUL' || 
                      vtuResult.status?.toUpperCase() === 'DELIVERED' ||
                      vtuResult.success === true;

    if (isSuccess) {
      try {
        await supabase.from('transactions').update({ vtu_status: 'delivered' }).eq('id', transaction.id);
        
        const { sendSMS, buildSuccessSMS } = await import('../src/lib/server-utils');
        const message = buildSuccessSMS({
          volume: transaction.capacity,
          network: transaction.network,
          phone: transaction.recipient_phone,
          transactionId: transaction.id
        });

        const smsRes = await sendSMS(transaction.recipient_phone, message);
        const smsSuccess = smsRes && (smsRes.status === 'success' || String(smsRes).includes('1000'));
        
        await supabase.from('transactions').update({
          sms_status: smsSuccess ? 'sent' : 'failed'
        }).eq('id', transaction.id);
      } catch (e) {
        console.error("Retry SMS Error:", e);
      }
    }

    return res.json({
      success: true,
      ...vtuResult,
      message: "VTU Delivery Re-triggered Successfully"
    });
  } catch (err: any) {
    console.error(`[RetryVTU] FATAL ERROR for ${transactionId}:`, err);
    
    await supabase.from('transactions').update({
        vtu_status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
    }).eq('id', transactionId);

    return res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
}
