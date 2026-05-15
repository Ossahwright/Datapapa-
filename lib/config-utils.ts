import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyMDI5NywiZXhwIjoyMDkyNTk2Mjk3fQ.jBdQfnv7dd3RgIwPtH1CL5zIuqR5M5ko2kzJ32rsMEo';

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

let cachedConfig: { apiKey: string, baseUrl: string } | null = null;
let lastConfigFetch = 0;

/**
 * Centralized DataHub Config Helper (Isolated to break circular dependencies)
 */
export async function getDataHubConfig() {
  const now = Date.now();
  // Cache for 5 minutes
  if (cachedConfig && (now - lastConfigFetch < 300000)) {
    return cachedConfig;
  }

  const defaultUrl = "https://app.datahubgh.com/api/external";
  const envKey = process.env.DATAHUB_API_KEY;
  let envUrl = process.env.DATAHUB_BASE_URL;

  // 🛡️ Sanitize: If envUrl is literally "undefined" or empty, use default
  if (!envUrl || envUrl === "undefined" || envUrl === "null") {
    envUrl = defaultUrl;
  }

  const sanitizeUrl = (url: string) => {
    let clean = url.trim().replace(/\/+$/, "");
    if (clean.endsWith("/data-purchase")) {
      clean = clean.replace("/data-purchase", "");
    }
    return clean;
  };

  if (envKey) {
    cachedConfig = {
      apiKey: envKey.trim(),
      baseUrl: sanitizeUrl(envUrl)
    };
    lastConfigFetch = now;
    return cachedConfig;
  }

  try {
    const { data: dhData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'datahubgh')
      .maybeSingle();
    
    if (dhData?.value?.api_key) {
      const dbUrl = dhData.value.base_url;
      const finalUrl = (!dbUrl || dbUrl === "undefined" || dbUrl === "null") ? envUrl : dbUrl;
      cachedConfig = {
        apiKey: dhData.value.api_key.trim(),
        baseUrl: sanitizeUrl(finalUrl)
      };
      lastConfigFetch = now;
      return cachedConfig;
    }
  } catch (err) {
    console.error("[Config Utils] Error fetching from DB:", err);
  }

  return { apiKey: "", baseUrl: sanitizeUrl(envUrl) };
}
