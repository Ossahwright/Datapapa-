import { supabase, reconcileTransaction, isAdminAuth } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    console.log("🚀 [Bulk Reconcile] Fetching pending transactions...");
    
    // Select transactions in "waiting" states
    const { data: txs, error } = await supabase
      .from("transactions")
      .select("id")
      .in("vtu_status", [
        'processing',
        'provider_execution_started',
        'provider_accepted', 
        'awaiting_provider_confirmation',
        'reconciliation_pending',
        'delayed_provider_processing'
      ])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log(`🚀 [Bulk Reconcile] Found ${txs?.length || 0} transactions to reconcile.`);
    
    const results = [];
    if (txs) {
      for (const tx of txs) {
        try {
          console.log(`🔄 Reconciling ${tx.id}...`);
          const result = await reconcileTransaction(tx.id);
          results.push({ id: tx.id, success: true, status: result.status });
        } catch (err: any) {
          results.push({ id: tx.id, success: false, error: err.message });
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      count: results.length, 
      results 
    });
  } catch (error: any) {
    console.error("❌ [Bulk Reconcile] Fatal error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
