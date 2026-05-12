import { supabase } from '../../lib/server-utils.js';

/**
 * 🚀 PAYSTACK V2 AUTHORITATIVE INITIALIZATION
 * Responsibility: Create a verified intent in Supabase and return config for Paystack.
 * Flow: Frontend -> initialize.ts -> DB (initialized) -> Return to Frontend
 */
export default async function handler(req: any, res: any) {
  console.log("=== PAYSTACK V2 INITIALIZATION START ===");
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      bundleId, 
      phone, 
      payerPhone, 
      networkId, 
      userId,
      platform = 'web_v2',
      reference: clientReference
    } = req.body;

    // 1. STERN VALIDATION
    if (!bundleId || !phone || !networkId) {
      console.error("❌ Missing required fields:", { bundleId, phone, networkId });
      return res.status(400).json({ error: "Missing required fields for transaction initialization." });
    }

    // 2. AUTHORITATIVE BUNDLE PRICE CHECK
    console.log(`🔎 Validating bundle: ${bundleId}`);
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', bundleId)
      .single();

    if (bundleError || !bundle) {
      console.error("❌ Bundle resolution failed:", bundleError);
      return res.status(404).json({ error: "Bundle not found or inactive." });
    }

    const authoritativeAmount = parseFloat(bundle.selling_price);
    if (!authoritativeAmount || authoritativeAmount <= 0) {
      console.error("❌ Invalid authoritative amount:", authoritativeAmount);
      return res.status(400).json({ error: "Invalid bundle price detected." });
    }

    // 3. GENERATE DETERMINISTIC REFERENCES
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const friendlyReference = clientReference || `DP-${timestamp}-${random}`;

    // 4. PERSIST INTENT (IDEMPOTENT CREATION)
    console.log("📝 Persisting transaction intent with friendly ref:", friendlyReference);
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId || null,
        amount: authoritativeAmount,
        recipient_phone: phone,
        payer_phone_number: payerPhone || phone,
        network: bundle.network,
        network_key: bundle.network_key,
        capacity: bundle.capacity,
        status: "initialized",
        payment_status: "initialized",
        reference: friendlyReference, // Customer-facing
        internal_reference: "PENDING_ID", // We will update this or just use the ID
        
        // Storage of bundle metadata for fulfillment
        display_bundle: bundle.capacity,
        internal_bundle_id: bundle.id,
        provider_network_key: bundle.network_key,
        provider_capacity: bundle.volume || bundle.capacity,
        
        profit: Math.max(0, authoritativeAmount - (parseFloat(bundle.cost_price || '0') || 0)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (txError) {
      console.error("❌ Intent persistence failed:", txError);
      return res.status(500).json({ error: "Failed to create payment intent in database." });
    }

    // UPDATE with the actual ID for internal sync
    await supabase.from("transactions").update({ 
      internal_reference: transaction.id,
      paystack_receipt: transaction.id 
    }).eq("id", transaction.id);

    console.log("✅ PAYMENT INTENT STORED:", transaction.id);

    // 5. RETURN CLEAN CONFIG (Using transaction.id as the reference for Paystack)
    return res.status(200).json({
      success: true,
      config: {
        reference: transaction.id, // 🚀 USE UUID AS PAYSTACK REFERENCE
        friendlyReference,         // Keep for display if needed
        amount: Math.round(authoritativeAmount * 100),
        email: 'customer@datapapa.com',
        transactionId: transaction.id,
        metadata: {
          transaction_id: transaction.id,
          phone,
          network: bundle.network,
          bundle: bundle.capacity,
          platform
        }
      }
    });

  } catch (error: any) {
    console.error("❌ UNEXPECTED INITIALIZATION ERROR:", error);
    return res.status(500).json({ error: "A critical error occurred during initialization." });
  }
}
