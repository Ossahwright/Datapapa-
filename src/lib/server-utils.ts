import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey!);

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
    const payload = {
      sender: (senderId || process.env.ARKESEL_SENDER_ID || "Datapapa").slice(0, 11),
      message,
      recipients: [formatted],
    };

    console.log("🚀 [SMS] Sending SMS to:", formatted);
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
      await supabase.from("sms_logs").insert({
        phone: formatted,
        message: message,
        status: (data.status === 'success' || data.code === '1000' || data.code === 1000) ? "sent" : "failed",
        response: data,
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error("[SMS] Log error:", logErr);
    }

    return response.data;
  } catch (err: any) {
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
  template
}: {
  volume: string;
  network: string;
  phone: string;
  transactionId: string;
  template?: string;
}) {
  const defaultTemplate = `Datapapa\n\nYour purchase of {capacity} {network} data for {phone} was successful.\n\nKindly contact or WhatsApp us on 0244014207\nThank you for your trust.`;
  let msg = template || defaultTemplate;
  
  // Normalized variables
  const capacityStr = volume || '';
  const networkStr = (network || '').toUpperCase();
  
  let phoneStr = phone || '';
  if (phoneStr.startsWith('233') && phoneStr.length > 10) {
    phoneStr = '0' + phoneStr.slice(3);
  } else if (phoneStr.length === 9 && !phoneStr.startsWith('0')) {
    phoneStr = '0' + phoneStr;
  }

  return msg
    .replace("{capacity}", capacityStr)
    .replace("{volume}", capacityStr) // Fallback for old templates
    .replace("{network}", networkStr)
    .replace("{phone}", phoneStr)
    .replace("{app_name}", "Datapapa")
    .replace("{transaction_id}", transactionId || 'N/A');
}

/**
 * Core Data Purchase Logic
 */
export async function purchaseData(transaction: any) {
  // 🛡️ Idempotency: Don't process if already successful
  if (transaction.vtu_status === 'success' || transaction.vtu_status === 'completed' || transaction.status === 'completed') {
    console.log("♻️ [DataHub] Transaction already processed successfully:", transaction.id);
    return { success: true, message: "Already processed", vtu_status: 'success' };
  }

  // 🛡️ Prevent concurrent processing if called within seconds
  if (transaction.vtu_status === 'processing' && (Date.now() - new Date(transaction.updated_at).getTime() < 60000)) {
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

  const networkKey = transaction.datahub_network_key || transaction.network_key || transaction.network;
  const capacity = transaction.datahub_capacity || transaction.capacity || "";
  const finalCapacity = typeof capacity === 'string' ? capacity.toUpperCase().replace("GB", "").trim() : String(capacity);

  // Harmonized payload for various DataHubGH API versions
  const payload = {
    networkKey,
    network: networkKey, // Alias found in some docs
    network_id: networkKey, // Numeric alias
    recipient,
    phone: recipient, // Common alias
    msisdn: recipient, // Telecom alias
    capacity: finalCapacity,
    bundle: finalCapacity, // Common alias
    plan: finalCapacity, // Common alias
    plan_id: finalCapacity, // Numeric alias
  };

  console.log("📝 [DataHub] Payload Prepared:", JSON.stringify(payload));

  try {
    // 🟠 Set status to processing early so UI shows movement
    await supabase
      .from("transactions")
      .update({ 
        vtu_status: 'processing',
        updated_at: new Date().toISOString() 
      })
      .eq("id", transaction.id);

    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) throw new Error("API key missing");

    const startTime = Date.now();
    const response = await axios.post(`${baseUrl}/data-purchase`, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "Accept": "application/json",
        "User-Agent": "Datapapa-VTU-Serverless/1.0"
      },
      timeout: 35000,
      validateStatus: () => true
    });

    const duration = Date.now() - startTime;
    const result = response.data;
    
    console.log("📡 [DataHub] DATAHUB RESPONSE:", JSON.stringify(result));
    
    // Log to datahubgh_logs
    try {
      await supabase.from("datahubgh_logs").insert({
        endpoint: `${baseUrl}/data-purchase`,
        status: (response.status >= 200 && response.status < 300) ? 'success' : 'failed',
        http_status: response.status,
        response_time: duration,
        request_payload: payload,
        response_data: result,
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error("[DataHub Logging Error]:", logErr);
    }

    // Improved success check based on typical DataHubGH/similar API responses
    const isActuallySuccess = (response.status >= 200 && response.status < 300) && (
      result.success === true || 
      result.status?.toUpperCase() === 'SUCCESSFUL' || 
      result.status?.toUpperCase() === 'PROCESSING' ||
      result.status?.toUpperCase() === 'SUCCESS' ||
      result.status?.toUpperCase() === 'DELIVERED' ||
      result.status?.toUpperCase() === 'COMPLETED' ||
      result.code === 200 ||
      result.code === '200'
    );
    
    const vtuStatus = isActuallySuccess ? 'delivered' : 'failed';

    await supabase
      .from("transactions")
      .update({
        vtu_status: vtuStatus,
        status: isActuallySuccess ? 'completed' : 'failed',
        api_response: result,
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    return { 
      success: isActuallySuccess, 
      status: response.status,
      vtu_status: vtuStatus,
      ...result 
    };
  } catch (err: any) {
    console.error("❌ [DataHub] Error:", err.message);
    await supabase.from("transactions").update({ 
      vtu_status: 'failed', 
      status: 'failed', 
      api_response: { error: err.message } 
    }).eq("id", transaction.id);
    return { success: false, error: err.message };
  }
}
