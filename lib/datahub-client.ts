import { supabase } from './server-utils.js';

/**
 * Standardized DataHub API Client
 * Includes logging, timeouts, and error handling
 */
export async function callDataHubAPI(endpoint: string, options: any = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const url = `https://datahubgh.com/api/${cleanEndpoint}`;

  console.log("CALLING:", url);

  try {
    const response = await fetch(url, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.DATAHUB_API_KEY}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    console.log("RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    // 📝 Log to api_logs as requested
    try {
      await supabase.from("api_logs").insert({
        endpoint: cleanEndpoint,
        request: options.body,
        response: data,
        status: response.ok ? "success" : "failed",
      });
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    if (!response.ok) {
      throw new Error(`${response.status} - ${data?.message || text}`);
    }

    return { success: true, data };

  } catch (error: any) {
    console.error("❌ DataHub Call Failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
