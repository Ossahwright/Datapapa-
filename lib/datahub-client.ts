import { supabase, getDataHubConfig } from './server-utils.js';

/**
 * Standardized DataHub API Client
 * Includes logging, timeouts, and error handling
 */
export async function callDataHubAPI(endpoint: string, options: any = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  const config = await getDataHubConfig();
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl || "https://app.datahubgh.com/api/external";

  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const url = `${baseUrl.replace(/\/+$/, "")}/${cleanEndpoint}`;

  console.log("CALLING DATAHUB:", url);

  try {
    const response = await fetch(url, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey || "",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const isHtml = text.trim().toLowerCase().startsWith("<!doctype html>") || text.trim().toLowerCase().startsWith("<html>");
    
    if (isHtml) {
       console.log("📡 [DataHub] Received HTML instead of JSON. Possible 404 or maintenance page.");
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: isHtml ? "HTML ERROR PAGE" : text };
    }

    // 📝 Log to api_logs
    try {
      await supabase.from("api_logs").insert({
        endpoint: cleanEndpoint,
        request: options.body,
        response: data,
        status: response.ok ? "success" : "failed",
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    if (!response.ok) {
      const errorMsg = data?.message || (isHtml ? `Service Unavailable (HTML ${response.status})` : text);
      throw new Error(`${response.status} - ${errorMsg}`);
    }

    return { success: true, data };

  } catch (error: any) {
    if (error.message && error.message.includes("404")) {
      console.warn("⚠️ DataHub Call Warning: 404 - Service Unavailable");
    } else {
      console.error("❌ DataHub Call Failed:", error.message);
    }

    return {
      success: false,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
