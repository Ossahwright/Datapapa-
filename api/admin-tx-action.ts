import { supabase, isAdminAuth } from '../lib/server-utils.js';

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
      const { error } = await supabase
        .from("transactions")
        .update({
          delivery_status: "delivered",
          vtu_status: "success", // Ensure VTU status is also updated for UI consistency
          delivery_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          admin_action_by: 'admin' // Optional: track who did it
        })
        .eq("id", transactionId);

      if (error) throw error;
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

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error: any) {
    console.error(`❌ Admin action [${action}] failed:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
