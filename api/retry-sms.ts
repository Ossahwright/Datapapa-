import { supabase, sendSMS, buildSuccessSMS } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    console.log(`[RetrySMS] Manual trigger for ID: ${transactionId}`);
    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // 🛡️ Safety: Only retry if delivery is actually successful
    const isDelivered = (tx.delivery_status === 'delivered' || tx.vtu_status === 'success' || tx.vtu_status === 'delivered');
    if (!isDelivered) {
      return res.status(400).json({ success: false, error: 'Transaction not in a delivered state' });
    }

    // 🛡️ Safety: Don't duplicate if already sent
    if (tx.sms_status === 'sent') {
      return res.json({ success: true, message: 'SMS already sent' });
    }

    const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
    const settings = settingsData?.value || {};

    const message = buildSuccessSMS({
      volume: tx.capacity || "data",
      network: tx.network || "provider",
      phone: tx.recipient_phone,
      transactionId: tx.id,
      template: settings.sms_template_success
    });

    console.log(`🚀 [RetrySMS] Resending SMS to: ${tx.recipient_phone} for TX ${tx.id}`);
    
    const smsResult = await sendSMS(tx.recipient_phone, message);
    
    const isSmsSuccess = smsResult && (
      smsResult.status === 'success' || 
      String(smsResult).includes('1000') ||
      smsResult.code === 1000 ||
      smsResult.code === '1000'
    );

    await supabase
      .from('transactions')
      .update({
        sms_status: isSmsSuccess ? 'sent' : 'failed',
        sms_response: smsResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', tx.id);

    if (isSmsSuccess) {
      return res.json({ success: true, message: 'SMS sent successfully' });
    } else {
      return res.status(500).json({ success: false, error: 'SMS API returned failure', details: smsResult });
    }

  } catch (err: any) {
    console.error(`[RetrySMS] FATAL ERROR for ${transactionId}:`, err);
    return res.status(500).json({ success: false, error: "Retry failed", message: err.message });
  }
}
