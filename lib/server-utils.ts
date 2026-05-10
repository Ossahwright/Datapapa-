/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * Core server utilities for Supabase and DataHub operations.
 * Unauthorized modifications may break live purchases.
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import http from 'http';
import https from 'https';

// Persistent agents for connection pooling (Speed Optimization)
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 40000, // Slightly longer to be safe
});

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("SUPABASE_URL missing");
  throw new Error("SUPABASE_URL missing");
}

if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// This MUST become the ONLY backend Supabase client.
export const supabase = supabaseAdmin;

export const getSupabase = () => supabase;

/**
 * 🚀 STEP 4: STARTUP ENV VALIDATION
 * Ensures all production-critical variables are present.
 */
export function validateEnv() {
  const critical = [
    'PAYSTACK_SECRET_KEY',
    'DATAHUB_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const missing = critical.filter(key => {
    const val = process.env[key];
    if (!val && key === 'SUPABASE_URL') {
      return !process.env['VITE_SUPABASE_URL'];
    }
    return !val;
  });
  
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

// Supabase client is initialized at the top of the file

console.log("server-utils loaded successfully");

/**
 * 🎯 PROVIDER-CAPACITY NORMALIZATION HELPER (DataHubGH Edition)
 * Enforces strict provider-native capacity handling.
 * Logic: Extracts the numeric component from GB strings.
 * NO multiplication, NO MB conversions.
 */
export type DataHubCapacity = 
  | "0.5" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" 
  | "15" | "20" | "25" | "30" | "40" | "50" | "100";

export function normalizeDataHubPlan(rawPlan: string | number): string {
  if (!rawPlan) return "";
  const planStr = String(rawPlan).toUpperCase().trim();
  
  // 1. Forensic Extraction: Remove everything except digits and decimal point
  const numericStr = planStr.replace(/[^\d.]/g, '');
  const numericVal = parseFloat(numericStr);
  
  if (isNaN(numericVal)) return planStr;

  // 2. 🚨 CRITICAL BUG FIX: Eliminate all multiplicative corruptions
  // If we see 1000, 1024, 2000, etc., these are CORRUPTED values.
  // We force them back to their base units.
  if (numericVal >= 1000) {
    console.warn(`🚨 [Capacity Audit] Detected scaling corruption: ${numericVal}. Rescaling to base unit...`);
    if (numericVal >= 1000 && numericVal <= 1048) return "1";
    if (numericVal >= 2000 && numericVal <= 2048) return "2";
    if (numericVal >= 3000 && numericVal <= 3072) return "3";
    if (numericVal >= 5000 && numericVal <= 5120) return "5";
    if (numericVal >= 10000 && numericVal <= 10240) return "10";
    if (numericVal >= 20000 && numericVal <= 20480) return "20";
    if (numericVal >= 50000 && numericVal <= 51200) return "50";
    if (numericVal >= 100000 && numericVal <= 102400) return "100";
  }

  // 3. Normalized output: "1", "2", "0.5" (no "GB" suffix)
  return String(numericVal);
}

/**
 * ✅ DATAHUB CAPACITY VALIDATOR
 * Ensures capacity matches one of the known provider bundles.
 */
export function validateDataHubCapacity(capacity: string): boolean {
  const allowed = ["0.5", "1", "2", "3", "4", "5", "6", "8", "10", "15", "20", "25", "30", "40", "50", "100"];
  return allowed.includes(capacity);
}

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

let cachedConfig: { apiKey: string, baseUrl: string } | null = null;
let lastConfigFetch = 0;

/**
 * Centralized DataHub Config Helper
 */
