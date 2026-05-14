import { Request, Response } from 'express';
import { supabaseAdmin, purchaseData, logWebhook } from '../lib/server-utils.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, rewardId } = req.body;
    
    // Auth Check
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Admin Role Check
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && user.email !== 'wrightossah@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (action === 'approve_reward') {
      if (!rewardId) {
        return res.status(400).json({ error: 'Missing rewardId' });
      }

      // Fetch Reward Details
      const { data: reward, error: fetchErr } = await supabaseAdmin
        .from('appreciation_rewards')
        .select('*')
        .eq('id', rewardId)
        .eq('status', 'pending_approval')
        .single();
        
      if (fetchErr || !reward) {
        return res.status(404).json({ error: 'Reward not found or already processed' });
      }

      const phoneNumber = reward.customer_phone;
      const network = reward.network.toLowerCase();
      
      // Look up appropriate 1GB bundle
      const { data: bundles, error: bundleErr } = await supabaseAdmin
        .from('bundles')
        .select('*')
        .eq('network_key', network)
        .eq('is_active', true);
        
      if (bundleErr || !bundles || bundles.length === 0) {
        return res.status(400).json({ error: 'No active bundles found for ' + network });
      }
      
      // Find 1GB
      let targetBundle = bundles.find(b => b.capacity === '1 GB' || b.capacity === '1GB');
      
      if (!targetBundle) {
        targetBundle = bundles[0]; // fallback
      }

      // Mark as sending
      await supabaseAdmin.from('appreciation_rewards').update({
        status: 'sending',
        approved_by: user.email,
        updated_at: new Date().toISOString()
      }).eq('id', rewardId);

      // We'll mimic the purchaseData flow but with 0 amount and internal reference
      
      const { data: transaction, error: insertErr } = await supabaseAdmin
        .from('transactions')
        .insert({
          amount: 0,
          network: targetBundle.network_key.toUpperCase(),
          network_key: targetBundle.network_key,
          capacity: targetBundle.capacity,
          recipient_phone: phoneNumber,
          payer_phone_number: phoneNumber,
          status: 'paid',
          payment_status: 'success',
          delivery_status: 'pending',
          external_reference: `REWARD-${rewardId}`,
          api_status: 'initiated'
        })
        .select()
        .single();

      if (insertErr || !transaction) {
         await supabaseAdmin.from('appreciation_rewards').update({
            status: 'failed',
            updated_at: new Date().toISOString()
         }).eq('id', rewardId);
         throw new Error('Failed to create reward transaction: ' + insertErr?.message);
      }

      try {
         // Fire off Datahub purchase directly!
         const vtuResult = await purchaseData(transaction, 'manual_retry');
         
         const isDelivered = vtuResult.success || vtuResult.status === 'delivered' || vtuResult.status === 'success';
         
         await supabaseAdmin.from('appreciation_rewards').update({
            status: isDelivered ? 'sent' : 'failed',
            rewarded_at: isDelivered ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
         }).eq('id', rewardId);
         
         if (isDelivered) {
             // Send Telegram Admin Notification
             const tgMessage = `🎉 *REWARD DISPATCHED*\n\n` +
                               `👤 *Customer*: ${phoneNumber}\n` +
                               `📱 *Network*: ${targetBundle.network_key.toUpperCase()}\n` +
                               `🎁 *Reward*: ${targetBundle.capacity}\n` +
                               `✅ *Status*: Delivered\n` +
                               `🕒 *Time*: ${new Date().toLocaleString()}`;
                               
             // Fire and forget Telegram logging
                           logWebhook({ reference: 'telegram_reward_alert', payload: { message: tgMessage }, status: 'processed' });

             try {
                const { data: dhSettings } = await supabaseAdmin.from('settings').select('value').eq('key', 'secure').single();
                if (dhSettings?.value?.telegram_bot_token && dhSettings?.value?.telegram_chat_id) {
                    const url = `https://api.telegram.org/bot${dhSettings.value.telegram_bot_token}/sendMessage`;
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: dhSettings.value.telegram_chat_id,
                            text: tgMessage,
                            parse_mode: 'Markdown'
                        })
                    });
                }
             } catch(err) {
                console.warn('Failed to send telegram reward alert', err);
             }
         }

         return res.json({ success: true, delivered: isDelivered, message: 'Reward processed.' });
      } catch (err: any) {
         await supabaseAdmin.from('appreciation_rewards').update({
            status: 'failed',
            updated_at: new Date().toISOString()
         }).eq('id', rewardId);
         throw err;
      }
    }

    res.status(400).json({ error: 'Unknown action' });

  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
