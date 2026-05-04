import { supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const payload = req.body;
    console.log("🔔 [DataHub] WEBHOOK RECEIVED", JSON.stringify(payload));
    const { event, data } = payload;
    
    console.log("[DataHub Webhook] Event:", event);

    if (event === 'order.status_updated') {
      const status = String(data.status).toUpperCase(); // PROCESSING, SUCCESSFUL, FAILED
      console.log(`[DataHub Webhook] Order: ${data.reference} | New Status: ${status}`);

      let vtuStatus = 'processing';
      if (status === 'SUCCESSFUL' || status === 'COMPLETED' || status === 'DELIVERED') vtuStatus = 'delivered';
      if (status === 'FAILED' || status === 'REJECTED') vtuStatus = 'failed';

      const txRef = data.reference || data.orderNumber;
      
      let updateQuery = supabase.from('transactions').update({ 
        vtu_status: vtuStatus,
        updated_at: new Date().toISOString(),
        api_response: payload
      });

      if (txRef) {
        updateQuery = updateQuery.or(`api_response->>reference.eq.${txRef},api_response->>orderNumber.eq.${txRef},id.eq.${txRef}`);
      } else if (data.recipient) {
        updateQuery = updateQuery.eq('recipient_phone', data.recipient).eq('vtu_status', 'processing');
      }

      const { data: updated, error: updateErr } = await updateQuery.select();
      
      if (updateErr) {
        console.error("[DataHub Webhook] DB Update Error:", updateErr.message);
      }

      if (!updateErr && updated && updated.length > 0) {
        const trans = updated[0];
        console.log(`✅ [DataHub Webhook] Transaction updated: ${trans.id} to ${vtuStatus}`);

        if (vtuStatus === 'delivered' && trans.recipient_phone) {
          const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
          const settings = settingsData?.value || {};
          
          if (settings.sms_enabled !== false) {
            const message = buildSuccessSMS({
              volume: trans.capacity,
              network: trans.network,
              phone: trans.recipient_phone,
              transactionId: trans.id
            });

            console.log(`🚀 [DataHub Webhook] Sending SMS to ${trans.recipient_phone}`);
            const smsRes = await sendSMS(trans.recipient_phone, message, "Datapapa");
            console.log("📡 [SMS Response]:", JSON.stringify(smsRes));

            if (process.env.ADMIN_PHONE) {
               await sendSMS(process.env.ADMIN_PHONE, `SENT: ${trans.capacity} ${trans.network} to ${trans.recipient_phone}`, "Datapapa");
            }
          }
        }
      } else {
        console.warn(`⚠️ [DataHub Webhook] No matching transaction found for ref: ${txRef}`);
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
