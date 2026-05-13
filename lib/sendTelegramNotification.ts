import axios from 'axios';
import { supabase } from './supabase.js';

export type TelegramCategory = 
  | 'payment_verified' 
  | 'vtu_delivered' 
  | 'vtu_failed' 
  | 'manual_override' 
  | 'webhook_failure' 
  | 'reconciliation_warning';

interface TelegramNotificationOptions {
  category: TelegramCategory;
  title: string;
  transaction: any;
  metadata?: any;
}

const CATEGORY_EMOJIS: Record<TelegramCategory, string> = {
  payment_verified: '🟢',
  vtu_delivered: '✅',
  vtu_failed: '🔴',
  manual_override: '🟣',
  webhook_failure: '⚠️',
  reconciliation_warning: '⚠️'
};

/**
 * 🤖 HARDENED TELEGRAM OPERATIONAL NOTIFICATION SYSTEM
 * authoritative operational monitoring channel for Datapapa admins.
 */
export async function sendTelegramNotification({
  category,
  title,
  transaction,
  metadata
}: TelegramNotificationOptions) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[TELEGRAM NOTIFICATION SKIPPED] Bot credentials missing.");
    return;
  }

  // 🛡️ IDEMPOTENCY GUARD
  // Prevent duplicate Telegram spam for terminal events
  if (transaction?.id) {
    // If it's a delivery success, check if we already notified
    if (category === 'vtu_delivered' && transaction.telegram_notified && (transaction.vtu_status === 'delivered' || transaction.delivery_status === 'delivered')) {
       // Only skip if it was notified very recently (within 5 mins) to allow for some retries if needed, 
       // or if the count is already > 0 and it's a success event.
       if (transaction.telegram_notification_count > 0) {
           console.log(`[TELEGRAM IDEMPOTENCY] Skipping duplicate success alert for TX: ${transaction.id}`);
           return;
       }
    }
    
    // For payment verified, also check if already notified
    if (category === 'payment_verified' && transaction.telegram_notified && transaction.telegram_notification_count > 0) {
        // If payment was already notified, don't notify again unless it's a different category
        // But since we don't store category in DB, we'll use a simple count check for now.
        // Actually, payment_verified usually happens before vtu_delivered.
        // So if count > 0, it might be the payment alert already sent.
        // We might need to be careful here. 
        // Let's only skip if the category is the same as what we think was sent.
    }
  }

  try {
    const emoji = CATEGORY_EMOJIS[category] || 'ℹ️';
    const amount = transaction.amount_paid || transaction.amount || 0;
    const formattedAmount = `GHS ${Number(amount).toFixed(2)}`;
    
    // Masking phone slightly for privacy in the log
    const recipientRaw = transaction.recipient_phone || transaction.receiver_phone || transaction.phone || 'N/A';
    const recipient = recipientRaw.length > 5 ? `${recipientRaw.substring(0, 3)}XXXXXXX` : recipientRaw;
    
    const reference = transaction.reference || transaction.provider_reference || transaction.id;
    const network = String(transaction.network || 'Unknown').toUpperCase();
    
    let message = `${emoji} <b>${title.toUpperCase()}</b>\n\n`;
    message += `<b>Amount:</b> ${formattedAmount}\n`;
    message += `<b>Network:</b> ${network}\n`;
    
    const bundle = transaction.display_bundle || transaction.capacity || transaction.bundle_name;
    if (bundle) {
        message += `<b>Bundle:</b> ${bundle}\n`;
    }
    
    message += `<b>Recipient:</b> ${recipient}\n`;
    message += `<b>Reference:</b> ${reference}\n`;
    
    if (category === 'vtu_failed' && (transaction.error_message || metadata?.error)) {
        message += `\n<b>Reason:</b>\n<i>${transaction.error_message || metadata?.error}</i>\n`;
    }

    if (category === 'manual_override' && metadata?.admin) {
        message += `\n<b>Admin:</b> ${metadata.admin}\n`;
    }

    if (metadata?.details) {
        message += `\n<b>Details:</b> ${metadata.details}\n`;
    }

    message += `\n<b>Status:</b> ${category.replace(/_/g, ' ').toUpperCase()}\n`;
    message += `\n<b>UUID:</b>\n<code>${transaction.id}</code>\n`;
    
    const adminBaseUrl = 'https://ais-dev-7edna45e7goj7tx46lt3qr-761713302917.europe-west2.run.app';
    message += `\n<b>Open Transaction:</b>\n${adminBaseUrl}/admin/transactions/${transaction.id}`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    console.log(`[TELEGRAM NOTIFICATION STARTED] Category: ${category}, TX: ${transaction.id}`);
    
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }, { timeout: 10000 });

    if (response.data.ok) {
      console.log(`[TELEGRAM MESSAGE SENT] Category: ${category}, TX: ${transaction.id}`);
      
      // Update tracking operational data in DB
      if (transaction.id) {
          try {
              const { data: currentTx } = await supabase
                .from('transactions')
                .select('telegram_notification_count')
                .eq('id', transaction.id)
                .single();
              
              const count = (currentTx?.telegram_notification_count || 0) + 1;

              await supabase.from('transactions').update({
                  telegram_notified: true,
                  telegram_notified_at: new Date().toISOString(),
                  telegram_notification_count: count
              }).eq('id', transaction.id);
          } catch (dbErr) {
              console.warn("⚠️ [Telegram Tracking] Failed to update DB fields, but message was sent.", dbErr);
          }
      }
    } else {
      console.error(`[TELEGRAM SEND FAILED] Provider rejected:`, response.data);
    }
  } catch (error: any) {
    console.error(`[TELEGRAM SEND FAILED] Error:`, error.response?.data || error.message);
  }
}
