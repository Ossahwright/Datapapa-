import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { callDataHubAPI } from './datahub-client.js';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Standardizes phone numbers to 233 format
 */
export function formatPhone(phone: string): string {
  const cleaned = String(phone).trim().replace(/\D/g, '');
  if (cleaned.startsWith("0")) {
    return "233" + cleaned.slice(1);
  }
  if (cleaned.length === 9) {
    return "233" + cleaned;
  }
  return cleaned;
}

/**
 * Centralized DataHub Config Helper
 */
export async function getDataHubConfig() {
  const envKey = process.env.DATAHUB_API_KEY;
  const envUrl = process.env.DATAHUB_BASE_URL || "https://app.datahubgh.com/api/external";

  if (envKey) {
    return {
      apiKey: envKey.trim(),
      baseUrl: envUrl
    };
  }

  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value?.api_key) {
      return {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: dhData.value.base_url || envUrl
      };
    }
  } catch (err) {
    console.error("[DataHub Config] Error:", err);
  }

  return { apiKey: "", baseUrl: envUrl };
}

/**
 * Sends SMS via Arkesel V2
 */
export async function sendSMS(to: string, message: string, senderId?: string) {
  try {
    const arkeselKey = process.env.ARKESEL_API_KEY?.trim();
    if (!arkeselKey) {
      console.error("❌ [SMS] Missing ARKESEL_API_KEY");
      return { success: false, error: "SMS key missing" };
    }

    const formatted = formatPhone(to);
    const finalSender = (senderId || process.env.ARKESEL_SENDER_ID || "Datapapa").slice(0, 11);

    console.log("🚀 [SMS] Sending SMS to:", formatted);
    
    const payload = {
      sender: finalSender,
      message: message,
      recipients: [formatted]
    };

    const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", payload, {
      headers: {
        "Content-Type": "application/json",
        "api-key": arkeselKey,
      },
      timeout: 20000
    });

    const data = response.data;
    console.log("📡 [SMS] SMS API response:", JSON.stringify(data));

    // Log to database
    try {
      const isSuccess = data && (
        String(data).includes('1000') || 
        data.code === '1000' || 
        data.code === 1000 || 
        data.status === 'success'
      );

      await supabase.from("sms_logs").insert({
        phone: formatted,
        message: message,
        status: isSuccess ? "sent" : "failed",
        response: data,
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error("[SMS] Log error:", logErr);
    }

    return data;
  } catch (err: any) {
    console.error("❌ [SMS] Error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Builds the success message
 */
export function buildSuccessSMS({
  volume,
  network,
  phone,
  transactionId,
  template,
}: {
  volume: string;
  network: string;
  phone: string;
  transactionId: string;
  template?: string;
}) {
  const capacityStr = volume || '';
  const networkStr = (network || '').toUpperCase();
  
  let phoneStr = phone || '';
  if (phoneStr.startsWith('233') && phoneStr.length > 10) {
    phoneStr = '0' + phoneStr.slice(3);
  } else if (phoneStr.length === 9 && !phoneStr.startsWith('0')) {
    phoneStr = '0' + phoneStr;
  }

  if (template) {
    return template
      .replace('{capacity}', capacityStr)
      .replace('{network}', networkStr)
      .replace('{phone}', phoneStr)
      .replace('{id}', transactionId);
  }

  return `Datapapa\n\nYour transaction of ${capacityStr} ${networkStr} data for ${phoneStr} was successful.\n\nRef: ${transactionId}\n\nKindly contact us on 0244014207\nThank you for choosing us.`;
}

/**
 * Silent Wallet Sync Logic
 */
export async function syncWalletSilently() {
  try {
    const { data: psData } = await supabase
      .from("provider_settings")
      .select("last_synced_at")
      .eq("provider_name", "datahubgh")
      .single();

    const lastSync = psData?.last_synced_at ? new Date(psData.last_synced_at) : null;
    const now = new Date();

    if (lastSync && now.getTime() - lastSync.getTime() < 30000) return;

    const { apiKey } = await getDataHubConfig();
    if (!apiKey) return;

    const response = await fetch("https://datahubgh.com/api/balance", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const result = await response.json();
    const balance = result?.balance ?? result?.data?.balance ?? result?.wallet ?? 0;

    if (response.ok) {
      await supabase
        .from("provider_settings")
        .update({
          wallet_balance: balance,
          last_synced_at: now.toISOString(),
          status: "online",
        })
        .eq("provider_name", "datahubgh");
    }
  } catch (err) {
    console.error("Silent wallet sync failed:", err);
    await supabase.from("provider_settings").update({ status: "offline" }).eq("provider_name", "datahubgh");
  }
}

/**
 * Logs a webhook event for auditing
 */
export async function logWebhook({
  reference,
  payload,
  status
}: {
  reference: string;
  payload: any;
  status: 'processed' | 'ignored' | 'error';
}) {
  try {
    await supabase.from("webhook_logs").insert({
      reference,
      payload,
      status,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[Webhook Log] Failed to log:", err);
  }
}

/**
 * Core Data Purchase Logic
 */
export async function purchaseData(transaction: any) {
  // 🛡️ Idempotency: Don't process if already successful or pending delivering
  const terminalStatuses = ['success', 'completed', 'delivered'];
  if (terminalStatuses.includes(transaction.vtu_status) || transaction.status === 'completed' || transaction.delivery_status === 'delivered') {
    console.log("♻️ [DataHub] Transaction already processed successfully:", transaction.id);
    return { success: true, message: "Already processed", vtu_status: 'success' };
  }

  // 🛡️ Prevent concurrent processing if called within seconds or if already in 'processing' state
  if (transaction.vtu_status === 'processing' && (Date.now() - new Date(transaction.updated_at).getTime() < 30000)) {
     console.log("⏳ [DataHub] Transaction already being processed:", transaction.id);
     return { success: true, message: "Processing in progress", vtu_status: 'processing' };
  }

  console.log("🚀 [DataHub] Purchasing for:", transaction.id);

  let recipient = transaction.recipient_phone;
  if (recipient && recipient.startsWith('233') && recipient.length > 10) {
    recipient = '0' + recipient.slice(3);
  } else if (recipient && !recipient.startsWith('0') && recipient.length === 9) {
    recipient = '0' + recipient;
  }

  const networkMapping: Record<string, string> = {
    'mtn': 'YELLO',
    'telecel': 'TELECEL',
    'vodafone': 'TELECEL',
    'airteltigo': 'AT_PREMIUM',
    'at': 'AT_PREMIUM'
  };

  const rawNetwork = String(transaction.network || "").toLowerCase();
  const networkKey = transaction.datahub_network_key || 
                    transaction.network_key || 
                    networkMapping[rawNetwork] || 
                    transaction.network;

  const capacity = transaction.datahub_capacity || transaction.capacity || "";
  let finalCapacity = typeof capacity === 'string' ? capacity.toUpperCase().replace("GB", "").trim() : String(capacity);
  
  if (finalCapacity.includes("MB")) {
    finalCapacity = finalCapacity.replace("MB", "").trim();
  }

  const payload = {
    network_id: networkKey,
    network_key: networkKey,
    recipient,
    plan: finalCapacity,
    capacity: finalCapacity,
    reference: transaction.id
  };

  console.log("📝 [DataHub] PURCHASING VIA CLIENT:", JSON.stringify(payload));

  const maxRetries = 2;
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      attempts++;
      
      await supabase
        .from("transactions")
        .update({ 
          vtu_status: 'processing',
          updated_at: new Date().toISOString() 
        })
        .eq("id", transaction.id);

      const apiResponse = await callDataHubAPI("data-purchase", {
        body: payload
      });

      if (apiResponse.success) {
        const result = apiResponse.data;
        
        await supabase
          .from("transactions")
          .update({
            vtu_status: 'processing',
            delivery_status: 'delivering',
            api_response: result,
            updated_at: new Date().toISOString()
          })
          .eq("id", transaction.id);

        return { 
          success: true, 
          status: apiResponse.status,
          vtu_status: 'processing',
          ...result 
        };
      }

      lastError = apiResponse.error || "Unknown API Error";
      console.warn(`⚠️ [DataHub] Attempt ${attempts} failed: ${lastError}`);
      
    } catch (err: any) {
      lastError = err.message;
      console.error(`❌ [DataHub] Attempt ${attempts} Exception:`, err.message);
    }

    if (attempts < maxRetries) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // If we reach here, retries exhausted
  console.error(`❌ [DataHub] ALL RETRIES EXHAUSTED for ${transaction.id}: ${lastError}`);
  await supabase.from("transactions").update({ 
    vtu_status: 'failed', 
    delivery_status: 'failed',
    status: 'failed', 
    error_message: lastError,
    api_response: { error: lastError, attempts } 
  }).eq("id", transaction.id);
  
  return { success: false, error: lastError };
}
