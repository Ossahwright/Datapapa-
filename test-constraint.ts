import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabaseAdmin.from("transactions").update({ status: "success" }).eq("id", "00000000-0000-0000-0000-000000000000");
  console.log("UPDATE ERROR", error);
}

test();
