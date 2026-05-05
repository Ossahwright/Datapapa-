import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase';
import { sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("🔔 [WEBHOOK RECEIVED] ATTEMPTING TO PROCESS");
  
  // Return early for non-POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    console.log("📦 [WEBHOOK PAYLOAD]", JSON.stringify(payload));
    
    // Extract event and data per requirement
    const { event, data } = payload;

    if (!payload || !event) {
      console.warn("⚠️ [Webhook] Received empty or invalid payload");
      return res.status(200).json({ success: false, message: "Invalid payload" });
    }

    // Validate event type
    if (event === "order.status_updated") {
      const status = String(data?.status || "").toUpperCase(); // SUCCESSFUL, FAILED, PROCESSING, etc.
      const reference = data?.reference || data?.orderNumber;
      const phoneNumber = data?.phoneNumber || data?.recipient; // Use phoneNumber as primary as per spec
      
      console.log(`📡 [Webhook] Processing event: ${event} | Status: ${status} | Ref: ${reference}`);

      if (!reference) {
        console.error("❌ [Webhook] Missing reference in payload");
        return res.status(200).json({ success: false, message: "Missing reference" });
      }

      // Map to internal vtu_status
      let vtu_status = 'processing';
      if (status === 'SUCCESSFUL') vtu_status = 'delivered';
      if (status === 'FAILED' || status === 'REJECTED') vtu_status = 'failed';

      // 1. Update Transaction in DB
      // We try both ID (UUID) and a possible reference_id column if it exists
      const { data: txUpdate, error: txError } = await supabase
        .from('transactions')
        .update({
          vtu_status,
          api_response: payload,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq."${reference}",reference_id.eq."${reference}"`)
        .select()
        .single();

      if (txError) {
        console.error("❌ [Webhook] Database update failed:", txError.message);
      }

      const transaction = txUpdate;

      if (!transaction) {
        console.warn(`⚠️ [Webhook] No matching transaction found in database for ref: ${reference}`);
      }

      // 2. Trigger SMS ONLY on SUCCESSFUL delivery and ONLY if not already sent
      if (status === "SUCCESSFUL" && transaction?.sms_status !== 'sent') {
        console.log(`✅ [Webhook] DELIVERY SUCCESS! Preparing SMS for ${reference}...`);
        
        // Gather variables for SMS
        const capacity = transaction?.capacity || data?.capacity || data?.plan || "data";
        const network = transaction?.network || data?.network || "provider";
        const recipient = phoneNumber || transaction?.recipient_phone;

        if (recipient) {
          const message = buildSuccessSMS({
            volume: String(capacity),
            network: String(network),
            phone: String(recipient),
            transactionId: String(reference)
          });

          console.log("🚀 [Webhook] SENDING SMS to", recipient);
          console.log("💬 [Webhook] Message Content:", message);

          try {
            const smsResult = await sendSMS(recipient, message, "Datapapa");
            console.log("📡 [Webhook] SMS Response:", JSON.stringify(smsResult));

            // 3. Log SMS status to database
            if (transaction) {
              const isSmsSuccess = smsResult && (
                smsResult.status === 'success' || 
                String(smsResult).includes('1000') ||
                smsResult.code === 1000 ||
                smsResult.code === '1000'
              );
              
              await supabase.from('transactions').update({
                sms_status: isSmsSuccess ? 'sent' : 'failed',
                sms_response: smsResult
              }).eq('id', transaction.id);
            }
          } catch (smsErr) {
            console.error("❌ [Webhook] SMS sending failed:", smsErr);
          }
        } else {
          console.error("❌ [Webhook] Missing phone number for SMS notification");
        }
      } else {
         console.log(`ℹ️ [Webhook] Skipping SMS. Status: ${status} | SMS Status: ${transaction?.sms_status}`);
         
         // If failed, ensure error message is updated
         if (vtu_status === 'failed' && transaction) {
            await supabase.from('transactions').update({
              error_message: data?.status_message || data?.error || "Delivery failed via webhook"
            }).eq('id', transaction.id);
         }
      }
    } else {
      console.log(`ℹ️ [Webhook] Ignoring unhandled event: ${event}`);
    }

    // Always return 200 within 10 seconds as required
    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (err: any) {
    console.error("❌ [Webhook] Fatal Error:", err.message);
    // Still return 200 to acknowledge receipt and prevent DataHub retry loops if desired
    return res.status(200).json({ success: false, error: err.message });
  }
}
