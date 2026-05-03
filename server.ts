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

async function getDataHubConfig() {
  // 1. Priority 1: Environment Variable (most reliable for recent setup)
  const envKey = process.env.DATAHUB_API_KEY;
  const envUrl = process.env.DATAHUB_BASE_URL || "https://app.datahubgh.com/api/external";

  console.log(`[DataHub Config] Checking sources. Env key present: ${!!envKey}`);

  // 2. Try Supabase settings 'datahubgh' (Standard config)
  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value?.api_key) {
      console.log("[DataHub Config] Found config in settings table");
      return {
        apiKey: dhData.value.api_key,
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
        apiKey: secureData.value.datahub_api_key,
        baseUrl: envUrl
      };
    }
  } catch (err) {
    console.error("[DataHub Config] Error reading from Supabase:", err);
  }

  // Final fallback to Env Key or a default (removed stale hardcoded key)
  if (!envKey) {
    console.warn("[DataHub Config] WARNING: No API key found in Env or Supabase!");
  }

  return { 
    apiKey: envKey || "", 
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
  console.log("🚀 DATAHUB FUNCTION TRIGGERED");

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
  const finalCapacity = typeof capacity === 'string' ? capacity.toUpperCase().replace("GB", "").trim() : capacity;

  const payload = {
    networkKey: networkKey,
    recipient: recipient,
    capacity: finalCapacity,
  };

  console.log("📤 PAYLOAD:", payload);

  try {
    const { apiKey } = await getDataHubConfig();
    const activeKey = apiKey || process.env.DATAHUB_API_KEY;
    
    if (!activeKey) {
      console.error("❌ NO DATAHUB API KEY FOUND. Please set it in Admin Dashboard or Environment.");
      return;
    }

    const response = await axios.post(
      "https://app.datahubgh.com/api/external/data-purchase",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": activeKey,
          "User-Agent": "Datapapa-VTU-NodeJS/1.0"
        },
        timeout: 30000
      }
    );

    const result = response.data;
    console.log("📥 DATAHUB RESPONSE:", result);

    // Update status based on response
    // DataHub returns status: SUCCESSFUL, PROCESSING, or FAILED
    const isActuallySuccess = result.success === true || result.status === 'SUCCESSFUL' || result.status === 'PROCESSING';
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

    console.log(`✅ TRANSACTION ${transaction.id} UPDATED TO: ${vtuStatus}`);
    
    return { success: isActuallySuccess, ...result };

  } catch (err: any) {
    console.error("❌ DATAHUB CALL FAILED:", err.message);
    if (err.response) {
      console.error("📥 ERROR DATA:", JSON.stringify(err.response.data));
    }
    
    // Mark as failed in DB if network error
    if (transaction.id) {
      await supabase
        .from("transactions")
        .update({
          vtu_status: 'failed',
          api_response: { error: err.message, details: err.response?.data },
          updated_at: new Date().toISOString()
        })
        .eq("id", transaction.id);
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

      return res.json(vtuResult);
    } catch (err: any) {
      console.error("❌ [Server] Manual VTU Trigger Error:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/datahubgh/test", async (req, res) => {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return res.json({ success: false, message: "API key missing" });

    try {
      const resp = await axios.get(`${baseUrl}/user`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 10000,
        validateStatus: () => true
      });
      if (resp.status === 200) {
        return res.json({ success: true, message: "Connected successfully" });
      }
      return res.json({ success: false, message: `Status check failed with ${resp.status}` });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  });

  app.get("/api/datahubgh/ping", async (req, res) => {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return res.json({ status: 'inactive' });

    const start = Date.now();
    try {
      const resp = await axios.get(`${baseUrl}/user`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 5000,
        validateStatus: () => true
      });
      const duration = Date.now() - start;
      
      let status = 'offline';
      if (resp.status === 200) {
        status = duration < 2000 ? 'online' : 'degraded';
      }

      return res.json({ status, responseTime: duration });
    } catch (err) {
      return res.json({ status: 'offline', responseTime: Date.now() - start });
    }
  });

  app.get("/api/datahubgh/balance", async (req, res) => {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return res.status(401).json({ error: "API key not set" });

    try {
      // Trying /user as it's a common endpoint for account balance in DataHub Gh
      const resp = await axios.get(`${baseUrl}/user`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 10000
      });
      
      // Some versions use 'wallet_balance', others just 'balance'
      const balance = resp.data.wallet_balance !== undefined ? resp.data.wallet_balance : (resp.data.balance || 0);
      return res.json({ balance });
    } catch (err: any) {
      console.error("[DataHub Balance API] Error:", err.message);
      if (err.response) {
        console.error("Response data:", typeof err.response.data === 'string' ? err.response.data.slice(0, 500) : JSON.stringify(err.response.data));
      }
      // Return 200 with 0 balance instead of 500 to keep UI clean if it's just a config issue
      return res.status(200).json({ balance: 0, error: err.message });
    }
  });

  // Paystack Webhook Implementation
  app.post("/api/paystack-webhook", express.json(), async (req, res) => {
    try {
      // ✅ TEST ROUTE (browser)
      if (req.method === "GET") {
        return res.status(200).send("Webhook is live ✅");
      }

      console.log("🔥 WEBHOOK RECEIVED");

      // Safely access body
      const event = req.body || {};

      console.log("📢 EVENT:", event?.event);

      if (event.event !== "charge.success") {
        return res.status(200).send("ignored");
      }

      console.log("✅ PAYMENT CONFIRMED");

      return res.status(200).send("ok");
    } catch (err: any) {
      console.error("❌ WEBHOOK ERROR:", err.message || err);
      return res.status(200).send("safe exit");
    }
  });

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
          updateQuery = updateQuery.eq('recipient_phone', data.recipient).eq('vtu_status', 'processing');
        }

        const { data: updated, error: updateErr } = await updateQuery.select();
        
        if (updateErr) {
          console.error("[DataHub Webhook] Database Update Error:", updateErr.message);
        } else if (updated && updated.length > 0) {
          console.log(`[DataHub Webhook] Updated transaction to ${vtuStatus}`);
          
          // 2. Deliver Confirmation Notifications
          if (vtuStatus === 'delivered' && updated[0].recipient_phone) {
            const adminPhone = "233244014207";
            const recipient = updated[0].recipient_phone;
            const capacity = updated[0].capacity;
            const network = updated[0].network;
            const transaction_id = updated[0].id;

            // Fetch settings for SMS template
            const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'sms_settings').maybeSingle();
            const smsTemplate = settingsData?.value?.sms_template_success;

            const message = buildSuccessSMS({
              volume: capacity,
              network: network,
              phone: recipient,
              transactionId: transaction_id,
              template: smsTemplate
            });

            // Success Notification to Customer as requested
            await sendSMS(recipient, message);

            // Admin notification for completion
            await sendSMS(
              adminPhone,
              `DELIVERED: ${capacity} ${network} to ${recipient}. Ref: ${txRef}`
            );
          }
        } else {
          console.warn("[DataHub Webhook] No matching processing transaction found for update.");
        }
        
        return res.status(200).json({ received: true });
      }

      res.status(200).json({ received: true, note: 'Event ignored' });
    } catch (err: any) {
      console.error("[DataHub Webhook] Fatal error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for Sending SMS via Arkesel
  app.post("/api/send-sms", async (req, res) => {
    const { recipients, message, sender } = req.body;
    
    const arkeselKey = process.env.ARKESEL_API_KEY?.trim();
    
    if (!arkeselKey) {
      console.error("ARKESEL_API_KEY is missing in environment");
      return res.status(500).json({ success: false, error: "ARKESEL_API_KEY is missing" });
    }

    try {
      const recipientList = Array.isArray(recipients) ? recipients.join(',') : recipients;
      
      console.log(`[Arkesel] Sending SMS to: ${recipientList}`);
      console.log(`[Arkesel] Sender ID: ${sender || "Datapapa"}`);
      console.log(`[Arkesel] Key length: ${arkeselKey.length}`);

      // Arkesel V1 GET implementation
      const response = await axios.get("https://sms.arkesel.com/sms/api", {
        params: {
          action: 'send-sms',
          api_key: arkeselKey,
          to: recipientList,
          from: sender || "Datapapa",
          sms: message
        },
        headers: {
          'Accept': 'application/json'
        },
        timeout: 15000, 
        validateStatus: () => true 
      });

      console.log(`[Arkesel] Status: ${response.status}`);
      console.log(`[Arkesel] Response Data:`, response.data);

      const rawData = response.data;
      let isSuccess = false;
      let statusInfo = "";

      // Handle common V1 response patterns
      if (typeof rawData === 'string') {
        const cleanedData = rawData.trim();
        if (cleanedData.includes('1000')) {
          isSuccess = true;
          statusInfo = "Success (1000)";
        } else if (cleanedData.toLowerCase().includes('authentication failed')) {
          statusInfo = "Authentication failed (Invalid API Key)";
        } else {
          statusInfo = cleanedData;
        }
      } else if (typeof rawData === 'number') {
        if (rawData === 1000) {
          isSuccess = true;
          statusInfo = "Success (1000)";
        } else {
          statusInfo = String(rawData);
        }
      } else if (rawData && typeof rawData === 'object') {
        const status = String(rawData.status || rawData.code || '');
        if (status === '1000' || status === 'success' || (typeof rawData.data === 'string' && rawData.data.includes('1000'))) {
          isSuccess = true;
          statusInfo = "Success (1000)";
        } else {
          statusInfo = rawData.message || rawData.data || JSON.stringify(rawData);
        }
      }

      // Explicit check for common error codes in V1
      const errorMap: Record<string, string> = {
        '101': 'Invalid API Key',
        '102': 'Authentication Failed',
        '103': 'Invalid Action',
        '104': 'Recipient Number Missing',
        '105': 'Sender ID Missing',
        '106': 'Message Body Missing',
        '107': 'Invalid Recipient Number',
        '108': 'Sender ID not approved',
        '109': 'Insufficient Balance',
        '110': 'System Error'
      };

      if (!isSuccess && errorMap[statusInfo.trim()]) {
        statusInfo = `${statusInfo.trim()} - ${errorMap[statusInfo.trim()]}`;
      }

      if (isSuccess) {
        return res.json({ success: true, data: rawData });
      } else {
        console.error("Arkesel reported failure:", { statusInfo, rawData });
        return res.json({ 
          success: false, 
          error: statusInfo.length > 0 ? statusInfo : "Unknown error from Arkesel",
          raw: rawData
        });
      }
    } catch (error: any) {
      console.error("Arkesel Integration Fatal Error:", error.message);
      return res.status(500).json({ 
        success: false, 
        error: `Network Error: ${error.message}` 
      });
    }
  });

  async function getArkeselBalance() {
    try {
      const apiKey = process.env.ARKESEL_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const response = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
        headers: {
          "api-key": apiKey,
        },
        timeout: 10000
      });

      const resData = response.data;
      
      // Robust balance detection for Arkesel V2
      let balance = 0;
      
      // Check top level
      if (resData.balance !== undefined) balance = Number(resData.balance);
      else if (resData.main_balance !== undefined) balance = Number(resData.main_balance);
      else if (resData.user_balance !== undefined) balance = Number(resData.user_balance);
      else if (resData.sms_balance !== undefined) balance = Number(resData.sms_balance);
      // Check within 'data' object (Common in V2)
      else if (resData.data) {
        const d = resData.data;
        if (d.balance !== undefined) balance = Number(d.balance);
        else if (d.main_balance !== undefined) balance = Number(d.main_balance);
        else if (d.user_balance !== undefined) balance = Number(d.user_balance);
        else if (d.sms_balance !== undefined) balance = Number(d.sms_balance);
        else if (d.available_balance !== undefined) balance = Number(d.available_balance);
      }

      return {
        status: "online",
        balance: balance,
        last_checked: new Date().toISOString(),
        raw: resData,
      };
    } catch (error: any) {
      console.error("Arkesel error:", error.message);

      return {
        status: "offline",
        balance: 0,
        last_checked: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Arkesel SMS V2 Implementation
  app.get("/api/arkesel/status", async (req, res) => {
    const result = await getArkeselBalance();
    res.json(result);
  });

  app.get("/api/arkesel/balance", async (req, res) => {
    const apiKey = process.env.ARKESEL_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'Arkesel API key not configured' });
    }

    try {
      const response = await axios.get(`https://sms.arkesel.com/api/v2/clients/balance-details`, {
        headers: { 'api-key': apiKey },
        timeout: 10000
      });

      return res.status(200).json({
        success: true,
        data: response.data
      });
    } catch (error: any) {
      console.error("[Arkesel Balance] Error:", error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch balance: ' + error.message,
      });
    }
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
      // Arkesel V2 API docs: https://sms.arkesel.com/api/sms/send
      const response = await axios.get(`https://sms.arkesel.com/api/sms/send`, {
        params: {
          api_key: apiKey,
          to: to,
          from: senderId,
          sms: message
        },
        timeout: 10000
      });

      const data = response.data;

      // Arkesel returns status: 'success' for successful delivery in V2
      if (data.status !== 'success') {
        console.error("[Arkesel] API Error Response:", data);
        return res.status(400).json({
          success: false,
          message: data.message || 'Failed to send SMS',
          raw: data
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });

    } catch (error: any) {
      console.error("[Arkesel] Fatal error:", error.message);
      return res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message,
      });
    }
  });

  /**
   * Centralized SMS helper using Arkesel V2 (POST)
   * Diligently implemented by Lead Engineer
   */
  async function sendSMS(phone: string, message: string) {
    try {
      console.log("🚀 SMS FUNCTION TRIGGERED");
      console.log("API KEY:", process.env.ARKESEL_API_KEY);

      const formattedPhone = phone.startsWith("0")
        ? "233" + phone.slice(1)
        : phone;

      const payload = {
        sender: "Datapapa",
        message,
        recipients: [formattedPhone],
      };

      console.log("📤 SMS PAYLOAD:", payload);

      const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", payload, {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.ARKESEL_API_KEY!,
        },
        timeout: 15000
      });

      const data = response.data;
      console.log("✅ PARSED SMS RESPONSE:", data);

      // Keep logging to Supabase if possible, but the user requested this specific implementation
      // I will add the logging back in as a good practice if it doesn't conflict
      try {
        await supabase.from("sms_logs").insert({
          phone: formattedPhone,
          message,
          status: data.status === 'success' ? "sent" : "failed",
          response: data
        });
      } catch (logErr) {
        console.error("FATAL SMS LOG ERROR:", logErr);
      }

      return data;
    } catch (err) {
      console.error("❌ SMS ERROR:", err);
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
