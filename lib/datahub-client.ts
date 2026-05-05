import { supabase } from './server-utils.js';

/**
 * Standardized DataHub API Client
 * Includes logging, timeouts, and error handling
 */
export async function callDataHubAPI(endpoint: string, options: any = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  const start = Date.now();
  const apiKey = process.env.DATAHUB_API_KEY;
  const baseUrl = process.env.DATAHUB_BASE_URL || "https://app.datahubgh.com/api";

  try {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey || "",
        "Accept": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const duration = Date.now() - start;
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("📡 [DataHub Client] Response:", {
      endpoint,
      status: response.status,
      duration: `${duration}ms`,
      data,
    });

    // 📝 Log to api_logs
    try {
      await supabase.from("api_logs").insert({
        endpoint,
        request: options.body,
        response: data,
        status: response.ok ? "success" : "failed",
        http_status: response.status,
        duration_ms: duration,
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error("[DataHub Client] Log error:", logErr);
    }

    if (!response.ok) {
      throw new Error(`DataHub error: ${response.status} - ${data.message || data.error || 'Unknown error'}`);
    }

    return { success: true, data, status: response.status, duration };

  } catch (error: any) {
    console.error("❌ [DataHub Client] Call Failed:", error.message);

    return {
      success: false,
      error: error.message,
      duration: Date.now() - start
    };
  } finally {
    clearTimeout(timeout);
  }
}
