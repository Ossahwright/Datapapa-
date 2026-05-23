import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";

import apiAdminOps from "./api/admin-ops.ts";
import apiAdminRewards from "./api/admin-rewards.ts";
import apiDatahubWebhook from "./api/datahub-webhook.ts";
import apiPaystackInitialize from "./api/paystack/initialize.ts";
import apiPaystackWebhook from "./api/paystack-webhook.ts";
import apiPurchaseData from "./api/purchase-data.ts";
import apiReceipt from "./api/receipt.ts";
import apiSystemStatus from "./api/system-status.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function routeHandler(handler: any) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const resProxy = res as any;
      if (!resProxy.status) {
        resProxy.status = (code: number) => {
          res.statusCode = code;
          return resProxy;
        };
      }
      if (!resProxy.json) {
        resProxy.json = (data: any) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
          return resProxy;
        };
      }
      return await handler(req, resProxy);
    } catch (e: any) {
      console.error(`[Server] API Error in ${req.path}:`, e);
      if (!res.headersSent) {
        return res.status(500).json({ error: e.message, stack: e.stack });
      }
    }
  };
}

async function startServer() {
  console.log("🛠️ Initializing Express app...");
  const app = express();
  const PORT = 3000;

  // 🛡️ JSON Body Parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Add a hardcoded health check to verify the server is alive
  app.get("/api/health-check", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "alive", timestamp: new Date().toISOString() });
  });

  app.get("/ping", (req, res) => {
    res.send("pong");
  });

  console.log("🌐 Registering API Bridge...");
  app.all('/api/admin-ops', routeHandler(apiAdminOps));
  app.all('/api/admin-rewards', routeHandler(apiAdminRewards));
  app.all('/api/datahub-webhook', routeHandler(apiDatahubWebhook));
  app.all('/api/paystack/initialize', routeHandler(apiPaystackInitialize));
  app.all('/api/paystack-webhook', routeHandler(apiPaystackWebhook));
  app.all('/api/purchase-data', routeHandler(apiPurchaseData));
  app.all('/api/receipt', routeHandler(apiReceipt));
  app.all('/api/system-status', routeHandler(apiSystemStatus));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("⚡ Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    console.log("✅ Vite middleware initialized.");
    (app as any).vite = vite;
    app.use(vite.middlewares);
  } else {
    console.log("📦 Serving production build from dist/ folder...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*any", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log(`📡 Attempting to listen on port ${PORT}...`);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server fully operational at http://localhost:${PORT}`);
  }).on('error', (err) => {
    console.error('❌ SERVER FATAL ERROR:', err);
  });
}

console.log("🚀 Starting Datapapa Production Server...");
startServer().catch((err) => {
  console.error("💥 CRITICAL STARTUP ERROR:", err);
});
