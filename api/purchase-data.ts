import { purchaseData, supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { networkKey, recipient, capacity, transaction_id } = req.body;

  console.log(`[API] Purchase Data Request: ${transaction_id} for ${recipient}`);

  try {
    // 1. Fetch transaction details if only ID is provided
    let transaction = req.body;
    if (transaction_id && !recipient) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transaction_id)
        .single();
      
      if (error || !data) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      transaction = data;
    }

    if (!transaction.recipient_phone) {
      return res.status(400).json({ success: false, error: 'Target phone missing' });
    }

    // 2. Perform Data Purchase
    const result = await purchaseData(transaction);

    // 3. If successful, trigger SMS
    const isActuallyDelivered = result.success && (result.status === 'SUCCESSFUL' || result.vtu_status === 'success' || result.status === 'delivered');

    if (isActuallyDelivered) {
      try {
        // Fetch settings for SMS template
        const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
        const settings = settingsData?.value || {};
        
        if (settings.sms_enabled !== false) {
          const message = buildSuccessSMS({
            volume: transaction.capacity,
            network: transaction.network,
            phone: transaction.recipient_phone,
            transactionId: transaction.id,
            template: settings.sms_template_success
          });

          await sendSMS(transaction.recipient_phone, message);
          
          // Notify Admin
          await sendSMS(
            process.env.ADMIN_PHONE || "233244014207",
            `Datapapa ✅: ${transaction.capacity} ${transaction.network} to ${transaction.recipient_phone}. Ref: ${transaction.id}`
          );
        }
      } catch (smsErr) {
        console.error("[API] Post-purchase SMS failure:", smsErr);
      }
    }

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    console.error("[API] Purchase Data Fatal Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
