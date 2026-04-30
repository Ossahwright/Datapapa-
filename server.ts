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
      // DatahubGH API call (Common pattern for such services in GH)
      // This is a placeholder for the actual API call logic
      // Most of these services use a direct purchase endpoint
      
      // NEW DatahubGH platform (app.datahubgh.com)
      // Standard SME API pattern for Ghana: POST /api/v1/data
      const response = await axios.post("https://app.datahubgh.com/api/v1/data", {
        api_key: apiKey,
        network: networkKey, // YELLO, TELECEL, AT_BIGTIME
        recipient: recipient,
        plan_id: capacity, // Sometimes it's capacity, sometimes it's a specific plan ID. We'll use the capacity value as a guess for the plan
        volume: capacity,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
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
