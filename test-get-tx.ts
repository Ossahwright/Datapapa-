import { supabase } from './lib/server-utils.js';
async function test() {
  const { data } = await supabase.from('transactions').select('id, network, capacity, datahub_capacity, status, vtu_status, error_message, api_response').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}
test();
