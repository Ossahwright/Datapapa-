import { purchaseData, supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    const { data: transaction, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const vtuResult = await purchaseData(transaction);
    
    // Delivery check - improved to handle various success strings
    const isActuallyDelivered = vtuResult.success === true || (
      vtuResult.status?.toUpperCase() === 'SUCCESSFUL' || 
      vtuResult.status?.toUpperCase() === 'SUCCESS' ||
      vtuResult.status?.toUpperCase() === 'DELIVERED' ||
      vtuResult.status?.toUpperCase() === 'COMPLETED' ||
      vtuResult.vtu_status === 'success'
    );

    if (isActuallyDelivered && transaction.recipient_phone) {
      try {
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
          
          await sendSMS(
            process.env.ADMIN_PHONE || "233244014207",
            `Datapapa: ${transaction.capacity} ${transaction.network} to ${transaction.recipient_phone}. Ref: ${transaction.id}`
          );
        }
      } catch (smsErr) {
        console.error("Post-trigger SMS failure:", smsErr);
      }
    }

    return res.json({
      ...vtuResult,
      message: vtuResult.success ? "VTU Delivery Triggered Successfully" : `VTU Failed: ${vtuResult.error || "Unknown Error"}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
