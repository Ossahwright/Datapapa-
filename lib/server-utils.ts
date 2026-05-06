import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase admin client
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase backend client initialized with service role");

export async function syncWalletSilently() {
  try {
    // 🔍 Check last sync time
    const { data } = await supabase
      .from("provider_settings")
      .select("last_synced_at")
      .eq("provider_name", "datahubgh")
      .single();

    const lastSync = data?.last_synced_at
      ? new Date(data.last_synced_at)
      : null;

    const now = new Date();

    // ⛔ Rate limit: only sync if > 30 seconds ago
    if (lastSync && now.getTime() - lastSync.getTime() < 30000) {
      return; // skip silently
    }

    const { apiKey, baseUrl } = await getDataHubConfig();

    // 🌐 Call DataHubGH API
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/user`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (response.status === 404) {
      console.warn("⚠️ [Silent Sync] User endpoint 404. Skipping sync.");
      return;
    }

    const result = await response.json();
    console.log("DATAHUB BALANCE RESPONSE:", result);

    const walletData = result?.data || result;
    const balance =
      walletData?.wallet_balance ??
      walletData?.balance ??
      walletData?.user?.wallet_balance ??
      walletData?.user?.balance ??
      0;

    if (!response.ok) throw new Error(`Balance fetch failed: ${response.status}`);

    // 💾 Update DB
    await supabase
      .from("provider_settings")
      .update({
        wallet_balance: balance,
        last_synced_at: now.toISOString(),
        status: "online",
      })
      .eq("provider_name", "datahubgh");

  } catch (err) {
    console.error("Silent wallet sync failed:", err);

    await supabase
      .from("provider_settings")
      .update({ status: "offline" })
      .eq("provider_name", "datahubgh");
  }
}

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
  const defaultUrl = "https://app.datahubgh.com/api/external";
  const envKey = process.env.DATAHUB_API_KEY;
  let envUrl = process.env.DATAHUB_BASE_URL;

  // 🛡️ Sanitize: If envUrl is literally "undefined" or empty, use default
  if (!envUrl || envUrl === "undefined" || envUrl === "null") {
    envUrl = defaultUrl;
  }

  if (envKey) {
    return {
      apiKey: envKey.trim(),
      baseUrl: envUrl.trim()
    };
  }

  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value?.api_key) {
      const dbUrl = dhData.value.base_url;
      return {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: (!dbUrl || dbUrl === "undefined" || dbUrl === "null") ? envUrl.trim() : dbUrl.trim()
      };
    }
  } catch (err) {
    console.error("[DataHub Config] Error:", err);
  }

  return { apiKey: "", baseUrl: envUrl.trim() };
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

  return `Datapapa\n\nYour transaction of ${capacityStr} ${networkStr} data for ${phoneStr} was successful.\n\nKindly contact us on 0244014207\nThank you for your trust.`;
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
    'airteltigo': 'AT',
    'at': 'AT'
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

  console.log("📝 [DataHub] Preparing for purchase:", transaction.id);

  // Set processing status once before retries begin
  await supabase
    .from("transactions")
    .update({ 
      vtu_status: 'processing',
      updated_at: new Date().toISOString() 
    })
    .eq("id", transaction.id);

  const payload = {
    network_id: networkKey,
    network_key: networkKey,
    recipient,
    plan: finalCapacity,
    capacity: finalCapacity,
    reference: transaction.id
  };

  const maxRetries = 3;
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      attempts++;
      if (attempts > 1) {
        console.log(`🔄 [DataHub Retry Attempt ${attempts}]`, {
          transactionId: transaction.id,
          network: networkKey,
          recipient,
          bundle: finalCapacity
        });
        await new Promise(r => setTimeout(r, 1500));
      }

      const { apiKey, baseUrl } = await getDataHubConfig();
      
      if (!apiKey) {
        throw new Error("DataHub API key is missing in settings");
      }

      const endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;
      
      console.log("=== DATAHUB REQUEST ===");
      console.log({
        endpoint,
        payload,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey ? "PRESENT (REDACTED)" : "MISSING",
          "Accept": "application/json"
        }
      });

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Accept": "application/json"
        },
        timeout: 15000, 
        validateStatus: () => true
      });

      const result = response.data;
      console.log("=== DATAHUB RESPONSE ===");
      console.log({
        status: response.status,
        data: result,
        headers: response.headers
      });
      
      const orderId = result.data?.reference || result.order_id || result.order_number || result.data?.order_id || result.data?.id || result.reference;

      // Log to database
      try {
        await supabase.from("datahub_logs").insert({
          endpoint,
          status: (response.status >= 200 && response.status < 300) ? 'success' : 'failed',
          http_status: response.status,
          payload: payload,
          response: result,
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
        result.status?.toUpperCase() === 'SUCCESS' ||
        result.code === 200 ||
        result.code === '200'
      );

      if (isActuallySuccess) {
        await supabase
          .from("transactions")
          .update({
            vtu_status: 'processing',
            external_reference: orderId || null,
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
      lastError = result.message || result.error || JSON.stringify(result);
      console.warn(`⚠️ [DataHub] Attempt ${attempts} failed with provider error: ${lastError}`);
      
    } catch (err: any) {
      console.error("=== DATAHUB FULL ERROR ===");
      if (err.response) {
        console.error({
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
        lastError = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
      } else if (err.request) {
        console.error("No response received from DataHub");
        console.error(err.request);
        lastError = "No response from DataHub server (Timeout/Network)";
      } else {
        console.error("Axios setup error:", err.message);
        lastError = err.message;
      }
      
      if (attempts >= maxRetries) break;
    }
  }

  // If we reach here, retries exhausted
  console.error("=== DATAHUB RETRIES EXHAUSTED ===");
  console.error({
    transactionId: transaction.id,
    finalError: lastError
  });
  await supabase.from("transactions").update({ 
    vtu_status: 'failed', 
    status: 'failed', 
    error_message: lastError,
    api_response: { error: lastError, attempts } 
  }).eq("id", transaction.id);
  
  return { success: false, error: lastError };
}
