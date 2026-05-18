import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  app.get("/ping", (req, res) => {
    res.send("pong");
  });

  console.log("🌐 Registering API Bridge...");
  // API Bridge: Dynamically handle scripts in /api folder
  app.all("/api/*", async (req, res, next) => {
    const apiPath = req.path; // e.g. /api/admin-ops
    const relativeFilePath = apiPath.slice(1) + ".ts"; // e.g. api/admin-ops.ts
    const filePath = path.resolve(process.cwd(), relativeFilePath);

    if (fs.existsSync(filePath)) {
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

        let handler;
        if (process.env.NODE_ENV !== "production") {
          const vite = (app as any).vite;
          if (vite) {
            const module = await vite.ssrLoadModule(filePath);
            handler = module.default;
          }
        } else {
          const module = await import(filePath);
          handler = module.default;
        }

        if (typeof handler === "function") {
          return await handler(req, resProxy);
        } else {
          return res.status(500).json({ error: `No default export found in ${relativeFilePath}` });
        }
      } catch (e: any) {
        console.error(`[Server] API Error in ${apiPath}:`, e);
        if (!res.headersSent) {
          return res.status(500).json({ error: e.message, stack: e.stack });
        }
      }
    }
    next();
  });

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
    app.get("*", (req, res) => {
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
