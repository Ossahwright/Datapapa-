import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, syncWalletSilently } from '../lib/server-utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow manual check via GET or POST
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Find transitions that are 'delivering' for more than 5 minutes
    const { data: stuckTxs, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('delivery_status', 'delivering')
      .lt('updated_at', fiveMinutesAgo);

    if (error) throw error;

    const summary = {
      detected: stuckTxs?.length || 0,
      fixed: 0,
      errors: 0
    };

    if (stuckTxs && stuckTxs.length > 0) {
      console.log(`[StuckRecovery] Found ${stuckTxs.length} stuck transactions`);
      
      for (const tx of stuckTxs) {
        try {
          // You could try to query DataHub status here, or just mark as failed to allow user retry
          // For now, let's mark as 'failed' so it appears in the admin panel with a 'retry' button
          await supabase
            .from('transactions')
            .update({
              delivery_status: 'failed',
              error_message: 'Stuck for more than 5 minutes - marked as failed for investigation',
              updated_at: new Date().toISOString()
            })
            .eq('id', tx.id);
            
          summary.fixed++;
        } catch (txErr) {
          console.error(`[StuckRecovery] Error fixing TX ${tx.id}:`, txErr);
          summary.errors++;
        }
      }
    }

    // Also sync wallet while we are here
    syncWalletSilently().catch(console.error);

    return res.json({ success: true, summary });
  } catch (err: any) {
    console.error("[StuckRecovery] Fatal:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
