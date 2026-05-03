import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { createClient } from '@supabase/supabase-js';

import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAyOTcsImV4cCI6MjA5MjU5NjI5N30.ZQZFhxQgzy9JBGUBW9wRfRDs44wcFkmDFu78PUJIags';
const supabase = createClient(supabaseUrl, supabaseKey);

// Centralized DataHub Config Helper
async function getDataHubConfig() {
  // 1. Check for environment variable (most reliable in AI Studio)
  const envKey = process.env.DATAHUB_API_KEY;
  const envUrl = process.env.DATAHUB_BASE_URL || "https://app.datahubgh.com/api/external";

  console.log(`[DataHub Config] Checking sources. Env key present: ${!!envKey}`);

  if (envKey) {
    return {
      apiKey: envKey.trim(),
      baseUrl: envUrl
    };
  }

  // 2. Fallback to Supabase settings if env is not set
  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value?.api_key) {
      console.log("[DataHub Config] Found config in settings table");
      return {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: dhData.value.base_url || envUrl
      };
    }

    // 3. Fallback to 'secure' legacy key if present
    const { data: secureData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'secure')
      .maybeSingle();
    
    if (secureData?.value?.datahub_api_key) {
      console.log("[DataHub Config] Found config in legacy 'secure' setting");
      return {
        apiKey: secureData.value.datahub_api_key.trim(),
        baseUrl: envUrl
      };
    }
  } catch (err) {
    console.error("[DataHub Config] Error reading from Supabase:", err);
  }

  return { 
    apiKey: "", 
    baseUrl: envUrl 
  }; 
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Paystack Webhook (Consolidated from /api/paystack-webhook.ts)
  app.post("/api/paystack-webhook", async (req, res) => {
    try {
      const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
      if (!PAYSTACK_SECRET_KEY) {
        console.error("❌ Missing PAYSTACK_SECRET_KEY");
        return res.status(200).send("env missing");
      }

      // SIGNATURE VERIFICATION
      const signature = req.headers["x-paystack-signature"] as string;
      const hash = crypto
        .createHmac("sha512", PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== signature) {
        console.error("❌ [Webhook] Invalid signature");
        return res.status(401).send("invalid signature");
      }

      const event = req.body || {};
      console.log("📢 [Webhook] Event Received:", event?.event);

      if (event.event !== "charge.success") {
        return res.status(200).send("ignored");
      }

      const paystackReference = event.data?.reference;
      let metadata = event.data?.metadata;
      if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { console.error("❌ Metadata parse failed"); }
      }

      const transactionId = metadata?.transaction_id;
      if (!transactionId) {
        console.error("❌ No transaction ID in metadata");
        return res.status(200).send("no transaction id");
      }

      // FETCH TRANSACTION
      const { data: transaction, error: fetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchErr || !transaction) {
        console.error("❌ Transaction not found", fetchErr);
        return res.status(200).send("transaction not found");
      }

      // UPDATE STATUS TO PAID
      await supabase
        .from("transactions")
        .update({
          paystack_receipt: paystackReference,
          status: "paid",
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.id);

      // 📩 CUSTOMER SMS: PAYMENT RECEIVED
      await sendSMS(
        transaction.recipient_phone,
        `⏳ Datapapa\nYour payment was received.\nYour data is being processed...`
      );

      // IDEMPOTENCY CHECK
      if (transaction.vtu_status === "success" || transaction.vtu_status === "delivered") {
        console.log("⚠️ Already processed success");
        return res.status(200).send("already processed");
      }

      // TRIGGER VTU
      console.log("🚀 [Webhook] Triggering purchaseData for:", transactionId);
      const result = await purchaseData(transaction);
      
      if (result?.success) {
        // 📩 CUSTOMER SMS: SUCCESS
        await sendSMS(
          transaction.recipient_phone,
          `Datapapa ✅\nYour ${transaction.capacity} ${transaction.network} data has been delivered to ${transaction.recipient_phone}.\nRef: ${transaction.id}`
        );

        // 📩 ADMIN SMS: SUCCESS
        await sendSMS(
          process.env.ADMIN_PHONE || "233244014207",
          `💰 NEW VTU\n${transaction.network} ${transaction.capacity}\nTo: ${transaction.recipient_phone}\n₵${transaction.amount}`
        );
      } else {
        // ⚠️ ADMIN ALERT: FAILURE
        await sendSMS(
          process.env.ADMIN_PHONE || "233244014207",
          `⚠️ VTU FAILED\n${transaction.recipient_phone}\n${transaction.network} ${transaction.capacity}\nRef: ${transaction.id}`
        );
      }

      return res.status(200).send("ok");
    } catch (err: any) {
      console.error("❌ [Webhook] Error:", err.message);
      return res.status(200).send("error");
    }
  });

