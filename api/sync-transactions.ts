import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { queryDataHubStatus } from '../lib/datahub';
import { sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch processing or pending transactions that are paid
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .or('vtu_status.eq.processing,vtu_status.eq.pending')
      .eq('status', 'success') // or 'paid'
      .order('created_at', { ascending: false })
      .limit(20);

    if (fetchError) throw fetchError;
    if (!transactions || transactions.length === 0) {
      return res.status(200).json({ message: 'No transactions to sync' });
    }

    const results = [];

    for (const tx of transactions) {
      try {
        console.log(`🔗 [Sync] Checking status for ${tx.id}`);
        const statusData = await queryDataHubStatus(tx.id);
        console.log(`📡 [Sync] Status for ${tx.id}:`, JSON.stringify(statusData));

        const isDelivered = statusData?.status?.toUpperCase() === 'SUCCESSFUL' || 
                            statusData?.status?.toUpperCase() === 'DELIVERED' ||
                            statusData?.status === 'true' ||
                            statusData?.success === true;
                            
        const isFailed = statusData?.status?.toUpperCase() === 'FAILED' || 
                         statusData?.status?.toUpperCase() === 'REJECTED';

        if (isDelivered) {
          // Update to success
          await supabase.from('transactions').update({
            vtu_status: 'delivered',
            api_response: statusData,
            updated_at: new Date().toISOString()
          }).eq('id', tx.id);

          // SEND SMS IF NOT ALREADY SENT
          if (tx.sms_status !== 'sent') {
            const message = buildSuccessSMS({
              volume: tx.capacity,
              network: tx.network,
              phone: tx.recipient_phone,
              transactionId: tx.id
            });

            const smsRes = await sendSMS(tx.recipient_phone, message);
            const smsSuccess = smsRes && (smsRes.status === 'success' || String(smsRes).includes('1000'));
            
            await supabase.from('transactions').update({
              sms_status: smsSuccess ? 'sent' : 'failed'
            }).eq('id', tx.id);
          }

          results.push({ id: tx.id, status: 'delivered' });
        } else if (isFailed) {
          await supabase.from('transactions').update({
            vtu_status: 'failed',
            api_response: statusData,
            error_message: statusData?.message || 'Failed at provider',
            updated_at: new Date().toISOString()
          }).eq('id', tx.id);
          results.push({ id: tx.id, status: 'failed' });
        } else {
          results.push({ id: tx.id, status: 'still_processing' });
        }
      } catch (err: any) {
        console.error(`❌ [Sync] Error syncing ${tx.id}:`, err.message);
        results.push({ id: tx.id, status: 'error', message: err.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err: any) {
    console.error("❌ [Sync API] Global Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
