import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'vercel-api-bridge',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url || "";
            if (url.startsWith('/api/')) {
              const apiPath = url.split('?')[0];
              // Look for the file in the /api directory
              const filePath = path.resolve(process.cwd(), apiPath.slice(1) + ".ts");
              
              if (fs.existsSync(filePath)) {
                try {
                  // Body parsing shim for POST requests
                  if (req.method === 'POST' && !(req as any).body) {
                    const buffers = [];
                    for await (const chunk of req) {
                      buffers.push(chunk);
                    }
                    const data = Buffer.concat(buffers).toString();
                    (req as any).rawBody = data;
                    if (data) {
                      try {
                        (req as any).body = JSON.parse(data);
                      } catch (e) {
                        (req as any).body = data;
                      }
                    } else {
                      (req as any).body = {};
                    }
                  }

                  // Vercel-like response object shim
                  const resProxy = res as any;
                  if (!resProxy.status) {
                    resProxy.status = (code: number) => {
                      res.statusCode = code;
                      return resProxy;
                    };
                  }
                  if (!resProxy.json) {
                    resProxy.json = (data: any) => {
                      if (!res.headersSent) {
                        res.setHeader('Content-Type', 'application/json');
                      }
                      res.end(JSON.stringify(data));
                      return resProxy;
                    };
                  }
                  if (!resProxy.send) {
                    resProxy.send = (data: any) => {
                      res.end(typeof data === 'string' ? data : JSON.stringify(data));
                      return resProxy;
                    };
                  }

                  // Load and execute the API handler
                  console.log(`[API Bridge] Loading module: ${filePath}`);
                  const module = await server.ssrLoadModule(filePath);
                  const handler = module.default;
                  
                  if (typeof handler === 'function') {
                    console.log(`[API Bridge] Executing: ${apiPath}`);
                    await handler(req, resProxy);
                    return;
                  } else {
                    console.warn(`[API Bridge] No default export found in ${filePath}`);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "No default export found in handler file" }));
                    return;
                  }
                } catch (e: any) {
                  console.error(`[API Bridge] Fatal error in ${apiPath}:`, e);
                  console.error(e.stack);
                  if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message || "Internal Server Error", stack: e.stack }));
                  }
                  return;
                }
              } else {
                console.warn(`[API Bridge] 404: File not found for ${apiPath} (checked ${filePath})`);
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "API endpoint file not found" }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
