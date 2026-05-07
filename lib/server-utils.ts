/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * Core server utilities for Supabase and DataHub operations.
 * Unauthorized modifications may break live purchases.
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase admin client lazily
let supabaseClient: any = null;

export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    console.error("❌ CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
    // We handle this more strictly in startup validation now
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey || "", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  return supabaseClient;
};

/**
 * 🚀 STEP 4: STARTUP ENV VALIDATION
 * Ensures all production-critical variables are present.
 */
export function validateEnv() {
  const critical = [
    'PAYSTACK_SECRET_KEY',
    'DATAHUB_API_KEY',
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const missing = critical.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ CRITICAL STARTUP ERROR: Missing Environment Variables: ${missing.join(', ')}`);
    return { valid: false, missing };
  }
  return { valid: true };
}

/**
 * 🔐 STEP 11: ADMIN AUTH ENFORCEMENT
 * Verifies if the request is from an authenticated admin.
 */
export async function isAdminAuth(req: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return false;

    // 🛡️ Owner Fallback
    if (user.email === 'wrightossah@gmail.com') return true;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile?.role === 'admin';
  } catch (err) {
    console.error("Admin Auth Check failed:", err);
    return false;
  }
}

// For backward compatibility while we transition
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

console.log("server-utils loaded successfully");

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

  // 🛡️ Forensic Clean: Ensure baseUrl is the ROOT and does not already contain the endpoint path
  // If the user pasted the full endpoint into settings, we strip it to prevent duplication.
  const sanitizeUrl = (url: string) => {
    let clean = url.trim().replace(/\/+$/, "");
    if (clean.endsWith("/data-purchase")) {
      clean = clean.replace("/data-purchase", "");
    }
    return clean;
  };

  if (envKey) {
    return {
      apiKey: envKey.trim(),
      baseUrl: sanitizeUrl(envUrl)
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
      const finalUrl = (!dbUrl || dbUrl === "undefined" || dbUrl === "null") ? envUrl : dbUrl;
      return {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: sanitizeUrl(finalUrl)
      };
    }
  } catch (err) {
    console.error("[DataHub Config] Error:", err);
  }

  return { apiKey: "", baseUrl: sanitizeUrl(envUrl) };
}

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
    // 🛡️ Log to datahub_logs as it's the more robust table we have defined
    await supabase.from("datahub_logs").insert({
      endpoint: "/webhook/datahub",
      status: `webhook_${status}`,
      payload: { reference, ...payload },
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[Webhook Log] Failed to log:", err);
  }
}

/**
 * 🚀 STEP 5: PROVIDER RECONCILIATION CHECK
 * Queries DataHub directly for the status of a specific order.
 */
export async function checkProviderTransactionStatus(transactionIdOrRef: string) {
  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return null;

    const base = baseUrl.replace(/\/+$/, "");
    // Note: DataHub documentation varies, but common status endpoint is /order-status/{ref} or query param
    const endpoint = `${base}/order-status/${transactionIdOrRef}`;
    
    console.log(`🔍 [Reconciliation] Checking provider status for: ${transactionIdOrRef}`);
    
    const response = await axios.get(endpoint, {
      headers: { "X-API-Key": apiKey },
      timeout: 10000,
      validateStatus: () => true
    });

    const result = response.data;
    console.log("📡 [Reconciliation] Provider status response:", JSON.stringify(result));

    return {
      status: response.status,
      data: result,
      isFulfilled: result.success === true || result.status?.toUpperCase() === 'SUCCESSFUL' || result.status?.toUpperCase() === 'DELIVERED',
      isFailed: result.status?.toUpperCase() === 'FAILED' || result.status?.toUpperCase() === 'REJECTED'
    };
  } catch (err) {
    console.error("❌ [Reconciliation] Status check failed:", err);
    return null;
  }
}

export type PurchaseSource = "paystack_webhook" | "manual_retry" | "direct_api";

export async function purchaseData(transaction: any, source: PurchaseSource | string = "unknown") {
  // 🚀 FORENSIC TRACING: START
  console.log("=== PURCHASE EXECUTION START ===");
  console.log({
    source,
    transaction_id: transaction.id,
    recipient: transaction.recipient_phone,
    networkKey: transaction.network,
    capacity: transaction.capacity,
    timestamp: new Date().toISOString()
  });
  
  // 🛡️ STEP 2: EXECUTION SOURCE FIREWALL
  const allowedSources = ["paystack_webhook", "manual_retry", "direct_api"];
  if (!allowedSources.includes(source)) {
    const errObj = { error: `Unauthorized purchase execution source: ${source}` };
    console.error(`❌ ${errObj.error}`);
    try {
      await supabase.from("datahub_logs").insert({
        endpoint: "/data-purchase (blocked)",
        status: "blocked_source",
        http_status: 403,
        payload: { transaction_id: transaction.id, source },
        response: errObj,
        created_at: new Date().toISOString()
      });
    } catch(e) {}
    throw new Error(errObj.error);
  }

  // 🛡️ STEP 6: STRICT TRANSACTION SAFETY GATES
  console.log("INITIAL STATE:", {
    status: transaction.status,
    vtu_status: transaction.vtu_status,
    external_reference: transaction.external_reference
  });

  // Support multiple valid success states
  const isPaid = 
    transaction.status === "paid" || 
    transaction.status === "success" || 
    transaction.payment_status === "paid" || 
    transaction.payment_status === "success";

  if (!isPaid) {
    console.error("❌ [Safety Reject] Payment not verified. Status:", transaction.status);
    throw new Error(`Payment verification required: Current status is ${transaction.status}`);
  }

  // 🛡️ STEP 5: PROVIDER RECONCILIATION before retry
  if (source === "manual_retry") {
    // If we have any reference, check provider first
    const refToCheck = transaction.external_reference || transaction.id;
    const providerStatus = await checkProviderTransactionStatus(refToCheck);
    
    if (providerStatus?.isFulfilled) {
      console.log("✅ [Reconciliation] Provider already fulfilled this order. Repairing local state.");
      await supabase.from("transactions").update({
        vtu_status: 'success',
        delivery_status: 'delivered',
        external_reference: providerStatus.data?.data?.reference || transaction.external_reference || refToCheck,
        updated_at: new Date().toISOString()
      }).eq("id", transaction.id);
      
      return { success: true, message: "Reconciled: Already fulfilled", vtu_status: 'success' };
    }
  }

  // Idempotency: Don't re-run if we already have a provider ref, UNLESS it's a manual retry 
  // and we suspect the previous call failed or was lost
  if (transaction.external_reference && source !== "manual_retry") {
    console.warn("🛑 [Idempotency Block] Transaction already has external_reference:", transaction.external_reference);
    return { success: true, message: "Already processed at provider level", external_reference: transaction.external_reference };
  }

  const isLockedStatus = ["success", "completed", "delivered"].includes(transaction.vtu_status);
  
  // 🛡️ STEP 3: STALE PROCESSING DETECTION
  const isStale = transaction.vtu_status === "processing" && 
                 transaction.updated_at && 
                 (Date.now() - new Date(transaction.updated_at).getTime() > 600000); // 10 minutes

  // Only lock "processing" if it's NOT a manual retry and NOT stale. 
  if (isLockedStatus || (transaction.vtu_status === "processing" && source !== "manual_retry" && !isStale)) {
    console.log(`✅ [Safety Gate] Transaction already ${transaction.vtu_status}. Skipping.`);
    return { success: true, message: `Already ${transaction.vtu_status}`, vtu_status: transaction.vtu_status };
  }

  if (transaction.status === "cancelled") {
    console.error("❌ [Safety Reject] Cancelled transaction blocked");
    throw new Error("Cancelled transaction blocked from purchase execution");
  }

  // 🛡️ STEP 8: RECIPIENT NORMALIZATION (REGEX /^0\d{9}$/)
  let recipient = (transaction.recipient_phone || "").trim().replace(/\D/g, "");
  
  if (recipient.startsWith("233") && recipient.length > 10) {
    recipient = "0" + recipient.slice(3);
  } else if (recipient.length === 9 && !recipient.startsWith("0")) {
    recipient = "0" + recipient;
  }
  
  if (!/^0\d{9}$/.test(recipient)) {
     console.error(`❌ [Safety Reject] Invalid recipient format: ${transaction.recipient_phone} -> ${recipient}`);
     await supabase.from("transactions").update({
       vtu_status: 'failed',
       error_message: `Recipient normalization failed: ${recipient}`
     }).eq("id", transaction.id);
     
     throw new Error(`Invalid recipient number: ${recipient}. Must match 0XXXXXXXXX.`);
  }

  // 🛡️ STEP 7: LOCK PROVIDER NETWORK NORMALIZATION
  const networkMapping: Record<string, string> = {
    'mtn': 'YELLO',
    'airteltigo-ishare': 'AT_PREMIUM',
    'telecel': 'TELECEL',
    'vodafone': 'TELECEL',
    'airteltigo-bigtime': 'AT_BIGTIME',
    'at': 'AT_PREMIUM'
  };

  const rawNetwork = String(transaction.network || "").toLowerCase();
  const networkKey = networkMapping[rawNetwork] || transaction.network?.toUpperCase();
  
  console.log("NETWORK MAPPED:", networkKey);

  // 📦 Payload Preparation
  const capacity = transaction.datahub_capacity || transaction.capacity || "";
  let finalCapacity = typeof capacity === 'string' ? capacity.toUpperCase().replace("GB", "").trim() : String(capacity);
  
  if (finalCapacity.includes("MB")) {
    finalCapacity = finalCapacity.replace("MB", "").trim();
  }

  const payload = {
    networkKey: networkKey,
    recipient,
    capacity: finalCapacity,
    reference: transaction.id
  };

  const maxAttempts = 1; // 🚀 User requested MAX_RETRIES = 0, so 1 attempt
  let attempts = 0;
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`=== ATTEMPT ${attempts}/${maxAttempts} ===`);
      
      const { apiKey, baseUrl } = await getDataHubConfig();
      
      if (!apiKey) {
        throw new Error("DataHub API key is missing in settings");
      }

      // 🛡️ Final URL Construction (Double Guarded)
      const base = baseUrl.replace(/\/+$/, "");
      const endpoint = `${base}/data-purchase`;
      
      console.log("=== FINAL DATAHUB URL ===");
      console.log(endpoint);
      console.log("=== DATAHUB REQUEST PAYLOAD ===");
      console.log(payload);
      console.log("=== DATAHUB REQUEST HEADERS ===");
      console.log({
        "Content-Type": "application/json",
        "X-API-Key": apiKey ? "PRESENT" : "MISSING",
        "Accept": "application/json"
      });

      // 🛡️ STEP 7: DO NOT set "processing" before the call begins
      // We will only update status to processing IF the provider accepts the request.
      console.log("=== INITIATING PROVIDER CALL ===");

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Accept": "application/json"
        },
        timeout: 20000, 
        validateStatus: () => true
      });

      const result = response.data;
      
      console.log("=== DATAHUB RAW RESPONSE ===");
      console.log({
        status: response.status,
        data: result
      });

      // 🛡️ Handle HTML 404 responses
      if (typeof result === 'string' && result.includes('<!DOCTYPE html>')) {
        console.error("=== DATAHUB HTML ERROR DETECTED ===");
        lastError = `HTTP ${response.status}: Endpoint returned HTML (Malformed URL suspected: ${endpoint})`;
        if (attempts >= maxAttempts) break;
        continue; 
      }
      
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
        console.log("✅ DATAHUB EXECUTION SUCCESSFUL");
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
          external_reference: orderId,
          ...result 
        };
      }

      // If not successful and we have retries left, continue
      lastError = result.message || result.error || JSON.stringify(result);
      console.warn(`🛑 [DataHub] attempt failed: ${lastError}`);
      
    } catch (err: any) {
      console.error("=== DATAHUB REQUEST EXCEPTION ===");
      if (err.response) {
        lastError = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
        console.error("RESPONSE DATA:", err.response.data);
      } else {
        lastError = err.message;
        console.error("ERROR MESSAGE:", err.message);
      }
      if (attempts >= maxAttempts) break;
    }
  }

  // If we reach here, attempts exhausted
  console.error("=== FINAL FAILURE: ATTEMPTS EXHAUSTED ===");
  await supabase.from("transactions").update({ 
    vtu_status: 'failed', 
    status: 'failed', 
    error_message: lastError,
    api_response: { error: lastError, attempts } 
  }).eq("id", transaction.id);
  
  return { success: false, error: lastError };
}
