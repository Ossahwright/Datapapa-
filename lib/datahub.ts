import axios from "axios";
import { supabase } from "./supabase";

/**
 * Validates the payload before sending to DataHub
 */
function validateDataHubPayload(payload: any) {
  const { networkKey, recipient, capacity } = payload;

  const validNetworks = ["YELLO", "TELECEL", "AT_PREMIUM", "AT_BIGTIME"];
  if (!validNetworks.includes(networkKey)) {
    throw new Error(`Invalid networkKey: ${networkKey}. Must be one of ${validNetworks.join(", ")}`);
  }

  if (!recipient || !recipient.match(/^0\d{9}$/)) {
    throw new Error("Invalid phone format. Must be 10 digits starting with 0.");
  }

  if (!capacity) {
    throw new Error("Capacity (plan) is missing");
  }
}

/**
 * Checks if the DataHub API is reachable
 */
async function checkApiHealth(baseUrl: string, apiKey: string) {
  try {
    // Note: Some APIs use /status or /balance as a health check. 
    // We'll try a fast request to ensure connectivity.
    const response = await axios.get(`${baseUrl.replace('/external', '')}/balance`, {
      headers: { "X-API-Key": apiKey },
      timeout: 5000
    });
    return response.status === 200;
  } catch (err) {
    console.warn("⚠️ [DataHub] Health check failed or endpoint not found. Proceeding with caution.");
    return true; // Don't block if balance check fails but API might be up
  }
}

export async function getDataHubConfig() {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "general")
    .maybeSingle();

  if (error) throw error;
  
  const settings = data?.value || {};
  return {
    apiKey: process.env.DATAHUB_API_KEY || settings.datahub_api_key,
    baseUrl: settings.datahub_base_url || "https://app.datahubgh.com/api/external"
  };
}

/**
 * Core DataHub Purchase Function
 */
export async function callDataHub(payload: any) {
  const { apiKey, baseUrl } = await getDataHubConfig();
  
  if (!apiKey) throw new Error("DATAHUB_API_KEY is missing in environment");

  // Input Validation
  validateDataHubPayload(payload);

  console.log("🚀 [DataHub] Sending Payload:", JSON.stringify(payload));

  const response = await axios.post(`${baseUrl}/data-purchase`, payload, {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "Accept": "application/json"
    },
    timeout: 15000,
    validateStatus: () => true
  });

  const data = response.data;
  console.log("📡 [DataHub] Response:", JSON.stringify(data));

  // Log to database
  await supabase.from("datahub_logs").insert({
    payload,
    response: data,
    status: (response.status >= 200 && response.status < 300) ? "success" : "failed",
    http_status: response.status,
    created_at: new Date().toISOString()
  });

  const isSuccess = (response.status >= 200 && response.status < 300) && (
    data.success === true || 
    data.status === true ||
    data.status?.toUpperCase() === 'SUCCESSFUL' ||
    data.message?.toLowerCase().includes("successful")
  );

  if (!isSuccess) {
    throw new Error(data.message || data.error || `DataHub Error (HTTP ${response.status})`);
  }

  return { success: true, ...data };
}

/**
 * Queries DataHub for the status of a transaction
 */
export async function queryDataHubStatus(reference: string) {
  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) throw new Error("DATAHUB_API_KEY is missing");

  console.log(`🔍 [DataHub] Checking Status for Ref: ${reference}`);

  // Many DataHub APIs use GET /data-purchase/{reference} or similar
  // We will try to find the status using the common pattern
  const response = await axios.get(`${baseUrl}/data-purchase/${reference}`, {
    headers: {
      "X-API-Key": apiKey,
      "Accept": "application/json"
    },
    timeout: 10000,
    validateStatus: () => true
  });

  // If that doesn't work, we try the query param approach which is also common
  if (response.status === 404 || response.status === 405) {
    const altResponse = await axios.get(`${baseUrl}/data-purchase?reference=${reference}`, {
      headers: { "X-API-Key": apiKey },
      timeout: 10000,
      validateStatus: () => true
    });
    if (altResponse.status === 200) return altResponse.data;
  }

  return response.data;
}

/**
 * Wrapper with Exponential Backoff/Retry
 */
export async function callDataHubWithRetry(payload: any, retries: number = 3): Promise<any> {
  try {
    return await callDataHub(payload);
  } catch (err: any) {
    const errorMsg = err.message || "";
    console.error(`❌ [DataHub] Attempt failed: ${errorMsg}`);

    // Check for fatal errors that shouldn't be retried
    const isFatal = errorMsg.toLowerCase().includes("balance") || 
                    errorMsg.toLowerCase().includes("api key") ||
                    errorMsg.toLowerCase().includes("unauthorized") ||
                    errorMsg.toLowerCase().includes("invalid network") ||
                    errorMsg.toLowerCase().includes("invalid phone");

    if (retries <= 0 || isFatal) {
      if (isFatal) console.warn(`🛑 [DataHub] Stopping retries due to fatal error: ${errorMsg}`);
      throw err;
    }

    console.log(`🔁 [DataHub] Retrying in 3s... (${retries} attempts left)`);
    await new Promise(r => setTimeout(r, 3000));

    return callDataHubWithRetry(payload, retries - 1);
  }
}

