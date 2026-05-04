import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAyOTcsImV4cCI6MjA5MjU5NjI5N30.ZQZFhxQgzy9JBGUBW9wRfRDs44wcFkmDFu78PUJIags';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Standardizes phone numbers to 233 format
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.trim().replace(/\D/g, '');
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

    console.log("🚀 [SMS] Sending SMS to:", formatted, "| Msg:", message.substring(0, 50) + (message.length > 50 ? "..." : ""));
    
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
    if (err.response) {
      console.error("❌ [SMS] Error Response:", JSON.stringify(err.response.data));
    }
    console.error("❌ [SMS] Error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Builds the success message using a template from settings
 */
export function buildSuccessSMS({
  volume,
  network,
  phone,
  transactionId,
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

  return `Datapapa\n\nYour purchase of ${capacityStr} ${networkStr} data for ${phoneStr} was successful.\n\nKindly contact or WhatsApp us on 0244014207\nThank you for your trust.`;
}

/**
 * Core Data Purchase Logic
 */
export async function purchaseData(transaction: any) {
  // 🛡️ Idempotency: Don't process if already successful
  if (transaction.vtu_status === 'success' || transaction.vtu_status === 'completed' || transaction.status === 'completed' || transaction.vtu_status === 'delivered') {
    console.log("♻️ [DataHub] Transaction already processed successfully:", transaction.id);
    return { success: true, message: "Already processed", vtu_status: 'success' };
  }

  // 🛡️ Prevent concurrent processing if called within seconds
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

  console.log("📝 [DataHub] SENDING DATAHUB REQUEST:", JSON.stringify(payload));

  const maxRetries = 3;
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      attempts++;
      if (attempts > 1) {
        console.log(`🔄 [DataHub] RETRY ATTEMPT ${attempts - 1} for ${transaction.id}`);
        await new Promise(r => setTimeout(r, 1500));
      }

      await supabase
        .from("transactions")
        .update({ 
          vtu_status: 'processing',
          updated_at: new Date().toISOString() 
        })
        .eq("id", transaction.id);

      const { apiKey, baseUrl } = await getDataHubConfig();
      
      if (!apiKey) {
        throw new Error("DataHub API key missing");
      }

      const response = await axios.post(`${baseUrl}/data-purchase`, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Accept": "application/json"
        },
        timeout: 10000, 
        validateStatus: () => true
      });

      const result = response.data;
      console.log(`📡 [DataHub] DATAHUB RESPONSE (Attempt ${attempts}):`, JSON.stringify(result));
      
      try {
        await supabase.from("datahubgh_logs").insert({
          endpoint: `${baseUrl}/data-purchase`,
          status: (response.status >= 200 && response.status < 300) ? 'success' : 'failed',
          http_status: response.status,
          request_payload: payload,
          response_data: result,
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error("[DataHub Logging Error]:", logErr);
      }

      const isActuallySuccess = (response.status >= 200 && response.status < 300) && (
        result.success === true || 
        result.status === true ||
        result.status?.toUpperCase() === 'SUCCESSFUL' || 
        result.status?.toUpperCase() === 'PROCESSING' ||
        result.status?.toUpperCase() === 'SUCCESS'
      );

      if (isActuallySuccess) {
        await supabase
          .from("transactions")
          .update({
            vtu_status: 'processing',
            api_response: result,
            updated_at: new Date().toISOString()
          })
          .eq("id", transaction.id);

        return { 
          success: true, 
          status: response.status,
          vtu_status: 'processing',
          ...result 
        };
      }

      // If not successful and we have retries left, continue
      lastError = result.message || result.error || "Unknown API Error";
      console.warn(`⚠️ [DataHub] Attempt ${attempts} failed: ${lastError}`);
      
    } catch (err: any) {
      lastError = err.message;
      console.error(`❌ [DataHub] Attempt ${attempts} Exception:`, err.message);
      if (attempts >= maxRetries) break;
    }
  }

  // If we reach here, retries exhausted
  console.error(`❌ [DataHub] ALL RETRIES EXHAUSTED for ${transaction.id}: ${lastError}`);
  await supabase.from("transactions").update({ 
    vtu_status: 'failed', 
    status: 'failed', 
    error_message: lastError,
    api_response: { error: lastError, attempts } 
  }).eq("id", transaction.id);
  
  return { success: false, error: lastError };
}
