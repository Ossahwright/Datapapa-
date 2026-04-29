import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API to proxy data purchase
  app.post("/api/purchase-data", async (req, res) => {
    try {
      const { networkKey, recipient, capacity } = req.body;
      
      if (!networkKey || !recipient || !capacity) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const apiKey = process.env.DATAHUB_API_KEY || "sk_bb283e645e4ab8c83edef7e4bb5f618fe7c68f24f467c5b8";

      const response = await fetch("https://app.datahubgh.com/api/external/data-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          networkKey,
          recipient,
          capacity
        })
      });

      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      console.error("Datahub API error:", error);
      res.status(500).json({ success: false, error: error.message });
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
