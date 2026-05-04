import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Dynamic API routing to mimic Vercel Serverless Functions
  app.all("/api/*", async (req, res) => {
    const apiPath = req.path; // e.g. /api/purchase-data
    const filePath = path.join(__dirname, apiPath + ".ts");
    const nestedFilePath = path.join(__dirname, apiPath, "index.ts");
    
    let targetFile = "";
    if (fs.existsSync(filePath)) targetFile = filePath;
    else if (fs.existsSync(nestedFilePath)) targetFile = nestedFilePath;

    if (targetFile) {
      try {
        console.log(`[Serverless Bridge] Handling ${apiPath}`);
        // Dynamic import of the serverless function
        const module = await import(targetFile);
        const handler = module.default;
        
        if (typeof handler === 'function') {
          // Shim for Vercel req/res if needed, though basic Express is very similar
          return handler(req, res);
        } else {
          res.status(500).json({ error: `Handler in ${apiPath} is not a function` });
        }
      } catch (err: any) {
        console.error(`[Serverless Bridge] Error in ${apiPath}:`, err.message);
        res.status(500).json({ error: err.message });
      }
    } else {
      console.warn(`[Serverless Bridge] 404: No handler found for ${apiPath}`);
      res.status(404).json({ error: "Route not found" });
    }
  });

  // Vite middleware for development (Frontend)
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
    console.log(`🚀 [Datapapa Serverless Emulation] Port: ${PORT}`);
    console.log(`📡 Local logic moved to /api/*.ts`);
  });
}

startServer();