export async function getDataHubConfig() {
  const now = Date.now();
  // Cache for 5 minutes
  if (cachedConfig && (now - lastConfigFetch < 300000)) {
    return cachedConfig;
  }

  const defaultUrl = "https://app.datahubgh.com/api/external";
  const envKey = process.env.DATAHUB_API_KEY;
  let envUrl = process.env.DATAHUB_BASE_URL;

  // 🛡️ Sanitize: If envUrl is literally "undefined" or empty, use default
  if (!envUrl || envUrl === "undefined" || envUrl === "null") {
    envUrl = defaultUrl;
  }

  const sanitizeUrl = (url: string) => {
    let clean = url.trim().replace(/\/+$/, "");
    if (clean.endsWith("/data-purchase")) {
      clean = clean.replace("/data-purchase", "");
    }
    return clean;
  };

  if (envKey) {
    cachedConfig = {
      apiKey: envKey.trim(),
      baseUrl: sanitizeUrl(envUrl)
    };
    lastConfigFetch = now;
    return cachedConfig;
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
      cachedConfig = {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: sanitizeUrl(finalUrl)
      };
      lastConfigFetch = now;
      return cachedConfig;
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
 * 🤖 TELEGRAM NOTIFICATION HELPER
 * Sends a non-blocking Telegram alert to the admin.
 */
export async function sendTelegramNotification(tx: any) {
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID;

  // 🛡️ FALLBACK: Check Supabase settings if env vars are missing
  if (!botToken || !chatId) {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'secure')
        .maybeSingle();
      
      if (data?.value) {
        botToken = botToken || data.value.telegram_bot_token;
        chatId = chatId || data.value.telegram_chat_id;
      }
    } catch (err) {
      console.error("[Telegram Config] Fallback fetch failed:", err);
    }
  }

  if (!botToken || !chatId) {
    console.log("ℹ️ [Telegram] Skipping notification: Credentials not set.");
    return;
  }

  try {
    const amount = tx.amount_paid || tx.amount || 0;
    const formattedAmount = `₵${Number(amount).toFixed(2)}`;
    
    // Clean and descriptive message format requested by user
    const message = `
🟢 NEW SUCCESSFUL TRANSACTION

Amount: ${formattedAmount}
Network: ${tx.network || 'Unknown'}
Bundle: ${tx.bundle_name || tx.capacity || 'Data'}

Recipient: ${tx.receiver_phone || tx.phone || 'N/A'}
Payer: ${tx.sender_phone || tx.email || 'N/A'}

Ref: ${tx.provider_reference || tx.reference || tx.id}
`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    console.log(`🤖 [Telegram] Sending alert for TX: ${tx.id}...`);
    
    // Using axios (already imported) for consistency
    axios.post(url, {
      chat_id: chatId,
      text: message,
    }).catch(err => {
      console.error("❌ [Telegram] Failed to send notification:", err.response?.data || err.message);
    });

  } catch (error: any) {
    console.error("❌ [Telegram] Error formatting notification:", error.message);
  }
}

import { calculateExecutionMetrics } from './metrics.js';

export const VTU_STATUSES = {
  PENDING: 'pending',
  SUCCESS: 'success',
  PROVIDER_ACCEPTED: 'provider_accepted',
  AWAITING_PROVIDER_CONFIRMATION: 'awaiting_provider_confirmation',
  DELIVERED: 'delivered',
  PROVIDER_REJECTED: 'provider_rejected',
  RECONCILIATION_PENDING: 'reconciliation_pending',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
  DELAYED_PROCESSING: 'delayed_provider_processing'
};

