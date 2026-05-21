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

    // 3. GENERATE AUTHORITATIVE REFERENCE
    // The authoritative identity is the Supabase UUID (transaction.id).
    // We will use this directly as the Paystack reference.

    // 4. PERSIST INTENT (IDEMPOTENT CREATION)
    console.log("📝 Persisting transaction intent for:", phone);
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
        
        // Storage of bundle metadata for fulfillment
        display_bundle: bundle.capacity,
        internal_bundle_id: bundle.id,
        provider_network_key: bundle.datahub_network_key || bundle.network_key,
        provider_capacity: bundle.datahub_capacity || bundle.volume || bundle.capacity,
        
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

<<<<<<< HEAD
    // 🚀 STAGE EXPLICIT PAYER IDENTITY FOR COMPLIANCE (using payer_phone_number)
    const rawPayerPhone = payerPhone || phone;
    
    // STEP 6: Defensive Sanitization of phone string
    let payerPhoneNumber = (rawPayerPhone || "").toString().trim();
    payerPhoneNumber = payerPhoneNumber.replace(/[^0-9]/g, ''); // Strictly numeric format safe
    
    // Limit to safe international phone standards (standard ITU-T E.164 allows up to 15 digits)
    if (payerPhoneNumber.length > 15) {
      payerPhoneNumber = payerPhoneNumber.slice(0, 15);
    }

    // Strict default fallback ensuring a phone construct is always valid
    if (!payerPhoneNumber) {
      payerPhoneNumber = "0000000000";
    }

    // Step 2 & 3: Authoritative server-side customer email generation
    const paystackEmail = `${payerPhoneNumber}@datapapa.site`;

    // STEP 7: Forensic Payment Logging
    console.log("=== PAYSTACK CUSTOMER EMAIL GENERATED ===");
    console.log("=== PAYER PHONE ===", payerPhoneNumber);
    console.log("=== PAYSTACK EMAIL ===", paystackEmail);

=======
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
    // 🚀 STEP 1, 2, 3 - AUTHORITATIVE IDENTITY CONVERGENCE
    // We update the record to ensure identity convergence across ALL reference fields.
    await supabase.from("transactions").update({ 
      external_reference: transaction.id, 
      paystack_receipt: transaction.id,
      internal_reference: transaction.id, // Converging all back to UUID
      reference: transaction.id           // Converging back to UUID
    }).eq("id", transaction.id);

<<<<<<< HEAD
    // Step 5: Defensive Transaction Column Persistence (fails gracefully if schema hasn't run yet)
    try {
      const { error: dbColErr } = await supabase.from("transactions").update({
        customer_payment_email: paystackEmail
      }).eq("id", transaction.id);
      
      if (dbColErr) {
        throw dbColErr;
      }
      console.log("💾 Compliance email successfully saved to transaction database column.");
    } catch (colErr: any) {
      console.warn("⚠️ Database column customer_payment_email might not exist yet, defaulting to metadata-only storage:", colErr.message || colErr);
    }

=======
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
    console.log("=== AUTHORITATIVE IDENTITY ESTABLISHED ===");
    console.log("📍 UUID (ID):", transaction.id);

    // 5. RETURN CLEAN CONFIG (Strictly using transaction.id as the reference)
    return res.status(200).json({
      success: true,
      config: {
        reference: transaction.id, // 🚀 AUTHORITATIVE REFERENCE = UUID
        amount: Math.round(authoritativeAmount * 100),
<<<<<<< HEAD
        email: paystackEmail,
=======
        email: 'customer@datapapa.com',
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
        transaction_id: transaction.id,
        metadata: {
          transaction_id: transaction.id, // 🚀 METADATA SYNC
          phone,
<<<<<<< HEAD
          customer_payment_email: paystackEmail, // Step 5: Metadata persistence
          payer_phone: payerPhoneNumber,
=======
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
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
