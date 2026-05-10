import { supabase } from '../lib/server-utils.js';

/**
 * 🔒 SECURE TRANSACTION INITIATION
 * Creates a transaction record using SERVICE_ROLE permissions.
 * Prevents "RLS Violation" errors from frontend inserts.
 */
export default async function handler(req: any, res: any) {
  console.log("=== SERVER OWNED TRANSACTION INSERT ===");
  console.log("Actor: service_role");
  console.log("Source: initiate-transaction API");

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      user_id, 
      amount, 
      profit, 
      network, 
      recipient_phone, 
      payer_phone_number,
      capacity,
      network_key,
      datahub_network_key,
      datahub_capacity,
      paystack_reference,
      
      // 🚀 NORMALIZED FIELDS
      display_bundle,
      internal_bundle_id,
      provider_capacity,
      provider_network_key
    } = req.body;

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user_id || null,
        amount,
        profit,
        network,
        recipient_phone,
        payer_phone_number,
        status: "pending",
        capacity,
        network_key,
        datahub_network_key,
        datahub_capacity,
        paystack_receipt: paystack_reference,
        created_at: new Date().toISOString(),

        // 🚀 STORAGE NORMALIZATION
        display_bundle,
        internal_bundle_id,
        provider_capacity,
        provider_network_key
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Transaction insertion failed:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log("✅ Transaction successfully created by server:", data.id);
    return res.status(200).json({ success: true, transaction: data });

  } catch (error: any) {
    console.error("Unexpected error in initiate-transaction:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
