import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Purchasing Data
  app.post("/api/purchase-data", async (req, res) => {
    const { networkKey, recipient, capacity } = req.body;
    
    console.log(`Processing purchase: ${networkKey}, ${recipient}, ${capacity}`);

    const apiKey = process.env.DATAHUB_API_KEY;
    
    if (!apiKey) {
      console.error("DATAHUB_API_KEY is missing in environment");
      return res.status(500).json({ success: false, error: "Backend configuration error (API Key missing)" });
    }

    try {
      // DatahubGH API call using the documented endpoint and headers
      const response = await axios.post("https://app.datahubgh.com/api/external/data-purchase", {
        networkKey: networkKey, // YELLO, TELECEL, AT_BIGTIME
        recipient: recipient,
        capacity: capacity,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      });

      console.log("Datahub Response:", response.data);
      
      // Check for success in their specific format
      if (response.data && (response.data.status === 'success' || response.data.success)) {
        return res.json({ success: true, data: response.data });
      } else {
        return res.json({ success: false, error: response.data?.message || "Purchase failed at provider" });
      }
    } catch (error: any) {
      console.error("Datahub API Error:", error.response?.data || error.message);
      
      // Fallback for demo/testing purposes if the API key is invalid or external service is down
      if (apiKey.startsWith('sk_')) {
         console.warn("Using fallback success for testing purposes since we have an API key that might be active.");
         // In a real app, we'd handle this better, but for AI Studio builds we want the UI to succeed if possible
         // during development if the integration is nearly correct.
         // However, let's return the real error if it fails.
         return res.status(error.response?.status || 500).json({ 
           success: false, 
           error: error.response?.data?.message || error.message 
         });
      }

      return res.status(500).json({ success: false, error: "Failed to connect to data provider" });
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
      
      console.log(`Attempting to send SMS to ${recipientList} via Arkesel V1`);

      // Arkesel V1 technically supports GET and POST. 
      // Some specialized implementations prefer explicit headers.
      const response = await axios.get("https://sms.arkesel.com/sms/api", {
        params: {
          action: 'send-sms',
          api_key: arkeselKey,
          to: recipientList,
          from: sender || "Datapapa",
          sms: message
        },
        headers: {
          // Some V1 variations look for the key in headers too
          'api-key': arkeselKey,
          'Accept': 'application/json'
        },
        // Don't throw on non-200, we want to handle the code manually
        validateStatus: () => true 
      });

      console.log("Arkesel API Response Status:", response.status);
      console.log("Arkesel API Full Response Data:", response.data);

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
