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

import { calculateExecutionMetrics } from './metrics.js';
import { findNetworkConfig } from './networkConfig.js';
import { BUNDLE_CONFIG } from './bundleConfig.js';
import { sendTelegramNotification } from './sendTelegramNotification.js';
import { 
  PAYMENT_STATUSES, 
  VTU_STATUSES, 
  EXECUTION_SOURCES, 
  RECONCILIATION_STATES, 
  NETWORK_KEYS, 
  LOG_MARKERS 
} from './constants.js';

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
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyMDI5NywiZXhwIjoyMDkyNTk2Mjk3fQ.jBdQfnv7dd3RgIwPtH1CL5zIuqR5M5ko2kzJ32rsMEo';

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
    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    
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

// Removed duplicated local helper in favor of imported centralized one

// Removed duplicated VTU_STATUSES - now imported from constants.js

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
        const isSuccess = ["DELIVERED", "SUCCESS", "COMPLETED", "SUCCESSFUL", "FULFILLED", "PROCESSED"].includes(status);
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
  console.log(`=== [Reconcile] Starting reconciliation for UUID: ${transactionId} ===`);
  
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
    
  if (fetchError || !tx) {
    console.error(`❌ [Reconcile] UUID ${transactionId} not found in database.`);
    return { success: false, error: "Not found" };
  }
  
  const timestamp = new Date().toISOString();

  // 🛡️ STEP 1: Paystack Truth (Authoritative Verification)
  const needsPaymentVerification = 
    tx.status === PAYMENT_STATUSES.PENDING || 
    tx.status === PAYMENT_STATUSES.INITIALIZED || 
    tx.status === PAYMENT_STATUSES.PAYMENT_PENDING;

  if (needsPaymentVerification) {
    const psReceipts = [tx.paystack_receipt, tx.reference, tx.id, tx.external_reference].filter(Boolean);
    
    console.log(`[Reconcile] Verifying payment for UUID: ${tx.id}. Candidates: ${psReceipts.join(', ')}`);
    
    for (const receipt of psReceipts) {
      try {
        console.log(`[Reconcile] Trying Paystack Receipt: ${receipt}`);
        const psRes = await apiClient.get(`https://api.paystack.co/transaction/verify/${receipt}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });
        
        const psStatus = psRes.data?.data?.status || psRes.data?.status;
        
        if (psStatus === "success" || psStatus === PAYMENT_STATUSES.SUCCESS) {
          console.log(`✅ [Reconcile] Paystack Success for UUID: ${tx.id} using receipt: ${receipt}. Promoting to SUCCESS.`);
          await supabase.from("transactions").update({ 
            status: PAYMENT_STATUSES.PAYMENT_SUCCESS, 
            payment_status: PAYMENT_STATUSES.SUCCESS,
            paystack_receipt: receipt, // Converge on the one that worked
            updated_at: timestamp 
          }).eq("id", transactionId);
          
          const { data: updatedTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
          if (updatedTx) {
            console.log(`[Reconcile] Triggering fulfillment for UUID: ${updatedTx.id}`);
            await purchaseData(updatedTx, EXECUTION_SOURCES.RECONCILIATION_ENGINE);
          }
          return { success: true, status: PAYMENT_STATUSES.PAYMENT_SUCCESS };
        }
      } catch (err: any) {
        console.warn(`[Reconcile] PS Attempt failed for ${receipt}:`, err.message);
      }
    }
  }

  // 🛡️ STEP 2: Active Polling
  const isWaiting = [
    VTU_STATUSES.PROVIDER_ACCEPTED, 
    VTU_STATUSES.AWAITING_PROVIDER_CONFIRMATION, 
    VTU_STATUSES.PROCESSING, 
    VTU_STATUSES.PROVIDER_EXECUTION_STARTED, 
    VTU_STATUSES.DELAYED_PROVIDER_PROCESSING,
    VTU_STATUSES.FULFILLMENT_PROCESSING
  ].includes(tx.vtu_status) || [VTU_STATUSES.FULFILLMENT_PROCESSING].includes(tx.status as any);

  if (isWaiting) {
    console.log(`[Reconcile] UUID: ${tx.id} is in waiting state: ${tx.vtu_status}. Polling provider...`);
    const poll = await checkProviderTransactionStatus(tx);
    if (poll.success && (poll.isSuccess || poll.isFailed)) {
      const vtuStatus = poll.isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.PROVIDER_REJECTED;
      const finalStatus = poll.isSuccess ? VTU_STATUSES.FULFILLED : PAYMENT_STATUSES.FAILED;

      console.log(`✅ [Reconcile] Provider Truth Found for UUID: ${tx.id} -> ${vtuStatus}`);
      await supabase.from("transactions").update({
        status: finalStatus,
        vtu_status: vtuStatus,
        delivery_status: poll.isSuccess ? VTU_STATUSES.DELIVERED : VTU_STATUSES.FAILED,
        updated_at: timestamp,
        api_response: poll.data
      }).eq("id", transactionId);

      if (poll.isSuccess) {
        const { data: finalTx } = await supabase.from("transactions").select("*").eq("id", transactionId).single();
        if (finalTx) {
          sendTelegramNotification({
            category: 'vtu_delivered',
            title: 'VTU Delivered via Reconciliation',
            transaction: finalTx
          }).catch(err => {
            console.error("❌ [Telegram Reconcile Alert] Failed:", err.message);
          });
        }
      }

      return { success: true, status: vtuStatus };
    }

    // ⏳ STEP 3: Escalation (Hardened to prevent premature Manual Review)
    const age = Date.now() - new Date(tx.updated_at || tx.created_at).getTime();
    let newVtuStatus = tx.vtu_status;
    
    // ONLY escalate to Manual Review if payment is successful BUT fulfillment is stuck for too long
    if (tx.payment_status === PAYMENT_STATUSES.SUCCESS) {
      if (age > 6 * 60 * 60 * 1000) newVtuStatus = VTU_STATUSES.MANUAL_REVIEW_REQUIRED;
      else if (age > 3 * 60 * 60 * 1000) newVtuStatus = VTU_STATUSES.RECONCILIATION_PENDING;
      else if (age > 45 * 60 * 1000) newVtuStatus = VTU_STATUSES.DELAYED_PROVIDER_PROCESSING;
    } else {
      // If payment hasn't settled yet, we ONLY escalate to delayed processing, NOT manual review yet.
      // This allows more time for webhooks or standard reconciliation to settle truth.
      if (age > 45 * 60 * 1000 && tx.vtu_status !== VTU_STATUSES.DELAYED_PROVIDER_PROCESSING) {
        newVtuStatus = VTU_STATUSES.DELAYED_PROVIDER_PROCESSING;
      }
    }

    if (newVtuStatus !== tx.vtu_status) {
        await supabase.from("transactions").update({ vtu_status: newVtuStatus, updated_at: timestamp }).eq("id", transactionId);
        return { success: true, status: newVtuStatus };
    }
  }

  return { success: true, status: tx.vtu_status || tx.status, message: "Sync complete" };
}

export type PurchaseSource = "paystack_webhook" | "manual_retry" | "direct_api";

export async function purchaseData(transaction: any, source: string = "unknown") {
  const executionId = Math.random().toString(36).substring(7);
  console.log(`=== [${executionId}] PROVIDER EXECUTION START ===`);
  console.log(`📍 UUID: ${transaction.id}`);
  console.log(`📍 Friendly Ref: ${transaction.reference}`);
  console.log(`📍 Source: ${source}`);

  // 🛡️ STEP 1: IDEMPOTENCY & PROVIDER TRUTH CHECK
  // If we already have a provider reference or it's delivered, do NOT execute again.
  if (transaction.provider_reference || transaction.vtu_status === VTU_STATUSES.DELIVERED || transaction.vtu_status === VTU_STATUSES.FULFILLED) {
    console.log(`📡 [${executionId}] Transaction ${transaction.id} already has provider footprint or is delivered. Skipping execution.`);
    return reconcileTransaction(transaction.id);
  }

  // 🛡️ STEP 1.1: HARDENED IDEMPOTENCY LOCK
  // If execution started recently (within last 2 minutes), block duplicate calls to avoid race conditions.
  if (transaction.provider_execution_started_at) {
    const startedAt = new Date(transaction.provider_execution_started_at).getTime();
    const now = Date.now();
    const diff = now - startedAt;
    if (diff < 120000) { // 2 minutes lock
      console.warn(`🛑 [${executionId}] IDEMPOTENCY ALERT: Execution for ${transaction.id} started ${Math.round(diff/1000)}s ago. Blocking duplicate.`);
      return { success: true, message: "Execution already in progress" };
    }
  }

  // 🛡️ STEP 2: EXECUTION SOURCE FIREWALL
  const allowedSources = [
    EXECUTION_SOURCES.PAYSTACK_WEBHOOK, 
    EXECUTION_SOURCES.ADMIN_RETRY, 
    EXECUTION_SOURCES.DIRECT_API, 
    EXECUTION_SOURCES.MANUAL_RETRY,
    EXECUTION_SOURCES.RECONCILIATION_ENGINE
  ];
  if (!allowedSources.includes(source as any)) {
    console.error(`❌ [${executionId}] Unauthorized execution source attempted: ${source}`);
    throw new Error(`Unauthorized purchase execution source: ${source}`);
  }

  // 🛡️ STEP 3 & 8 — HARDEN purchaseData() EXECUTION GUARD
  // STRICT REQUIREMENT: payment_status MUST be success
  const isPaymentVerified = 
    transaction.payment_status === "success" || 
    transaction.payment_status === PAYMENT_STATUSES.SUCCESS;
    
  if (!isPaymentVerified) {
    console.error(`❌ [${executionId}] SAFETY BLOCK: Payment not authoritatively verified for ${transaction.id}. Status: ${transaction.payment_status}`);
    return { success: false, error: "Payment not verified" };
  }

  // Ensure overall status reflects success/paid to allow fulfillment
  const isStatusValid = 
    transaction.status === "success" || 
    transaction.status === PAYMENT_STATUSES.SUCCESS || 
    transaction.status === PAYMENT_STATUSES.PAID || 
    transaction.status === PAYMENT_STATUSES.PAYMENT_SUCCESS ||
    transaction.status === VTU_STATUSES.FULFILLMENT_PROCESSING;

  if (!isStatusValid) {
    console.error(`❌ [${executionId}] SAFETY BLOCK: Transaction status invalid for fulfillment: ${transaction.status}`);
    return { success: false, error: "Invalid transaction status" };
  }

  console.log(`✅ [${executionId}] Payment Convergence Validated for UUID: ${transaction.id}`);

  // 🛡️ STEP 3.5: ATOMIC FULFILLMENT LOCK
  // We use an atomic update with a status check to ensure only one process wins.
  const { data: lockedTx, error: lockError } = await supabase
    .from("transactions")
    .update({ 
      status: VTU_STATUSES.FULFILLMENT_PROCESSING,
      vtu_status: VTU_STATUSES.PROCESSING,
      updated_at: new Date().toISOString()
    })
    .eq("id", transaction.id)
    .or(`status.eq.${PAYMENT_STATUSES.SUCCESS},status.eq.${PAYMENT_STATUSES.PAID},status.eq.${PAYMENT_STATUSES.PAYMENT_SUCCESS}`)
    .select()
    .single();

  if (lockError || !lockedTx) {
    console.log(`📡 [${executionId}] Transaction ${transaction.id} already locked or state changed. Redirecting to reconciliation.`);
    return reconcileTransaction(transaction.id);
  }

  console.log(`🔒 [${executionId}] Atomic Lock Acquired for UUID: ${transaction.id}`);

  // 🛡️ STEP 4: RECIPIENT NORMALIZATION
  let recipient = (transaction.recipient_phone || "").trim().replace(/\D/g, "");
  if (recipient.startsWith("233") && recipient.length > 10) recipient = "0" + recipient.slice(3);
  else if (recipient.length === 9 && !recipient.startsWith("0")) recipient = "0" + recipient;
  
  if (!/^0\d{9}$/.test(recipient)) {
     const error = `Invalid recipient number: ${recipient}. Must match 0XXXXXXXXX.`;
     await supabase.from("transactions").update({ vtu_status: 'provider_rejected', error_message: error, updated_at: new Date().toISOString() }).eq("id", transaction.id);
     throw new Error(error);
  }

  // 🚀 AUTHENTIC TELECOM NORMALIZATION
  console.log("=== BUNDLE NORMALIZATION ===");
  
  const networkKey = transaction.provider_network_key || transaction.datahub_network_key || transaction.network_key;
  const finalCapacity = transaction.provider_capacity || transaction.datahub_capacity || transaction.capacity;

  if (!networkKey || !finalCapacity) {
    const error = `Safety Block: Missing Normalized Provider Keys. (NR: ${networkKey}, CAP: ${finalCapacity})`;
    console.error(`❌ [${executionId}] ${error}`);
    await supabase.from("transactions").update({ 
      vtu_status: 'provider_rejected', 
      error_message: error, 
      updated_at: new Date().toISOString() 
    }).eq("id", transaction.id);
    throw new Error(error);
  }

  // 🚀 AUTHORITATIVE IDENTITY NORMALIZATION
  // We strictly use the transaction UUID for provider reconciliation and internal sync.
  const authoritativeId = transaction.id;
  
  // 📦 Network Numeric Mapping
  const networkNumericMapping: Record<string, string> = {
    [NETWORK_KEYS.MTN]: '1',
    [NETWORK_KEYS.VODA]: '2',
    [NETWORK_KEYS.TELECEL]: '2',
    [NETWORK_KEYS.AT_PREMIUM]: '3',
    [NETWORK_KEYS.AT_BIGTIME]: '3'
  };
  const networkId = networkNumericMapping[networkKey] || "1";

  // 🚀 ROBUST PAYLOAD
  // We send the transaction.id as the primary reference to ensure convergence.
  const payload = { 
    networkKey: networkKey,
    network_id: networkId,
    recipient: recipient,
    phone: recipient, 
    capacity: finalCapacity, 
    plan: finalCapacity, 
    amount: transaction.amount,
    reference: authoritativeId, // 🚀 AUTHORITATIVE ANCHOR
    external_reference: authoritativeId, 
    client_reference: authoritativeId
  };

  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) throw new Error("DataHub API key is missing");

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;

  // 🚀 STEP 10 — IMPLEMENT EXECUTION TIMESTAMP INTEGRITY
  // Update state IMMEDIATELY BEFORE actual DataHub API request
  await supabase.from("transactions").update({
    vtu_status: VTU_STATUSES.PROVIDER_EXECUTION_STARTED,
    external_reference: authoritativeId, // 🚀 AUTHORITATIVE CONVERGENCE
    updated_at: new Date().toISOString()
  }).eq("id", authoritativeId);

  // 🚀 STEP 9 — IMPLEMENT PROVIDER EXECUTION TRUTH LOGGING
  try {
    console.log("=== AUTHORITATIVE PROVIDER EXECUTION START ===");
    console.log(`📍 UUID: ${authoritativeId}`);
    console.log(`📍 Endpoint: ${endpoint}`);
    
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      data: payload,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, "Accept": "application/json" },
      timeout: 30000
    });

    console.log("=== DATAHUB RESPONSE RECEIVED ===");
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
          status: VTU_STATUSES.FULFILLMENT_PROCESSING,
          vtu_status: VTU_STATUSES.PROVIDER_ACCEPTED,
          provider_reference: providerReference || authoritativeId,
          external_reference: providerReference || authoritativeId,
          provider_payload: result,
          reconciliation_state: RECONCILIATION_STATES.AWAITING_PROVIDER_CONFIRMATION,
          api_response: result,
          updated_at: new Date().toISOString()
        })
        .eq("id", authoritativeId);
        
      if (atomicError) {
        console.error(`❌ [${executionId}] ATOMIC PERSISTENCE FAILURE:`, atomicError.message);
      }

      // 📱 Trigger Telegram Notification for Delivery
      // Robust success detection for immediate notification
      const isActuallyDelivered = 
        result.status === 'DELIVERED' || 
        result.status === 'SUCCESS' || 
        result.success === true ||
        (result.data?.status === 'DELIVERED' || result.data?.status === 'SUCCESS');

      if (isActuallyDelivered) {
          const { data: finalTxState } = await supabase.from("transactions").select("*").eq("id", authoritativeId).single();
          if (finalTxState) {
              sendTelegramNotification({
                  category: 'vtu_delivered',
                  title: 'VTU Delivered',
                  transaction: finalTxState
              }).catch(e => console.error("TG Delivery alert error", e));
          }
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

      return { success: true, vtu_status: VTU_STATUSES.PROVIDER_ACCEPTED, provider_reference: providerReference, external_reference: providerReference || authoritativeId, ...result };
    }

    // Explicit Failure Handling
    const lastError = result.message || result.error || "Provider rejected request";
    console.log("=== DATAHUB EXECUTION FAILED (PROVIDER REJECTION) ===");
    console.error(`🛑 [${executionId}] Provider Rejected:`, lastError);
    
    try {
      await supabase.from("transactions").update({ 
        status: PAYMENT_STATUSES.PAYMENT_SUCCESS,
        vtu_status: VTU_STATUSES.PROVIDER_REJECTED, 
        error_message: lastError,
        updated_at: new Date().toISOString(),
        api_response: result
      }).eq("id", transaction.id);

      // 📱 Trigger Telegram Alert for Failure
      const { data: failedTx } = await supabase.from("transactions").select("*").eq("id", transaction.id).single();
      if (failedTx) {
          sendTelegramNotification({
              category: 'vtu_failed',
              title: 'VTU Delivery Failed',
              transaction: failedTx,
              metadata: { error: lastError }
          }).catch(e => console.error("TG Failure alert error", e));
      }
    } catch (saveErr) {
      console.error("❌ Failed to persist provider rejection state:", saveErr);
    }

    return { success: false, error: lastError };

  } catch (err: any) {
    console.log("=== DATAHUB EXECUTION FAILED (CRITICAL ERROR) ===");
    console.error(`❌ [${executionId}] CRITICAL ERROR:`, err.message);
    
    try {
      // 🛡️ HARDEN: Only escalate to Manual Review after payment converged and DataHub failed
      // This prevents "initialized" transactions from hitting manual review prematurely.
      await supabase.from("transactions").update({ 
        reconciliation_state: RECONCILIATION_STATES.PAYMENT_VERIFIED_EXECUTION_FAILED,
        vtu_status: VTU_STATUSES.RECONCILIATION_PENDING, // Defer manual review 
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
