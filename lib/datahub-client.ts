import { supabase, logDataHubApiCall } from './server-utils.js';
import { getDataHubConfig } from './config-utils.js';

/**
 * Standardized DataHub API Client
 * Includes logging, timeouts, and error handling with retries for 429s
 */
export async function callDataHubAPI(endpoint: string, options: any = {}, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const config = await getDataHubConfig();
    const apiKey = config.apiKey;
    const baseUrl = config.baseUrl || "https://app.datahubgh.com/api/external";

    const cleanEndpoint = endpoint.replace(/^\/+/, "");
    
    // 🛡️ Authoritative URL Normalization using new URL()
    let url: string;
    try {
      const base = baseUrl.replace(/\/+$/, "");
      url = new URL(cleanEndpoint, base + "/").toString();
      
      // Guard against common malformations where endpoint might be double-joined
      if (base.toLowerCase().endsWith(cleanEndpoint.toLowerCase())) {
         url = base; 
      }
    } catch (e) {
      console.warn("⚠️ [DataHub Client] URL normalization failed for:", { baseUrl, endpoint });
      url = `${baseUrl.replace(/\/+$/, "")}/${cleanEndpoint}`;
    }
    
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: options.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey || "",
          "Accept": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 429 && attempt < maxRetries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ [DataHub 429] Retrying in ${wait}ms (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        attempt++;
        clearTimeout(timeout);
        continue;
      }

      const text = await response.text();
      const isHtml = text.trim().toLowerCase().startsWith("<!doctype html>") || text.trim().toLowerCase().startsWith("<html>");
      
      if (isHtml) {
         console.error("📡 [DataHub] HTML PAGE DETECTED! Likely 404 or malformed URL.");
         console.error("URL CALLED:", url);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: isHtml ? "HTML ERROR PAGE" : text };
      }

      // 📝 Log to DataHub Logs using standardized helper
      await logDataHubApiCall({
        endpoint: cleanEndpoint,
        payload: options.body,
        response: data,
        httpStatus: response.status,
        duration: Date.now() - startTime,
        errorMessage: response.ok ? undefined : (isHtml ? "Provider returned HTML" : "API Error")
      });

      if (!response.ok) {
        const errorMsg = data?.message || (isHtml ? `Service Unavailable (HTML ${response.status})` : text);
        throw new Error(`${response.status} - ${errorMsg}`);
      }

      clearTimeout(timeout);
      return { success: true, data };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log failure to DataHub logs
      await logDataHubApiCall({
        endpoint: cleanEndpoint,
        payload: options.body,
        errorMessage: error.message,
        duration
      });

      if (attempt < maxRetries - 1 && (error.name === 'AbortError' || error.message.includes('429'))) {
        attempt++;
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, wait));
        clearTimeout(timeout);
        continue;
      }

      if (error.message && error.message.includes("404")) {
        console.warn("⚠️ DataHub Call Warning: 404 - Service Unavailable");
      } else {
        console.error("❌ DataHub Call Failed:", error.message);
      }

      clearTimeout(timeout);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  
  return { success: false, error: "Max retries exceeded" };
}
