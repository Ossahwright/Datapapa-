import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('transactions').select('status, vtu_status, payment_status, delivery_status').limit(10);
  console.log('Transactions:', data);
  if (error) console.error('Error:', error);
}

test();
