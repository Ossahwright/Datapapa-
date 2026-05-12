import { supabase } from "./lib/server-utils.js";

async function checkBundles() {
  const { data, error } = await supabase.from('bundles')
    .select('*')
    .eq('is_active', true)
    .eq('network', 'AirtelTigo');
  if (error) {
    console.error("Error fetching bundles:", error);
    return;
  }
  console.log("AirtelTigo Bundles:", JSON.stringify(data, null, 2));
}

checkBundles();
