import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { sendSMS, buildSmsMessage } from '../lib/sms';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const payload = req.body;
    console.log("🔔 [WEBHOOK RECEIVED]", JSON.stringify(payload));
    const { event, data } = payload;
    
    if (event === 'order.status_updated') {
      const status = String(data.status).toUpperCase(); // PROCESSING, SUCCESSFUL, FAILED
      const txRef = data.reference || data.orderNumber;
      
      console.log(`📡 [Webhook] Processing Ref: ${txRef}, Status: ${status}`);

      let vtuStatus = 'processing';
      if (status === 'SUCCESSFUL' || status === 'COMPLETED' || status === 'DELIVERED') vtuStatus = 'delivered';
      if (status === 'FAILED' || status === 'REJECTED') vtuStatus = 'failed';

      // 1. Update Transaction Status
      let updateQuery = supabase.from('transactions').update({ 
        vtu_status: vtuStatus,
        updated_at: new Date().toISOString(),
        api_response: payload // Store last webhook payload
      });

      if (txRef) {
        updateQuery = updateQuery.or(`api_response->>reference.eq.${txRef},api_response->>orderNumber.eq.${txRef},id.eq.${txRef}`);
      } else if (data.recipient) {
        updateQuery = updateQuery.eq('recipient_phone', data.recipient).eq('vtu_status', 'processing');
      }

      const { data: updated, error: updateErr } = await updateQuery.select();
      
      if (updateErr) {
        console.error("❌ [Webhook] Supabase Update Error:", updateErr.message);
      }

      if (!updateErr && updated && updated.length > 0) {
        const trans = updated[0];
        console.log(`✅ [Webhook] Transaction ${trans.id} updated to ${vtuStatus}`);

        // 2. Trigger SMS ONLY on SUCCESSFUL delivery
        if (vtuStatus === 'delivered' && trans.recipient_phone) {
          const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
          const settings = settingsData?.value || {};
          
          if (settings.sms_enabled !== false) {
            const message = buildSmsMessage({
              capacity: trans.capacity,
              network: trans.network,
              phone: trans.recipient_phone
            });

            console.log(`🚀 [Webhook] SENDING SMS TO ${trans.recipient_phone}`);
            const smsRes = await sendSMS(trans.recipient_phone, message, "Datapapa");
            
            // Log SMS status
            await supabase.from('transactions').update({
                sms_status: smsRes.success ? 'sent' : 'failed',
                sms_response: smsRes
            }).eq('id', trans.id);
            
            console.log("📡 [SMS Response]:", JSON.stringify(smsRes));

            // Optional Admin Alert
            if (process.env.ADMIN_PHONE) {
               await sendSMS(process.env.ADMIN_PHONE, `SUCCESS: ${trans.capacity} ${trans.network} to ${trans.recipient_phone}`, "Datapapa");
            }
          }
        } else if (vtuStatus === 'failed') {
          console.warn(`⚠️ [Webhook] Delivery FAILED for ${trans.id}`);
          // Update status if needed
          await supabase.from('transactions').update({
             status: 'failed',
             error_message: data.status_message || "Delivery failed via webhook"
          }).eq('id', trans.id);
        }
      } else {
        console.warn(`⚠️ [Webhook] No matching transaction found for ref: ${txRef}`);
      }
    }
    
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ [Webhook] Fatal Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