// API Route for Purchasing Data
  app.post("/api/purchase-data", async (req, res) => {
    const { networkKey, recipient, capacity, paystack_ref, bundle } = req.body;
    
    // 1. Initial validation
    if (!networkKey || !recipient || !capacity) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
      // Calculate profit if bundle info is provided
      let profit = 0;
      if (bundle && bundle.selling_price !== undefined && bundle.cost_price !== undefined) {
        profit = Number(bundle.selling_price) - Number(bundle.cost_price);
      } else if (bundle && bundle.price !== undefined && bundle.cost !== undefined) {
        // Fallback for different field names
        profit = Number(bundle.price) - Number(bundle.cost);
      }

      const result = await purchaseData({ 
        networkKey, 
        recipient, 
        capacity, 
        paystack_ref, 
        profit,
        bundle
      });
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      console.error("[API] Purchase Error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

/**
 * Standardizes phone numbers to 233 format
 */
function formatPhone(phone: string): string {
  const cleaned = phone.trim().replace(/\D/g, '');
  if (cleaned.startsWith("0")) {
    return "233" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Builds the success message using a template from settings
 */
function buildSuccessSMS({
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
 * Maps input network keys to the specific identifiers required by DataHubGH
 * Strictly following lead engineer's mapping
 */
function mapNetwork(network: string): string {
  if (!network) return '';
  const net = network.toLowerCase().trim();
  const networkMap: any = {
    mtn: "YELLO",
    telecel: "TELECEL",
    airteltigo: "AT",
  };
  return networkMap[net] || network.toUpperCase();
}

/**
 * Strips 'GB' from capacity strings as required by DataHubGH
 */
function mapCapacity(capacity: string): string {
  if (!capacity) return "";
  return capacity.toUpperCase().replace("GB", "").trim();
}

async function purchaseData(transaction: any) {
  console.log("🚀 [DataHub] Triggering purchase logic for transaction:", transaction.id);

  // Format recipient for DataHub (0XXXXXXXXX)
  let recipient = transaction.recipient_phone;
  if (recipient && recipient.startsWith('233') && recipient.length > 10) {
    recipient = '0' + recipient.slice(3);
  } else if (recipient && !recipient.startsWith('0') && recipient.length === 9) {
    recipient = '0' + recipient;
  }

  // Fallbacks for missing keys
  const networkKey = transaction.datahub_network_key || transaction.network_key || transaction.network;
  const capacity = transaction.datahub_capacity || transaction.capacity || "";
  const finalCapacity = typeof capacity === 'string' ? capacity.toUpperCase().replace("GB", "").trim() : String(capacity);

  const payload = {
    networkKey: networkKey,
    recipient: recipient,
    capacity: finalCapacity,
  };

  console.log("📤 [DataHub] Payload:", payload);

  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    
    if (!apiKey) {
      console.error("❌ [DataHub] NO API KEY FOUND. Transaction marked as failed.");
      await supabase.from("transactions").update({ vtu_status: 'failed', status: 'failed', api_response: { error: 'API key missing' } }).eq("id", transaction.id);
      return { success: false, error: "API key missing" };
    }

    const response = await axios.post(
      `${baseUrl}/data-purchase`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "User-Agent": "Datapapa-VTU-NodeJS/1.1"
        },
        timeout: 35000,
        validateStatus: () => true // Handle all status codes manually
      }
    );

    const result = response.data;
    console.log(`📥 [DataHub] HTTP ${response.status} Response:`, result);

    // Update status based on response
    // DataHub returns status: SUCCESSFUL, PROCESSING, or FAILED
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

    console.log(`✅ [DataHub] Transaction ${transaction.id} result: ${vtuStatus}`);
    
    return { 
      success: isActuallySuccess, 
      status: response.status,
      ...result 
    };

  } catch (err: any) {
    console.error("❌ [DataHub] Critical Error:", err.message);
    
    // Attempt to log failure in Supabase
    try {
      await supabase.from("transactions").update({ 
        vtu_status: 'failed', 
        status: 'failed', 
        api_response: { error: err.message, stack: err.stack } 
      }).eq("id", transaction.id);
    } catch (dbErr) {
      console.error("❌ [DataHub] Failed to update fail status in DB:", dbErr);
    }

    return { success: false, error: err.message };
  }
}

  // Trigger VTU Manually or as Fallback
  app.post("/api/trigger-vtu", async (req, res) => {
    const { transactionId } = req.body;
    console.log("🚀 [Server] Manual VTU Trigger requested for:", transactionId);
    
    if (!transactionId) {
      return res.status(400).json({ success: false, error: "Missing transaction ID" });
    }

    try {
      const { data: transaction, error: fetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchErr || !transaction) {
        console.error("❌ [Server] Transaction not found for manual trigger:", transactionId);
        return res.status(404).json({ success: false, error: "Transaction not found" });
      }

      console.log("🚀 [Server] Calling purchaseData for:", transactionId);
      const vtuResult = await purchaseData(transaction);

      // 2. Deliver Confirmation Notifications
          if (vtuStatus === 'delivered' && transaction.recipient_phone) {
            // Fetch settings for SMS template
            try {
              const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
              const settings = settingsData?.value || {};
              
              if (settings.sms_enabled !== false) {
                const smsTemplate = settings.sms_template_success;

                const message = buildSuccessSMS({
                  volume: transaction.capacity,
                  network: transaction.network,
                  phone: transaction.recipient_phone,
                  transactionId: transaction.id,
                  template: smsTemplate
                });

                // Success Notification to Customer
                await sendSMS(transaction.recipient_phone, message);

                // Admin notification for completion
                await sendSMS(
                  process.env.ADMIN_PHONE || "233244014207",
                  `Datapapa ✅: ${transaction.capacity} ${transaction.network} delivered to ${transaction.recipient_phone}. Ref: ${transaction.id}`
                );
              }
            } catch (settingsErr) {
              console.error("Error fetching settings for SMS:", settingsErr);
              // Fallback SMS
              await sendSMS(
                transaction.recipient_phone,
                `Datapapa ✅\nYour ${transaction.capacity} ${transaction.network} data has been delivered to ${transaction.recipient_phone}.\nRef: ${transaction.id}`
              );
            }
          }

          return res.json(vtuResult);
    } catch (err: any) {
      console.error("❌ [Server] Manual VTU Trigger Error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/datahubgh/test", async (req, res) => {
    const { apiKey } = await getDataHubConfig();
    if (!apiKey) return res.json({ success: false, message: "API key missing" });

    try {
      const resp = await axios.get("https://app.datahubgh.com/api/external/status", {
        timeout: 10000,
        validateStatus: () => true
      });
      if (resp.status === 200) {
        return res.json({ success: true, message: "Connected successfully", data: resp.data });
      }
      return res.json({ success: false, message: `Status check failed with ${resp.status}` });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  });

  app.get("/api/check-datahub", async (req, res) => {
    try {
      const response = await axios.get("https://app.datahubgh.com/api/external/status", {
        timeout: 10000,
        validateStatus: () => true
      });

      const data = response.data;
      
      // ✅ FIXED LOGIC based on user's snippet
      const isOnline = 
        response.status === 200 && 
        (
          data?.status === "operational" || 
          data?.status === "ok" || 
          data?.services?.api === "healthy"
        );

      console.log("📡 DATAHUB STATUS:", data);

      return res.status(200).json({
        online: isOnline,
        data,
      });
    } catch (err: any) {
      console.error("❌ DATAHUB OFFLINE:", err.message);

      return res.status(200).json({
        online: false,
        error: err.message,
      });
    }
  });

  app.get("/api/check-sms-balance", async (req, res) => {
    try {
      const apiKey = process.env.ARKESEL_API_KEY;
      if (!apiKey) {
        return res.json({ balance: 0, error: "API Key missing" });
      }

      // Updated to requested V1 Balance API
      const url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${apiKey}&response=json`;
      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;
      
      // Handle both formats (balance or main_balance)
      const balance = data?.balance ?? data?.main_balance ?? 0;

      return res.status(200).json({ 
        balance: Number(balance),
        raw: data
      });
    } catch (e: any) {
      console.error("[SMS Balance] Error:", e.message);
      return res.status(200).json({ balance: 0, error: e.message });
    }
  });

  app.get("/api/datahubgh/ping", async (req, res) => {
    const { apiKey } = await getDataHubConfig();
    
    // Always check the global status URL first as suggested by user
    const start = Date.now();
    try {
      const resp = await axios.get("https://app.datahubgh.com/api/external/status", {
        timeout: 5000,
        validateStatus: () => true
      });
      
      const duration = Date.now() - start;
      const isOnline = resp.status === 200;
      
      return res.json({ 
        status: isOnline ? (duration < 2000 ? 'online' : 'degraded') : 'offline', 
        responseTime: duration,
        online: isOnline,
        data: resp.data
      });
    } catch (err: any) {
      return res.json({ 
        status: 'offline', 
        responseTime: Date.now() - start,
        online: false,
        error: err.message
      });
    }
  });

  app.get("/api/datahubgh/balance", async (req, res) => {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return res.status(401).json({ error: "API key not set" });

    try {
      const parentUrl = baseUrl.replace(/\/external$/, "");
      const baseApiUrl = baseUrl.replace(/\/api\/external$/, "/api");
      
      // Probing common endpoints for DataHub Gh (v1/v2/external)
      const endpoints = [
        `${baseUrl}/user`,
        `${baseUrl}/balance`,
        `${baseUrl}/wallet`,
        `${baseUrl}/wallet/balance`,
        `${baseUrl}/user/profile`,
        `${parentUrl}/user`,
        `${parentUrl}/balance`,
        `${baseUrl}/fetch-user`,
        `${baseApiUrl}/user`,
        `${baseApiUrl}/balance`,
        `${baseApiUrl}/v2/user`,
        `${baseApiUrl}/v2/balance`,
        "https://app.datahubgh.com/api/external/user",
        "https://app.datahubgh.com/api/external/balance"
      ];
      let lastError = null;

      for (const url of endpoints) {
        try {
          const resp = await axios.get(url, {
            headers: { 'X-API-Key': apiKey },
            params: { api_key: apiKey }, // Try as query param too for older versions
            timeout: 10000,
            validateStatus: (status) => status < 500
          });
          
          if (resp.status === 200 && resp.data) {
            console.log(`[DataHub Balance] Found success at ${url}`);
            let balance = 0;
            const d = resp.data;
            
            // Check multiple common key names
            if (d.wallet_balance !== undefined) balance = Number(d.wallet_balance);
            else if (d.balance !== undefined) balance = Number(d.balance);
            else if (d.user?.wallet_balance !== undefined) balance = Number(d.user.wallet_balance);
            else if (d.data?.balance !== undefined) balance = Number(d.data.balance);
            else if (d.details?.wallet_balance !== undefined) balance = Number(d.details.wallet_balance);
            
            return res.json({ balance, url }); 
          } else {
             console.warn(`[DataHub Balance] Endpoint ${url} returned status ${resp.status}`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[DataHub Balance] Failed at ${url}: ${err.message}`);
        }
      }
      
      throw lastError || new Error("All candidate endpoints failed with 404/error");
    } catch (err: any) {
      console.error("[DataHub Balance API] Error:", err.message);
      return res.status(200).json({ 
        balance: 0, 
        error: err.message, 
        status: 'offline',
        details: err.response?.data 
      });
    }
  });

  // Paystack Webhook logic has been moved to /api/paystack-webhook.ts for better deployment compatibility.

  // DataHub GH Webhook (Order Status Updates)
  app.post("/api/datahub-webhook", async (req, res) => {
    try {
      const payload = req.body;
      const { event, data } = payload;
      
      console.log("[DataHub Webhook] Received Event:", event, "Status:", data?.status, "Ref:", data?.reference || data?.orderNumber);

      if (event === 'order.status_updated') {
        const status = data.status; // PROCESSING, SUCCESSFUL, FAILED
        let vtuStatus = 'processing';
        
        if (status === 'SUCCESSFUL') vtuStatus = 'delivered';
        if (status === 'FAILED') vtuStatus = 'failed';

      // 1. Update Transaction by reference or orderNumber
        const txRef = data.reference || data.orderNumber;
        
        let updateQuery = supabase.from('transactions').update({ 
          vtu_status: vtuStatus,
          api_response: payload // Store full webhook payload for audit
        });

        // Use the pattern: eq("api_response->>reference", reference)
        if (txRef) {
          updateQuery = updateQuery.or(`api_response->>reference.eq.${txRef},api_response->>orderNumber.eq.${txRef}`);
        } else if (data.recipient) {
          // If no ref, match by recipient and processing/success state
          updateQuery = updateQuery.eq('recipient_phone', data.recipient).or('vtu_status.eq.processing,vtu_status.eq.success');
        }

        const { data: updated, error: updateErr } = await updateQuery.select();
        
        if (updateErr) {
          console.error("[DataHub Webhook] Database Update Error:", updateErr.message);
        } else if (updated && updated.length > 0) {
          console.log(`[DataHub Webhook] Updated transaction to ${vtuStatus}`);
          
          // 2. Deliver Confirmation Notifications
          if (vtuStatus === 'delivered' && updated[0].recipient_phone) {
            const adminPhone = process.env.ADMIN_PHONE || "233244014207";
            const recipient = updated[0].recipient_phone;
            const capacity = updated[0].capacity;
            const network = updated[0].network;
            const transaction_id = updated[0].id;

            // Fetch settings for SMS template (key is 'general' not 'sms_settings')
            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
            const settings = settingsData?.value || {};
            
            // Check if SMS is enabled
            if (settings.sms_enabled === false) {
              console.log("[DataHub Webhook] SMS is disabled in settings. Skipping.");
            } else {
              const smsTemplate = settings.sms_template_success;

              const message = buildSuccessSMS({
                volume: capacity,
                network: network,
                phone: recipient,
                transactionId: transaction_id,
                template: smsTemplate
              });

              // Success Notification to Customer
              await sendSMS(recipient, message);

              // Admin notification for completion
              await sendSMS(
                adminPhone,
                `DELIVERED: ${capacity} ${network} to ${recipient}. Ref: ${txRef || transaction_id}`
              );
            }
          }
        
        return res.status(200).json({ received: true });
      }

      res.status(200).json({ received: true, note: 'Event ignored' });
    } catch (err: any) {
      console.error("[DataHub Webhook] Fatal error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for Sending SMS via Arkesel V2 (REST POST)
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { recipients, message, sender, phone } = req.body;
      
      // Support both 'recipients' (array/string) and 'phone' (single string)
      const targetPhone = phone || (Array.isArray(recipients) ? recipients[0] : recipients);
      
      if (!targetPhone || !message) {
        return res.status(400).json({ success: false, error: "Phone/Recipients and message are required" });
      }

      const arkeselKey = process.env.ARKESEL_API_KEY?.trim();
      if (!arkeselKey) {
        console.error("ARKESEL_API_KEY is missing in environment");
        return res.status(500).json({ success: false, error: "SMS service not configured" });
      }

      // Format number to 233 format
      let formatted = targetPhone.trim().replace(/\D/g, '');
      if (formatted.startsWith("0")) {
        formatted = "233" + formatted.substring(1);
      } else if (formatted.length === 9) {
        formatted = "233" + formatted;
      }

      console.log(`[Arkesel V2] Sending SMS to: ${formatted}`);

      const response = await axios.post(
        "https://sms.arkesel.com/api/v2/sms/send",
        {
          sender: (sender || process.env.ARKESEL_SENDER_ID || "Datapapa").slice(0, 11),
          message,
          recipients: [formatted],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": arkeselKey,
          },
          timeout: 15000
        }
      );

      console.log(`[Arkesel V2] Response:`, response.data);

      if (response.data && (response.data.status === 'success' || response.data.code === '1000')) {
        return res.json({ success: true, result: response.data });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: response.data?.message || "Failed to send SMS", 
          details: response.data 
        });
      }
    } catch (error: any) {
      console.error("Arkesel V2 Integration Error:", error.message);
      return res.status(500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      });
    }
  });

  // API Route for Re-sending SMS for a specific transaction
  app.post("/api/resend-sms", async (req, res) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) return res.status(400).json({ error: "Transaction ID required" });

      const { data: transaction, error: fetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchErr || !transaction) return res.status(404).json({ error: "Transaction not found" });

      // Fetch settings for SMS template
      const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'sms_settings').maybeSingle();
      const smsTemplate = settingsData?.value?.sms_template_success;

      const message = buildSuccessSMS({
        volume: transaction.capacity,
        network: transaction.network,
        phone: transaction.recipient_phone,
        transactionId: transaction.id,
        template: smsTemplate
      });

      const result = await sendSMS(transaction.recipient_phone, message);
      return res.json({ success: true, message: "SMS resent", result });
    } catch (err: any) {
      console.error("[API] Resend SMS Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // API Route for Retrying VTU Purchase
  app.post("/api/retry-vtu", async (req, res) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) return res.status(400).json({ error: "Transaction ID required" });

      const { data: transaction, error: fetchErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (fetchErr || !transaction) return res.status(404).json({ error: "Transaction not found" });

      console.log(`[API] Retrying VTU for ${transactionId}`);
      const result = await purchaseData(transaction);
      
      return res.json(result);
    } catch (err: any) {
      console.error("[API] Retry VTU Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });


  async function getArkeselBalance() {
    try {
      const apiKey = process.env.ARKESEL_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // Use the specific URL provided by the user
      // https://sms.arkesel.com/sms/api?action=check-balance&api_key=YOUR_API_KEY&response=json
      const url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${apiKey}&response=json`;
      
      const response = await axios.get(url, { timeout: 10000 });
      const resData = response.data;
      
      console.log("[Arkesel V1 Balance Data]:", resData);

      // detect balance from JSON response
      let balance = 0;
      if (resData.balance !== undefined) {
        balance = Number(resData.balance);
      } else if (resData.main_balance !== undefined) {
        balance = Number(resData.main_balance);
      }

      return {
        status: "online",
        balance: balance,
        last_checked: new Date().toISOString(),
        raw: resData,
      };
    } catch (error: any) {
      console.error("[Arkesel] V1 Status Error:", error.message);
      
      // Fallback to V2 if V1 fails just in case
      try {
        const apiKey = process.env.ARKESEL_API_KEY;
        const response = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: { "api-key": apiKey },
          timeout: 5000
        });
        const resData = response.data;
        const balance = resData.data?.balance ?? resData.balance ?? 0;
        return {
          status: "online",
          balance: Number(balance),
          last_checked: new Date().toISOString(),
          raw: resData,
          note: "via v2 fallback"
        };
      } catch (v2Err) {
        return {
          status: "offline",
          balance: 0,
          last_checked: new Date().toISOString(),
          error: error.message
        };
      }
    }
  }

  // Arkesel SMS V2 Implementation
  app.get("/api/arkesel/status", async (req, res) => {
    const result = await getArkeselBalance();
    res.json(result);
  });

  app.get("/api/arkesel/balance", async (req, res) => {
    const result = await getArkeselBalance();
    if (result.status === "offline") {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch balance: ' + (result.error || "Unknown error"),
      });
    }
    return res.status(200).json({
      success: true,
      data: result.raw
    });
  });

  app.post("/api/arkesel/send-sms", async (req, res) => {
    const { to, message, sender } = req.body;

    const apiKey = process.env.ARKESEL_API_KEY;
    const senderId = sender || process.env.ARKESEL_SENDER_ID || 'Datapapa';

    if (!apiKey) {
      console.error("[Arkesel] API Key missing in environment");
      return res.status(500).json({ success: false, message: 'Arkesel API key not configured' });
    }

    try {
      console.log(`[Arkesel] Sending test SMS to: ${to}`);
      
      // format number → 233XXXXXXXXX
      let phone = to.trim().replace(/\D/g, '');
      if (phone.startsWith("0")) {
        phone = "233" + phone.substring(1);
      } else if (phone.length === 9) {
        phone = "233" + phone;
      }

      const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", {
        sender: senderId.slice(0, 11),
        message,
        recipients: [phone],
      }, {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        timeout: 15000
      });

      const data = response.data;
      console.log("[Arkesel] API Response:", data);

      if (data.status === 'success' || data.code === '1000' || data.code === 1000) {
        return res.status(200).json({
          success: true,
          data,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: data.message || 'Failed to send SMS',
          raw: data
        });
      }

    } catch (error: any) {
      console.error("[Arkesel] Fatal error:", error.message);
      let errorDetail = error.message;
      if (error.response) {
        console.error("[Arkesel] Error Response:", JSON.stringify(error.response.data));
        errorDetail = error.response.data?.message || JSON.stringify(error.response.data);
      }
      return res.status(500).json({
        success: false,
        message: 'Arkesel Error: ' + errorDetail,
        details: error.response?.data
      });
    }
  });

  /**
   * Centralized SMS helper using Arkesel V2 (POST)
   */
  async function sendSMS(to: string, message: string) {
    try {
      const arkeselKey = process.env.ARKESEL_API_KEY?.trim();
      const senderId = (process.env.ARKESEL_SENDER_ID || "Datapapa").trim();

      if (!arkeselKey) {
        console.error("❌ Missing ARKESEL_API_KEY");
        return;
      }

      // format number → 233XXXXXXXXX
      let phone = to.trim().replace(/\D/g, '');
      if (phone.startsWith("0")) {
        phone = "233" + phone.substring(1);
      } else if (phone.length === 9) {
        phone = "233" + phone;
      }

      const payload = {
        sender: senderId.slice(0, 11),
        message,
        recipients: [phone],
      };

      console.log(`[Arkesel] Sending SMS to ${phone} using sender: ${payload.sender}`);

      const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", payload, {
        headers: {
          "Content-Type": "application/json",
          "api-key": arkeselKey,
        },
        timeout: 15000
      });

      const data = response.data;
      console.log("📩 SMS RESPONSE:", data);

      // Log to database
      try {
        await supabase.from("sms_logs").insert({
          phone: phone,
          message: message,
          status: (data.status === 'success' || data.code === '1000' || data.code === 1000) ? "sent" : "failed",
          response: data,
          created_at: new Date().toISOString()
        }).select().maybeSingle();
      } catch (logErr) {
        console.error("SMS LOG ERROR (likely table missing):", logErr);
      }

      return data;
    } catch (err: any) {
      console.error("❌ SMS ERROR:", err.message);
      if (err.response) {
        console.error("❌ SMS ERROR DATA:", JSON.stringify(err.response.data));
      }
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
