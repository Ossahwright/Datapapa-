import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 🛡️ JSON Body Parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Bridge: Dynamically handle scripts in /api folder
  app.all("/api/*", async (req, res, next) => {
    const apiPath = req.path; // e.g. /api/admin-ops
    const relativeFilePath = apiPath.slice(1) + ".ts"; // e.g. api/admin-ops.ts
    const filePath = path.resolve(process.cwd(), relativeFilePath);

    if (fs.existsSync(filePath)) {
      try {
        let handler;
        if (process.env.NODE_ENV !== "production") {
          // In dev, use Vite's ssrLoadModule for HMR
          const vite = (app as any).vite;
          if (vite) {
            const module = await vite.ssrLoadModule(filePath);
            handler = module.default;
          }
        } else {
          // In production, we might need a different way if we aren't bundling API files.
          // However, the instructions say to bundle server.ts.
          // For simplicity in this bridge, we'll try to import directly or use a pre-bundled map.
          // But since we are using esbuild for server.ts, we should probably just import it.
          const module = await import(filePath);
          handler = module.default;
        }

        if (typeof handler === "function") {
          return await handler(req, res);
        } else {
          return res.status(500).json({ error: `No default export found in ${relativeFilePath}` });
        }
      } catch (e: any) {
        console.error(`[Server] API Error in ${apiPath}:`, e);
        return res.status(500).json({ error: e.message });
      }
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    (app as any).vite = vite;
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