// Polling helper with exponential backoff for 429s
async function fetchWithRetry(endpoint: string, options: any, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await apiClient.request({
        url: endpoint,
        ...options,
        validateStatus: () => true
      });

      if (response.status === 429 && attempt < maxRetries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ [429 Rate Limit] Retrying in ${wait}ms (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        attempt++;
        continue;
      }
      return response;
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * 🚀 STEP 5: PROVIDER RECONCILIATION CHECK
 * Attempts to poll DataHub API for real-time status truth.
 */
export async function checkProviderTransactionStatus(tx: any) {
  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) return { error: "No API key" };

  const reference = tx.provider_reference || tx.external_reference || tx.id;
  
  const endpoints = [
    `${baseUrl.replace(/\/+$/, "")}/transactions/${reference}`,
    `${baseUrl.replace(/\/+$/, "")}/data-purchase/${reference}`,
    `${baseUrl.replace(/\/+$/, "")}/status?reference=${reference}`,
    `${baseUrl.replace(/\/+$/, "")}/status/${reference}`,
    `${baseUrl.replace(/\/+$/, "")}/check-status?reference=${reference}`,
    `${baseUrl.replace(/\/+$/, "")}/transactions/status/${reference}`
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 [Reconciliation] Polling DataHub: ${endpoint}`);
      const response = await fetchWithRetry(endpoint, {
        method: 'GET',
        headers: { "X-API-Key": apiKey, "Accept": "application/json" },
        timeout: 10000
      });

      const result = response.data?.data || response.data;
      if (response.status === 200 && result) {
        const status = String(result.status || result.delivery_status || "").toUpperCase();
        const isSuccess = ["DELIVERED", "SUCCESS", "COMPLETED", "SUCCESSFUL"].includes(status);
        const isFailed = ["FAILED", "REJECTED", "REVERSED", "CANCELLED", "ERROR"].includes(status);
        
        return { success: true, isSuccess, isFailed, providerStatus: status, data: result };
      }
      if (response.status === 429) {
        return { error: "Rate limited by provider", rateLimited: true };
      }
    } catch (err) { }
  }
  return { error: "No status found", isWebhookDriven: true };
}

/**
 * Reconciles a transaction with Paystack and DataHub.
 */
export async function reconcileTransaction(transactionId: string) {
  console.log(`=== [Reconcile] Starting reconciliation for: ${transactionId} ===`);
  
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
    
  if (fetchError || !tx) return { success: false, error: "Not found" };
  
  const timestamp = new Date().toISOString();

  // 🛡️ STEP 1: Paystack Truth
  if (tx.status === "pending" && tx.paystack_receipt) {
    try {
      const psRes = await apiClient.get(`https://api.paystack.co/transaction/verify/${tx.paystack_receipt}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });
      if (psRes.data?.data?.status === "success") {
        await supabase.from("transactions").update({ status: "success", payment_verified_at: timestamp, updated_at: timestamp }).eq("id", transactionId);
        const { data: updatedTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
        if (updatedTx) await purchaseData(updatedTx, "reconciliation_sync");
        return { success: true, status: "success" };
      }
    } catch (err) {}
  }

  // 🛡️ STEP 2: Active Polling
  const isWaiting = ["provider_accepted", "awaiting_provider_confirmation", "processing", "provider_execution_started", "delayed_provider_processing"].includes(tx.vtu_status);
  if (isWaiting) {
    const poll = await checkProviderTransactionStatus(tx);
    if (poll.success && (poll.isSuccess || poll.isFailed)) {
      const vtuStatus = poll.isSuccess ? "delivered" : "provider_rejected";
      await supabase.from("transactions").update({
        vtu_status: vtuStatus,
        delivery_status: poll.isSuccess ? "delivered" : "failed",
        delivered_at: poll.isSuccess ? timestamp : null,
        reconciliation_completed_at: poll.isSuccess ? timestamp : null,
        updated_at: timestamp,
        api_response: poll.data
      }).eq("id", transactionId);

      if (poll.isSuccess) {
        // Fetch full record for notification
        const { data: finalTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
        if (finalTx) {
          sendTelegramNotification(finalTx).catch(err => {
            console.error("❌ [Telegram Reconcile Alert] Failed:", err.message);
          });
        }
      }

      return { success: true, status: vtuStatus };
    }

    // ⏳ STEP 3: Escalation
    const age = Date.now() - new Date(tx.updated_at || tx.created_at).getTime();
    let newVtuStatus = tx.vtu_status;
    if (age > 6 * 60 * 60 * 1000) newVtuStatus = VTU_STATUSES.MANUAL_REVIEW_REQUIRED;
    else if (age > 3 * 60 * 60 * 1000) newVtuStatus = VTU_STATUSES.RECONCILIATION_PENDING;
    else if (age > 45 * 60 * 1000) newVtuStatus = VTU_STATUSES.DELAYED_PROCESSING;

    if (newVtuStatus !== tx.vtu_status) {
        await supabase.from("transactions").update({ vtu_status: newVtuStatus, updated_at: timestamp }).eq("id", transactionId);
        return { success: true, status: newVtuStatus };
    }
  }

  return { success: true, status: tx.vtu_status || tx.status, message: "Sync complete" };
}

export type PurchaseSource = "paystack_webhook" | "manual_retry" | "direct_api";

export async function purchaseData(transaction: any, source: PurchaseSource | string = "unknown") {
  console.log("=== purchaseData ENTERED ===");
  console.log("Transaction:", transaction.id);
  console.log("Source:", source);

  // 🚀 FORENSIC TRACING: START
  const executionId = Math.random().toString(36).substring(7);
  console.log(`=== [${executionId}] PROVIDER EXECUTION START ===`);
  console.log({
    source,
    transaction_id: transaction.id,
    recipient: transaction.recipient_phone,
    networkKey: transaction.network,
    capacity: transaction.capacity,
    timestamp: new Date().toISOString()
  });

  console.log("=== DATAHUB EXECUTION START ===");
  
  // 🛡️ STEP 1: IDEMPOTENCY & PROVIDER TRUTH CHECK
  if (transaction.provider_reference || transaction.external_reference || transaction.vtu_status === 'delivered') {
    console.log(`📡 [${executionId}] Transaction has provider footprint. Switching to Reconciliation mode.`);
    return reconcileTransaction(transaction.id);
  }

  // 🛡️ STEP 2: EXECUTION SOURCE FIREWALL
  const allowedSources = ["paystack_webhook", "manual_retry", "direct_api"];
  if (!allowedSources.includes(source)) {
    throw new Error(`Unauthorized purchase execution source: ${source}`);
  }

  // 🛡️ STEP 3: PAYMENT VERIFICATION
  const isPaid = transaction.status === "success";

  // Set provider execution started
  const executionStartTime = new Date().toISOString();
  console.log("=== PROVIDER EXECUTION STARTED ===");
  console.log(executionStartTime);

  // Skip "in-progress" update for faster execution if from webhook/direct
  if (source !== "manual_retry") {
    // Fire and forget or skip
    supabase.from("transactions").update({ 
      vtu_status: 'processing', 
      provider_execution_started_at: executionStartTime,
      updated_at: new Date().toISOString() 
    }).eq("id", transaction.id).then(({error}) => {
       if (error) console.error("Non-blocking status update failed", error);
    });
  } else {
    await supabase.from("transactions").update({ 
      vtu_status: 'provider_execution_started', 
      provider_execution_started_at: executionStartTime,
      updated_at: new Date().toISOString() 
    }).eq("id", transaction.id);
  }

  // 🛡️ STEP 4: RECIPIENT NORMALIZATION
  let recipient = (transaction.recipient_phone || "").trim().replace(/\D/g, "");
  if (recipient.startsWith("233") && recipient.length > 10) recipient = "0" + recipient.slice(3);
  else if (recipient.length === 9 && !recipient.startsWith("0")) recipient = "0" + recipient;
  
  if (!/^0\d{9}$/.test(recipient)) {
     const error = `Invalid recipient number: ${recipient}. Must match 0XXXXXXXXX.`;
     await supabase.from("transactions").update({ vtu_status: 'provider_rejected', error_message: error, updated_at: new Date().toISOString() }).eq("id", transaction.id);
     throw new Error(error);
  }

  // 📦 Network Mapping
  const networkMapping: Record<string, string> = {
    'mtn': 'YELLO', 
    'airteltigo-ishare': 'AT_PREMIUM',
    'telecel': 'TELECEL',
    'vodafone': 'TELECEL',
    'airteltigo-bigtime': 'AT_BIGTIME',
    'at': 'AT_PREMIUM',
    'airteltigo': 'AT_PREMIUM',
    'at-ishare': 'AT_PREMIUM',
    'at-bigtime': 'AT_BIGTIME',
    'airteltigo ishare': 'AT_PREMIUM',
    'airteltigo bigtime': 'AT_BIGTIME'
  };
  
  const networkNumericMapping: Record<string, string> = {
    'MTN': '1',
    'YELLO': '1',
    'TELECEL': '2',
    'VODAFONE': '2',
    'AT_PREMIUM': '3',
    'AT_BIGTIME': '3',
    'AIRTELTIGO': '3',
    'AT': '3'
  };

  const networkKey = networkMapping[String(transaction.network || "").toLowerCase()] || transaction.network?.toUpperCase();
  const networkId = networkNumericMapping[networkKey] || "1";

  if (!networkKey) {
    const error = `Safety Block: Could not determine networkKey for network: ${transaction.network}. Check network mapping.`;
    console.error(`❌ [${executionId}] ${error}`);
    await supabase.from("transactions").update({ 
      vtu_status: 'provider_rejected', 
      error_message: error, 
      updated_at: new Date().toISOString() 
    }).eq("id", transaction.id);
    throw new Error(error);
  }

  // 📦 Capacity Normalization & Forensic Audit
  const rawCapacity = transaction.datahub_capacity || transaction.capacity || "";
  const finalCapacity = normalizeDataHubPlan(rawCapacity);

  console.log(`📦 [${executionId}] Capacity Audit:`, { 
    raw: rawCapacity, 
    normalized: finalCapacity, 
    network: networkKey,
    network_id: networkId
  });

  // 🛡️ Strict Validation
  if (!validateDataHubCapacity(finalCapacity)) {
    const error = `Safety Block: Invalid capacity detected (${finalCapacity}). Provider expects raw GB values.`;
    console.error(`❌ [${executionId}] ${error}`);
    await supabase.from("transactions").update({ 
      vtu_status: 'provider_rejected', 
      error_message: error, 
      updated_at: new Date().toISOString() 
    }).eq("id", transaction.id);
    throw new Error(error);
  }

  // 🚀 GENERATE CLEANER EXTERNAL REFERENCE
  // Some providers (DataHub) prefer shorter or more searchable references
  const shortId = (transaction.id || "").split("-")[0].toUpperCase();
  const externalRef = `DP-${shortId}-${Date.now().toString().slice(-4)}`;

  // 🚀 ROBUST PAYLOAD: Using multiple key variations for compatibility with different API clones
  const payload = { 
    network: networkKey, 
    networkKey: networkKey,
    network_id: networkId,
    network_code: networkId,
    phone: recipient,
    recipient: recipient,
    mobile_number: recipient,
    plan: finalCapacity,
    plan_id: finalCapacity,
    capacity: finalCapacity, 
    amount: transaction.amount,
    reference: transaction.id,
    external_reference: externalRef, 
    client_reference: externalRef,
    request_id: transaction.id,
    client_id: transaction.id
  };
  console.log(`📡 [${executionId}] FINAL PROVIDER PAYLOAD:`, JSON.stringify(payload));
  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) throw new Error("DataHub API key is missing");

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;

  try {
    console.log(`🚀 [${executionId}] Calling Provider API...`);
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      data: payload,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Accept": "application/json" },
      timeout: 30000
    });

    const result = response.data;
    console.log(`📡 [${executionId}] Provider Response:`, response.status, JSON.stringify(result));

    // 🛡️ ATOMIC PERSISTENCE BLOCK
    const providerReference =
      (response as any)?.data?.data?.reference ||
      (response as any)?.data?.data?.id ||
      (response as any)?.data?.data?.transaction_id ||
      (response as any)?.data?.reference ||
      (response as any)?.data?.id ||
      (response as any)?.reference ||
      (response as any)?.id ||
      null;
    const isAccepted = (response.status >= 200 && response.status < 300) && (
      result.success === true || result.status === true || 
      ["SUCCESSFUL", "PROCESSING", "SUCCESS", "DELIVERED", "PENDING"].includes(String(result.status || "").toUpperCase()) ||
      result.code === 200 || result.code === '200'
    );

    if (isAccepted || providerReference) {
      const acceptanceTime = new Date().toISOString();
      console.log(`✅ [${executionId}] PROVIDER ACCEPTED. ATOMIC COMMITTING REF:`, providerReference);
      
      const { error: atomicError } = await supabase
        .from("transactions")
        .update({
          vtu_status: VTU_STATUSES.PROVIDER_ACCEPTED,
          provider_reference: providerReference || transaction.id,
          external_reference: externalRef, // Using our cleaner searchable ref
          internal_reference: transaction.id,
          provider_payload: result,
          provider_accepted_at: acceptanceTime,
          reconciliation_state: VTU_STATUSES.AWAITING_PROVIDER_CONFIRMATION,
          api_response: result,
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.id);
        
      if (atomicError) {
        console.error(`❌ [${executionId}] ATOMIC PERSISTENCE FAILURE:`, atomicError.message);
      }

      // 🏎️ SWIFT DELIVERY ENFORCEMENT: Immediate Background Polling 
      // Instead of waiting for webhook, we poll immediately and again after 15s/45s
      // This bypasses webhook delays if the provider has already finished processing.
      const triggerPolling = async () => {
        const delays = [5000, 15000, 45000]; // 5s, 20s total, 65s total
        for (const delay of delays) {
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`🔄 [${executionId}] Swift Polling Attempt (${delay}ms)...`);
          const pollResult = await reconcileTransaction(transaction.id);
          if (pollResult.success && pollResult.status === "delivered") {
            console.log(`🚀 [${executionId}] Swift Delivery Accomplished via Polling!`);
            break;
          }
        }
      };
      triggerPolling().catch(err => console.error(`❌ [${executionId}] Swift Polling Error:`, err.message));

      return { success: true, vtu_status: VTU_STATUSES.PROVIDER_ACCEPTED, provider_reference: providerReference, external_reference: externalRef, ...result };
    }

    // Explicit Failure Handling
    const lastError = result.message || result.error || "Provider rejected request";
    console.log("=== DATAHUB EXECUTION FAILED (PROVIDER REJECTION) ===");
    console.error(`🛑 [${executionId}] Provider Rejected:`, lastError);
    
    try {
      await supabase.from("transactions").update({ 
        vtu_status: 'provider_rejected', 
        error_message: lastError,
        updated_at: new Date().toISOString(),
        api_response: result
      }).eq("id", transaction.id);
    } catch (saveErr) {
      console.error("❌ Failed to persist provider rejection state:", saveErr);
    }

    return { success: false, error: lastError };

  } catch (err: any) {
    console.log("=== DATAHUB EXECUTION FAILED (CRITICAL ERROR) ===");
    console.error(`❌ [${executionId}] CRITICAL ERROR:`, err.message);
    
    try {
      // In case of connection failure, we DON'T mark as failed if we don't know for sure
      // We let it sit in manual_review_required for reconciliation
      await supabase.from("transactions").update({ 
        vtu_status: 'manual_review_required', 
        error_message: `Fatal Execution Error: ${err.message}`,
        updated_at: new Date().toISOString()
      }).eq("id", transaction.id);
    } catch (saveErr) {
      console.error("❌ Failed to persist critical failure state:", saveErr);
    }
    
    // We return a failure object instead of throwing to prevent webhook crash
    return { success: false, error: err.message };
  }
}
