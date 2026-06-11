import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAyMDI5NywiZXhwIjoyMDkyNTk2Mjk3fQ.jBdQfnv7dd3RgIwPtH1CL5zIuqR5M5ko2kzJ32rsMEo';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Cleaning up test WASSCE bundle...");
  const { data, error } = await supabaseAdmin.from('bundles').delete().eq('id', '67682b61-4b05-4c43-bd0e-d84bf6a6789e').select();
  if (error) {
    console.error("bundles cleanup error:", error);
  } else {
    console.log("bundles cleanup success:", data);
  }
}

run().catch(console.error);
