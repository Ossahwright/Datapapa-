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
  // 1. Try environment variable first (Highest Priority for dev/local)
  const envKey = process.env.DATAHUB_API_KEY || "sk_bb283e645e4ab8c83edef7e4bb5f618fe7c68f24f467c5b8";
  const envUrl = process.env.DATAHUB_BASE_URL || "https://app.datahubgh.com/api/external";

  // 2. Try Supabase settings 'datahubgh' (New standard)
  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value) {
      let keyToUse = dhData.value.api_key;
      // if invalid key in db, use env key
      if (!keyToUse || keyToUse.includes('728c45980e07ab502295e74917077992f89ef82e790c828c')) {
         keyToUse = envKey;
      }
      return {
        apiKey: keyToUse,
        baseUrl: dhData.value.base_url || envUrl
      };
    }

    // 3. Fallback to 'secure' key (legacy logic)
    const { data: secureData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'secure')
      .maybeSingle();
    
    if (secureData?.value?.datahub_api_key) {
      let keyToUse = secureData.value.datahub_api_key;
      if (!keyToUse || keyToUse.includes('728c45980e07ab502295e74917077992f89ef82e790c828c')) {
         keyToUse = envKey;
      }
      return {
        apiKey: keyToUse,
        baseUrl: envUrl
      };
    }
  } catch (err) {
    console.error("[Server] Error fetching config:", err);
  }

  return { 
    apiKey: envKey, 
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

      const result = await processDataPurchase({ 
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
 * Diligently implemented by Lead Engineer
 */
function mapNetwork(network: string): string {
  if (!network) return '';
  const net = network.toLowerCase();
  
  if (net === "mtn") return "YELLO";
  if (net === 'telecel' || net === 'vodafone' ) return 'TELECEL';
  if (net === 'airteltigo' || net === 'at' || net === 'airtel') return 'AIRTELTIGO';
  
  return network.toUpperCase();
}

  async function processDataPurchase({ networkKey, recipient, capacity, paystack_ref, profit, bundle }: any) {
    const normalizedKey = mapNetwork(networkKey);
    const { apiKey, baseUrl } = await getDataHubConfig();
    
    if (!apiKey) {
      return { success: false, error: "DataHub API key not configured" };
    }

    const startTime = Date.now();
    const endpoint = baseUrl.replace(/\/$/, '') + '/data-purchase';
    
    // Format recipient (DataHub expects 0XXXXXXXXX)
    let formattedRecipient = recipient.trim().replace(/\D/g, '');
    if (formattedRecipient.startsWith('233') && formattedRecipient.length > 10) {
      formattedRecipient = `0${formattedRecipient.slice(3)}`;
    } else if (!formattedRecipient.startsWith('0') && formattedRecipient.length === 9) {
      formattedRecipient = `0${formattedRecipient}`;
    }

    // Capacity should be the identifier (e.g. "1" for 1GB if that's the ID, or "1GB")
    // DataHub curl example shows "capacity": "1"
    const finalCapacity = bundle?.datahub_id || capacity;
    
    // Log for debugging
    console.log("[DataHub API] Endpoint:", endpoint);
    console.log("[DataHub API] Payload:", { networkKey: normalizedKey, recipient: formattedRecipient, capacity: finalCapacity });

    // Log the intent as requested by lead engineer
    console.log("Sending VTU request", { 
      network: normalizedKey, 
      phone: formattedRecipient, 
      bundle: finalCapacity 
    });

    try {
      const response = await axios.post(endpoint, {
        networkKey: normalizedKey,
        recipient: formattedRecipient,
        capacity: finalCapacity,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        timeout: 30000,
        validateStatus: () => true 
      });

      const duration = Date.now() - startTime;
      const result = response.data;
      
      console.log("VTU response", result);

      const isAccepted = response.status === 200 && (result.status === 'PROCESSING' || result.status === 'SUCCESSFUL' || result.success);

      // Log the individual API call
      try {
        await supabase.from("datahubgh_logs").insert({
          endpoint: "purchase-data",
          status: isAccepted ? "success" : "failed",
          request_payload: { 
            networkKey: normalizedKey, 
            recipient: formattedRecipient, 
            capacity: finalCapacity 
          },
          response_data: result,
          http_status: response.status,
          response_time: duration
        });
      } catch (logErr) {
        console.error("[Server] Logging error:", logErr);
      }

      // 2. IMPORTANT: Update Transaction in Supabase
      if (paystack_ref) {
        const updatePayload: any = {
          status: isAccepted ? 'success' : 'failed',
          vtu_status: isAccepted ? 'success' : 'failed',
          api_response: result,
          updated_at: new Date().toISOString()
        };

        if (profit !== undefined) {
          // Check if profit column exists or just wrap in try/catch to avoid breaking success flow
          try {
             const { error: pErr } = await supabase
              .from('transactions')
              .update({ profit: profit })
              .eq('paystack_receipt', paystack_ref);
             if (pErr) console.warn("[Supabase] Profit update failed (column might be missing):", pErr.message);
          } catch (e) {
             console.warn("[Supabase] Profit update exception:", e);
          }
        }
        
        const { error: updateErr } = await supabase
          .from('transactions')
          .update({
            status: isAccepted ? 'success' : 'failed',
            vtu_status: isAccepted ? 'success' : 'failed',
            api_response: result,
            updated_at: new Date().toISOString()
          })
          .eq('paystack_receipt', paystack_ref);
          
        if (updateErr) console.error("[Supabase] Transaction update error:", updateErr.message);
      }

      if (isAccepted) {
        return { 
          success: true, 
          status: result.status === 'SUCCESSFUL' || result.success === true ? 'success' : 'processing',
          data: result 
        };
      }
      
      return { 
        success: false, 
        status: 'failed',
        error: result.message || result.error || "Purchase rejected by DataHub",
        data: result
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      try {
        await supabase.from('datahubgh_logs').insert({
          endpoint: 'data-purchase',
          status: 'failed',
          http_status: 0,
          response_time: duration,
          request_payload: { networkKey, recipient, capacity },
          error_message: error.message
        });
      } catch (logErr) {
        console.error("[Server] Logging error:", logErr);
      }
      return { success: false, error: error.message };
    }
  }

  // NEW: DataHub Management Routes
  app.post("/api/datahubgh/test", async (req, res) => {
    const { apiKey, baseUrl } = await getDataHubConfig();
    if (!apiKey) return res.json({ success: false, message: "API key missing" });

    try {
      const resp = await axios.get(`${baseUrl}/status`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
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
      const resp = await axios.get(`${baseUrl}/status`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
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
      const resp = await axios.get(`${baseUrl}/balance`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 10000
      });
      return res.json({ balance: resp.data.balance || 0 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Paystack Webhook Implementation
  app.post("/api/paystack/webhook", async (req, res) => {
    console.log("Webhook received");
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const bodyString = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha512', secret || '')
      .update(bodyString)
      .digest('hex');

    const signature = req.headers['x-paystack-signature'];

    if (!secret || hash !== signature) {
      console.error("[Paystack Webhook] Invalid signature or secret missing");
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    
    // Process successful charges
    if (event.event === 'charge.success') {
      const { data } = event;
      const reference = data.reference;
      
      // Info from metadata
      const transactionId = data.metadata?.transaction_id;
      const phone = data.metadata?.phone || data.customer?.phone;
      const network = data.metadata?.network; 
      const capacity = data.metadata?.capacity || data.metadata?.bundle; 
      const bundleId = data.metadata?.bundle_id;
      const amount = data.amount / 100;
      const adminPhone = "233244014207";

      console.log(`[Paystack Webhook] SUCCESS detected for ${reference}. Transaction ID: ${transactionId}`);

      try {
        // 1. Update Transaction record
        if (transactionId) {
          await supabase
            .from('transactions')
            .update({
              paystack_receipt: reference,
              status: 'success',
              updated_at: new Date().toISOString()
            })
            .eq('id', transactionId);
        } else {
          // Fallback: If no transaction_id, create or update by reference
          const { data: existingTx } = await supabase.from('transactions').select('id').eq('paystack_receipt', reference).maybeSingle();
          if (!existingTx) {
            await supabase.from('transactions').insert({
              paystack_receipt: reference,
              amount: amount,
              recipient_phone: phone,
              network: network,
              capacity: capacity,
              status: 'success',
              vtu_status: 'pending'
            });
          }
        }

        // 2. Send admin SMS
        await sendSMS(
          adminPhone,
          `NEW ORDER:
Network: ${network}
Bundle: ${capacity}
Phone: ${phone}
Amount: GHS ${amount}`
        );

        // Fetch bundle info for profit calculation
        let bundleInfo = null;
        let calculatedProfit = 0;
        if (bundleId) {
          const { data: bData } = await supabase.from('bundles').select('*').eq('id', bundleId).maybeSingle();
          if (bData) {
            bundleInfo = bData;
            if (bData.selling_price !== undefined && bData.cost_price !== undefined) {
              calculatedProfit = Number(bData.selling_price) - Number(bData.cost_price);
            }
          }
        }

      // 3. Call DataHubGH (Inside processDataPurchase: 4. Updates vtu_status)
        const networkKey = mapNetwork(network);
        const vtuResult = await processDataPurchase({
          networkKey,
          recipient: phone,
          capacity: capacity,
          paystack_ref: reference,
          profit: calculatedProfit,
          bundle: bundleInfo
        });

        // Fetch settings for SMS template
        const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'sms_settings').maybeSingle();
        const smsTemplate = settingsData?.value?.sms_template_success;

        // 5. Send user SMS
        if (vtuResult.status === "success") {
          const message = buildSuccessSMS({
            volume: capacity,
            network: network,
            phone: phone,
            transactionId: transactionId || reference,
            template: smsTemplate
          });
          await sendSMS(phone, message);
        } else if (vtuResult.success) {
          // If just accepted but not immediately successful (PROCESSING)
          await sendSMS(
            phone,
            `Your ${capacity} ${network} data purchase of GHS ${amount} is being processed.`
          );
        } else {
          console.warn("[Webhook] Purchase rejected by API:", vtuResult.error);
        }

      } catch (err) {
        console.error("CRITICAL FLOW ERROR:", err);
        // Fallback notification to admin
        await sendSMS(adminPhone, `CRITICAL FLOW ERROR for Ref ${reference}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.sendStatus(200);
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

  // Arkesel SMS V2 Implementation
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
    const apiKey = process.env.ARKESEL_API_KEY;
    if (!apiKey) {
      console.warn("[Arkesel] API Key missing. Skipping SMS.");
      return;
    }

    const formattedPhone = formatPhone(phone);

    try {
      const response = await axios.post("https://sms.arkesel.com/api/v2/sms/send", {
        sender: "Datapapa",
        message,
        recipients: [formattedPhone],
      }, {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        timeout: 10000,
        validateStatus: () => true
      });

      const result = response.data;
      const isSuccess = response.status === 200 && (result.status === 'success' || result.code === '1000');
      
      console.log("SMS RESULT:", result);

      // Log to Supabase with status
      await supabase.from("sms_logs").insert({
        phone: formattedPhone,
        message,
        status: isSuccess ? "sent" : "failed",
        response: result
      });

      return result;
    } catch (err) {
      console.error("SMS FAILED:", err);
      // Log failure even if request failed
      try {
        await supabase.from("sms_logs").insert({
          phone: formattedPhone,
          message,
          status: "failed",
          response: { error: err instanceof Error ? err.message : String(err) }
        });
      } catch (logErr) {
        console.error("FATAL SMS LOG ERROR:", logErr);
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
