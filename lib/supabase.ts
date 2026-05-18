import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyMDI5NywiZXhwIjoyMDkyNTk2Mjk3fQ.jBdQfnv7dd3RgIwPtH1CL5zIuqR5M5ko2kzJ32rsMEo';

if (!supabaseServiceKey) {
  console.error("❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing. Server-side operations will fail.");
}

// Admin client for server-side (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
