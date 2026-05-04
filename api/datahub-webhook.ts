import { supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const payload = req.body;
    console.log("🔔 [DataHub] WEBHOOK RECEIVED", JSON.stringify(payload));
    const { event, data } = payload;
    
    console.log("[DataHub Webhook] Event:", event);

    if (event === 'order.status_updated') {
      const status = data.status; // PROCESSING, SUCCESSFUL, FAILED
      let vtuStatus = status === 'SUCCESSFUL' ? 'delivered' : (status === 'FAILED' ? 'failed' : 'processing');

      if (status === "SUCCESSFUL") {
        console.log("✅ [DataHub Webhook] Delivery successful");
      }

      const txRef = data.reference || data.orderNumber;
      
      let updateQuery = supabase.from('transactions').update({ 
        vtu_status: vtuStatus,
        api_response: payload 
      });

      if (txRef) {
        updateQuery = updateQuery.or(`api_response->>reference.eq.${txRef},api_response->>orderNumber.eq.${txRef}`);
      } else if (data.recipient) {
        updateQuery = updateQuery.eq('recipient_phone', data.recipient).or('vtu_status.eq.processing,vtu_status.eq.success');
      }

      const { data: updated, error: updateErr } = await updateQuery.select();
      
      if (!updateErr && updated && updated.length > 0) {
        const trans = updated[0];
        if (vtuStatus === 'delivered' && trans.recipient_phone) {
          const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
          const settings = settingsData?.value || {};
          
          if (settings.sms_enabled !== false) {
            const message = buildSuccessSMS({
              volume: trans.capacity,
              network: trans.network,
              phone: trans.recipient_phone,
              transactionId: trans.id,
              template: settings.sms_template_success
            });

            console.log("🚀 [DataHub Webhook] Sending SMS");
            await sendSMS(trans.recipient_phone, message, "Datapapa");
            await sendSMS(
              process.env.ADMIN_PHONE || "233244014207",
              `SENT: ${trans.capacity} ${trans.network} to ${trans.recipient_phone}. Ref: ${txRef || trans.id}`,
              "Datapapa"
            );
          }
        }
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
