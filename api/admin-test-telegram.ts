import { sendTelegramNotification } from '../lib/sendTelegramNotification.js';
import { supabase, isAdminAuth } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !userData?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log("🛠️ [Admin] Triggering Telegram Test Notification...");
    
    await sendTelegramNotification({
      category: 'manual_override',
      title: 'TEST NOTIFICATION',
      transaction: {
        id: 'TEST-MODE-UUID',
        amount: 88.88,
        recipient_phone: '024XXXXXXX',
        network: 'TEST',
        display_bundle: '1GB TEST PACK',
        reference: 'TEST-REF'
      },
      metadata: {
        admin: userData.user.email,
        details: 'This is a test notification triggered from the Admin Settings panel to verify bot reachability.'
      }
    });

    return res.status(200).json({ success: true, message: 'Test notification sent' });
  } catch (error: any) {
    console.error("❌ [Admin] Telegram Test Failed:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
