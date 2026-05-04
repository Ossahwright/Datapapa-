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
      sender: (senderId || process.env.ARKESEL_SENDER_ID || "DataHubGH").slice(0, 11),
      message,
      recipients: [formatted],
    };

    const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", payload, {
      headers: {
        "Content-Type": "application/json",
        "api-key": arkeselKey,
      },
      timeout: 20000
    });

    // Log to database
    try {
      const data = response.data;
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
  const defaultTemplate = `Datapapa ✅\n\nYour {volume} {network} data has been delivered to {phone}.\n\nRef: {transaction_id}\n\nNeed help? 0244014207`;
  let msg = template || defaultTemplate;
  return msg
    .replace("{volume}", volume)
    .replace("{network}", network)
    .replace("{phone}", phone)
    .replace("{transaction_id}", transactionId || 'N/A');
}

/**
 * Core Data Purchase Logic
 */
export async function purchaseData(transaction: any) {
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

  const payload = {
    networkKey,
    recipient,
    capacity: finalCapacity,
  };

  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) throw new Error("API key missing");

    const response = await axios.post(`${baseUrl}/data-purchase`, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "User-Agent": "Datapapa-VTU-Serverless/1.0"
      },
      timeout: 35000,
      validateStatus: () => true
    });

    const result = response.data;
    const isActuallySuccess = response.status === 200 && (result.success === true || result.status === 'SUCCESSFUL' || result.status === 'PROCESSING');
    
    const vtuStatus = isActuallySuccess ? 'success' : 'failed';

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
