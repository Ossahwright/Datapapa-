/**
 * ⚠️ PRODUCTION-CRITICAL FILE
 * Core server utilities for Supabase and DataHub operations.
 * Unauthorized modifications may break live purchases.
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

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
 * We do not fabricate a fake polling status endpoint because DataHub does not have one we know.
 */
export async function checkProviderTransactionStatus(transactionIdOrRef: string) {
  // DATAHUB GH DOES NOT HAVE A RELIABLE STATUS ENDPOINT.
  console.log(`🔍 [Reconciliation] Skipped API polling for ${transactionIdOrRef}. DataHub relies on Webhook.`);
  return { error: "No status found", isWebhookDriven: true };
}

/**
 * 🛠️ RECONCILE TRANSACTION
 * Forces a local transaction to sync with provider state (if possible).
 */
export async function reconcileTransaction(transactionId: string) {
  console.log(`=== [Reconcile] Starting reconciliation for: ${transactionId} ===`);
  
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
    
  if (fetchError || !tx) {
    console.error(`❌ [Reconcile] Transaction ${transactionId} not found`);
    return { success: false, error: "Not found" };
  }
  
  if (tx.vtu_status === "provider_accepted" || tx.vtu_status === "awaiting_provider_confirmation") {
     const age = Date.now() - new Date(tx.updated_at).getTime();
     const timestamp = new Date().toISOString();
     
     // Eventual Consistency Timestamps
     // 0-45 mins: awaiting_provider_confirmation
     // 45-90 min: delayed_provider_processing
     // 90-180 min: reconciliation_pending
     // 3h+: manual_review_required
     
     let newVtuStatus = tx.vtu_status;
     if (age > 3 * 60 * 60 * 1000) newVtuStatus = "manual_review_required";
     else if (age > 90 * 60 * 1000) newVtuStatus = "reconciliation_pending";
     else if (age > 45 * 60 * 1000) newVtuStatus = "delayed_provider_processing";
     else if (tx.vtu_status === "provider_accepted") newVtuStatus = "awaiting_provider_confirmation";

     if (newVtuStatus !== tx.vtu_status) {
         console.log(`⏳ [Reconcile] Escalating state for ${tx.id} from ${tx.vtu_status} to ${newVtuStatus}`);
         await supabase.from("transactions").update({
            vtu_status: newVtuStatus,
            updated_at: timestamp
         }).eq("id", transactionId);
         return { success: true, status: newVtuStatus, raw: "webhook-driven" };
     }
  }

  return { success: true, status: tx.vtu_status, raw: "webhook-driven" };
}

export type PurchaseSource = "paystack_webhook" | "manual_retry" | "direct_api";

export async function purchaseData(transaction: any, source: PurchaseSource | string = "unknown") {
  console.log("=== DATAHUB EXECUTION START ===");
  console.log("TRANSACTION:", transaction.id);

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
  const isPaid = 
    transaction.status === "paid" || 
    transaction.status === "payment_verified" || 
    transaction.status === "success" || 
    transaction.payment_status === "paid" || 
    transaction.payment_status === "success" ||
    source === "manual_retry" || 
    source === "direct_api"; 

  console.log(`🛡️ [${executionId}] Security Audit:`, { 
    isPaid, 
    source, 
    txStatus: transaction.status, 
    txVtuStatus: transaction.vtu_status 
  });

  if (!isPaid) {
    console.error(`❌ [${executionId}] Safety Reject: Payment not verified. Status:`, transaction.status);
    throw new Error(`Payment verification required: Current status is ${transaction.status}`);
  }

  // Set provider execution started
  await supabase.from("transactions").update({ vtu_status: 'provider_execution_started', updated_at: new Date().toISOString() }).eq("id", transaction.id);

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
    'at': 'AT_PREMIUM'
  };
  const networkKey = networkMapping[String(transaction.network || "").toLowerCase()] || transaction.network?.toUpperCase();

  // 📦 Capacity Normalization & Forensic Audit
  const rawCapacity = transaction.datahub_capacity || transaction.capacity || "";
  const finalCapacity = normalizeDataHubPlan(rawCapacity);

  console.log(`📦 [${executionId}] Capacity Audit:`, { 
    raw: rawCapacity, 
    normalized: finalCapacity, 
    network: networkKey 
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

  const payload = { networkKey, recipient, capacity: finalCapacity, reference: transaction.id };
  console.log(`📡 [${executionId}] FINAL PROVIDER PAYLOAD:`, JSON.stringify(payload));
  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) throw new Error("DataHub API key is missing");

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;

  try {
    console.log(`🚀 [${executionId}] Calling Provider API...`);
    const response = await axios.post(endpoint, payload, {
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Accept": "application/json" },
      timeout: 25000, 
      validateStatus: () => true
    });

    const result = response.data;
    console.log(`📡 [${executionId}] Provider Response:`, response.status, JSON.stringify(result));

    // 🛡️ ATOMIC PERSISTENCE BLOCK
    const providerReference =
      (response as any)?.data?.data?.reference ||
      (response as any)?.data?.reference ||
      (response as any)?.reference ||
      null;
    const isAccepted = (response.status >= 200 && response.status < 300) && (
      result.success === true || result.status === true || 
      ["SUCCESSFUL", "PROCESSING", "SUCCESS", "DELIVERED", "PENDING"].includes(String(result.status || "").toUpperCase()) ||
      result.code === 200 || result.code === '200'
    );

    if (isAccepted || providerReference) {
      console.log(`=== [${executionId}] PROVIDER ACCEPTED ===`);
      console.log(`✅ [${executionId}] ATOMIC COMMITTING REF:`, providerReference);
      
      const { error: atomicError } = await supabase
        .from("transactions")
        .update({
          vtu_status: 'provider_accepted',
          provider_reference: providerReference,
          external_reference: providerReference,
          internal_reference: transaction.id,
          provider_payload: result,
          provider_accepted_at: new Date().toISOString(),
          reconciliation_state: 'awaiting_provider_confirmation',
          api_response: result,
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.id);
        
      console.log(`=== [${executionId}] ACCEPTANCE COMMITTED ===`);
      if (providerReference) console.log(`=== [${executionId}] PROVIDER REFERENCE SAVED ===`);
      
      if (atomicError) {
        console.error(`❌ [${executionId}] ATOMIC PERSISTENCE FAILURE:`, atomicError.message);
      }

      return { success: true, vtu_status: 'provider_accepted', provider_reference: providerReference, external_reference: providerReference, ...result };
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
