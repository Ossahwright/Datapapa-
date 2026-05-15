import { 
  supabase, 
  reconcileTransaction, 
  isAdminAuth, 
  purchaseData, 
  syncWalletSilently
} from '../lib/server-utils.js';
import { getDataHubConfig } from '../lib/config-utils.js';
import { syncProviderWallet } from '../lib/provider-health.js';
import { sendTelegramNotification } from '../lib/sendTelegramNotification.js';

// rate limiter for sensitive ops
const globalRateLimit = new Map<string, number[]>();

export default async function handler(req: any, res: any) {
  const method = (req.method || 'GET').toUpperCase();
  
  // 🛡️ Handle CORS Preflight
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST') {
    console.warn(`[Admin Ops] Received ${method} request to ${req.url}. This endpoint expects POST for actions.`);
    // If it's a GET, maybe they just want to ping it? Return 200 for health but 405 for actions.
    if (method === 'GET') {
      return res.status(200).json({ status: 'Admin Ops Endpoint is alive. Use POST for actions.' });
    }
    return res.status(405).json({ error: `Method ${method} not allowed. Use POST.` });
  }

  // 🛡️ Robust Body Parsing
  let body = req.body;
  if (typeof body === 'string' && body.length > 0) {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error("[Admin Ops] Failed to parse body string:", e);
    }
  }
  body = body || {};

  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, ...payload } = body;

  try {
    switch (action) {
      case 'test_telegram': {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        const { data: userData } = await supabase.auth.getUser(token);
        
        await sendTelegramNotification({
          category: 'manual_override',
          title: 'TEST NOTIFICATION',
          transaction: {
            id: 'TEST-MODE-UUID',
            amount: 88.88,
            recipient_phone: '0241234567',
            network: 'TEST',
            display_bundle: '1GB TEST PACK',
            reference: 'TEST-REF'
          },
          metadata: {
            admin: userData?.user?.email,
            details: 'This is a test notification triggered from the Admin Settings panel to verify bot reachability.'
          }
        });
        return res.status(200).json({ success: true, message: 'Test notification sent' });
      }

      case 'mark_delivered': {
        const { transactionId } = payload;
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        const { data: userData } = await supabase.auth.getUser(token);
        const adminEmail = userData?.user?.email || 'unknown_admin';

        const { data: tx } = await supabase.from("transactions").select("audit_log").eq("id", transactionId).single();
        const currentLog = Array.isArray(tx?.audit_log) ? tx.audit_log : [];
        const newLogEntry = {
          action: 'MANUAL_DELIVERY_OVERRIDE',
          details: 'Admin manually marked as delivered bypassing provider.',
          admin: adminEmail,
          timestamp: new Date().toISOString()
        };

        const { error } = await supabase.from("transactions").update({
          status: "fulfilled",
          delivery_status: "delivered", 
          vtu_status: "delivered", 
          audit_log: [...currentLog, newLogEntry],
          updated_at: new Date().toISOString()
        }).eq("id", transactionId);

        if (error) throw error;
        
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

      case 'delete_tx': {
        const { transactionId } = payload;
        const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Transaction deleted' });
      }

      case 'track_whatsapp': {
        const { transactionId, message } = payload;
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        const { data: userData } = await supabase.auth.getUser(token);
        const adminEmail = userData?.user?.email || 'unknown_admin';

        const { data: tx } = await supabase.from("transactions").select("whatsapp_send_count, audit_log").eq("id", transactionId).single();
        const currentCount = (tx?.whatsapp_send_count || 0);
        const currentLog = Array.isArray(tx?.audit_log) ? tx.audit_log : [];
        
        const newLogEntry = {
          action: 'WHATSAPP_CONTACT_INITIATED',
          details: currentCount === 0 ? 'Initial WhatsApp delivery confirmation initiated.' : `WhatsApp resend initiated (Total: ${currentCount + 1}).`,
          admin: adminEmail,
          timestamp: new Date().toISOString(),
          message_preview: message?.substring(0, 100)
        };

        const { error: updateError } = await supabase.from("transactions").update({
          whatsapp_sent: true,
          whatsapp_sent_at: new Date().toISOString(),
          whatsapp_sent_by: userData?.user?.id,
          whatsapp_sent_by_email: adminEmail,
          whatsapp_message: message,
          whatsapp_send_count: currentCount + 1,
          audit_log: [...currentLog, newLogEntry],
          updated_at: new Date().toISOString()
        }).eq("id", transactionId);

        if (updateError) throw updateError;

        const { data: finalTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
        if (finalTx) {
            sendTelegramNotification({
                category: 'manual_override',
                title: 'WhatsApp Contact Logged',
                transaction: finalTx,
                metadata: { admin: adminEmail, action: 'WHATSAPP_TRACKED' }
            }).catch(e => console.error("TG Track alert error", e));
        }
        return res.status(200).json({ success: true, message: 'WhatsApp tracking updated' });
      }

      case 'bulk_reconcile': {
        const { data: txs } = await supabase.from("transactions").select("id").in("vtu_status", [
          'processing', 'provider_execution_started', 'provider_accepted', 
          'awaiting_provider_confirmation', 'reconciliation_pending', 'delayed_provider_processing'
        ]).order('created_at', { ascending: false }).limit(50);

        const results = [];
        if (txs) {
          for (const tx of txs) {
            try {
              const result = await reconcileTransaction(tx.id);
              results.push({ id: tx.id, success: true, status: result.status });
            } catch (err: any) {
              results.push({ id: tx.id, success: false, error: err.message });
            }
          }
        }
        return res.status(200).json({ success: true, count: results.length, results });
      }

      case 'reconcile_single': {
        const { transactionId } = payload;
        const result = await reconcileTransaction(transactionId);
        return res.status(200).json(result);
      }

      case 'retry_vtu': {
        const { transactionId } = payload;
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        let calls = globalRateLimit.get(ip) || [];
        calls = calls.filter(t => now - t < 60000);
        if (calls.length >= 20) return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
        calls.push(now);
        globalRateLimit.set(ip, calls);

        const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if (!tx) return res.status(404).json({ success: false, error: 'Tx not found' });

        if (tx.vtu_status === "delivered" || tx.vtu_status === "success") {
          return res.json({ success: false, message: "Already delivered" });
        }

        const hasProviderFootprint = !!tx.provider_reference || !!tx.external_reference || 
          ["provider_accepted", "awaiting_provider_confirmation", "reconciliation_pending", "delayed_provider_processing", "manual_review_required"].includes(tx.vtu_status);

        if (hasProviderFootprint) {
          return res.status(200).json({ success: false, message: "Repurchase Denied: Provider footprint found. Use Sync.", divertedToReconciliation: true });
        }

        await supabase.from('transactions').update({
           delivery_attempts: (tx.delivery_attempts || 0) + 1,
           vtu_status: 'provider_execution_started',
           updated_at: new Date().toISOString()
        }).eq('id', tx.id);

        const retryObject = { ...tx, status: "payment_success", payment_status: "success" };
        delete retryObject.external_reference;

        // Increment retry_count
        await supabase.from('transactions').update({
          retry_count: (tx.retry_count || 0) + 1
        }).eq('id', transactionId);

        const result = await purchaseData(retryObject, "manual_retry");
        syncWalletSilently().catch(console.error);
        return res.status(200).json(result);
      }

      case 'sync_wallet': {
        const { force } = payload;
        const result = await syncProviderWallet(!!force);
        
        // 🛡️ Transform to non-blocking observability response
        return res.status(200).json({ 
          success: true, 
          balance: result.balance,
          throttled: result.throttled,
          degraded: result.status !== 'online',
          provider_status: result.status,
          wallet_sync_status: result.status === 'online' ? 'available' : 'unavailable',
          message: result.status === 'online' ? 'Provider balance synchronized' : 'Using cached provider balance',
          error: result.error
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error(`❌ Admin action [${action}] failed:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
