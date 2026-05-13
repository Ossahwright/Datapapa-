import { supabase, isAdminAuth } from '../lib/server-utils.js';
import { sendTelegramNotification } from '../lib/sendTelegramNotification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await isAdminAuth(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }

  const { action, transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: 'Missing transaction ID' });
  }

  try {
    if (action === 'mark_delivered') {
      console.log(`=== ADMIN ACTION: MARK DELIVERED [${transactionId}] ===`);
      
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const { data, error: authError } = await supabase.auth.getUser(token);
      const adminEmail = data?.user?.email || 'unknown_admin';

      // 1. Fetch current audit log
      const { data: tx } = await supabase
        .from("transactions")
        .select("audit_log")
        .eq("id", transactionId)
        .single();

      const currentLog = Array.isArray(tx?.audit_log) ? tx.audit_log : [];
      const newLogEntry = {
        action: 'MANUAL_DELIVERY_OVERRIDE',
        details: 'Admin manually marked as delivered bypassing provider.',
        admin: adminEmail,
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from("transactions")
        .update({
          delivery_status: "delivered", 
          vtu_status: "delivered", 
          fulfilled_at: new Date().toISOString(),
          manual_override: true,
          audit_log: [...currentLog, newLogEntry],
          updated_at: new Date().toISOString()
        })
        .eq("id", transactionId);

      if (error) throw error;

      // 📱 Trigger Telegram Notification for Manual Override
      const { data: finalTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
      if (finalTx) {
          sendTelegramNotification({
              category: 'manual_override',
              title: 'Manual Delivery Override',
              transaction: finalTx,
              metadata: { admin: adminEmail }
          }).catch(e => console.error("TG Override alert error", e));
      }

      return res.status(200).json({ success: true, message: 'Transaction marked as delivered' });
    }

    if (action === 'delete') {
      console.log(`=== ADMIN ACTION: DELETE [${transactionId}] ===`);
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Transaction deleted' });
    }

    if (action === 'track_whatsapp') {
      const { message } = req.body;
      console.log(`=== ADMIN ACTION: TRACK WHATSAPP [${transactionId}] ===`);

      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !userData?.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const admin = userData.user;
      const adminEmail = admin.email || 'unknown_admin';

      // 1. Fetch current info
      const { data: tx } = await supabase
        .from("transactions")
        .select("whatsapp_send_count, audit_log")
        .eq("id", transactionId)
        .single();

      const currentCount = (tx?.whatsapp_send_count || 0);
      const currentLog = Array.isArray(tx?.audit_log) ? tx.audit_log : [];
      
      const newLogEntry = {
        action: 'WHATSAPP_CONTACT_INITIATED',
        details: currentCount === 0 
          ? 'Initial WhatsApp delivery confirmation initiated.' 
          : `WhatsApp resend initiated (Total: ${currentCount + 1}).`,
        admin: adminEmail,
        timestamp: new Date().toISOString(),
        message_preview: message?.substring(0, 100)
      };

      const { error } = await supabase
        .from("transactions")
        .update({
          whatsapp_sent: true,
          whatsapp_sent_at: new Date().toISOString(),
          whatsapp_sent_by: admin.id,
          whatsapp_message: message,
          whatsapp_send_count: currentCount + 1,
          audit_log: [...currentLog, newLogEntry],
          updated_at: new Date().toISOString()
        })
        .eq("id", transactionId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'WhatsApp tracking updated' });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error: any) {
    console.error(`❌ Admin action [${action}] failed:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
