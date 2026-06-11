import { supabase } from '../../lib/server-utils.js';

/**
 * 🚀 PAYSTACK V2 AUTHORITATIVE INITIALIZATION
 * Responsibility: Create a verified intent in Supabase and return config for Paystack.
 * Flow: Frontend -> initialize.ts -> DB (initialized) -> Return to Frontend
 */
export default async function handler(req: any, res: any) {
  console.log("=== PAYSTACK V2 INITIALIZATION START ===");
  console.log("PAYSTACK INITIALIZE BODY:", req.body);
  
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
      reference: clientReference,
      amount,
      service_type = 'DATA'
    } = req.body;

    // 1. STERN VALIDATION
    if (service_type !== 'AIRTIME' && !bundleId) {
      console.error("❌ Missing bundleId for non-airtime initialization");
      return res.status(400).json({ error: "Missing required fields for transaction initialization." });
    }
    if (!phone || !networkId) {
      console.error("❌ Missing required fields:", { phone, networkId });
      return res.status(400).json({ error: "Missing required fields for transaction initialization." });
    }

    let authoritativeAmount = 0;
    let networkName = String(networkId).toUpperCase();
    let networkKey = String(networkId).toLowerCase();
    let providerNetworkKey = String(networkId).toUpperCase();
    let capacityText = "";
    let providerCapacity = "";
    let costPrice = 0;
    let internalBundleId: string | null = null;
    const finalServiceType = service_type || 'DATA';
    const finalProvider = finalServiceType === 'AIRTIME' ? 'HUBTEL' : 'DATAHUBGH';

    if (finalServiceType === 'AIRTIME') {
      authoritativeAmount = parseFloat(amount);
      if (isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
        console.error("❌ Invalid airtime amount:", amount);
        return res.status(400).json({ error: "Invalid airtime amount detected." });
      }

      // Standardize Network Parameters for Airtime
      const normNetwork = networkName.trim().toUpperCase();
      if (normNetwork === 'MTN') {
        networkName = 'MTN';
        networkKey = 'mtn';
        providerNetworkKey = 'YELLO';
      } else if (normNetwork === 'TELECEL' || normNetwork === 'VODAFONE' || normNetwork === 'VODA') {
        networkName = 'TELECEL';
        networkKey = 'telecel';
        providerNetworkKey = 'TELECEL';
      } else if (normNetwork === 'AT' || normNetwork === 'AIRTELTIGO') {
        networkName = 'AT';
        networkKey = 'at';
        providerNetworkKey = 'AT_BIGTIME';
      }

      capacityText = `GHS ${authoritativeAmount} Airtime`;
      providerCapacity = `GHS ${authoritativeAmount}`;
      // For dynamic airtime, cost price is 97% of face value (3% standard dealer commission)
      costPrice = authoritativeAmount * 0.97;
    } else {
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

      authoritativeAmount = parseFloat(bundle.selling_price);
      if (!authoritativeAmount || authoritativeAmount <= 0) {
        console.error("❌ Invalid authoritative amount:", authoritativeAmount);
        return res.status(400).json({ error: "Invalid bundle price detected." });
      }

      networkName = bundle.network;
      networkKey = bundle.network_key;
      capacityText = bundle.capacity;
      providerNetworkKey = bundle.datahub_network_key || bundle.network_key;
      providerCapacity = bundle.datahub_capacity || bundle.volume || bundle.capacity;
      costPrice = parseFloat(bundle.cost_price || '0');
      internalBundleId = bundle.id;
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
        network: networkName,
        network_key: networkKey,
        capacity: capacityText,
        status: "initialized",
        payment_status: "initialized",
        service_type: finalServiceType,
        provider: finalProvider,
        
        // Storage of bundle metadata for fulfillment
        display_bundle: capacityText,
        internal_bundle_id: internalBundleId,
        provider_network_key: providerNetworkKey,
        provider_capacity: providerCapacity,
        
        profit: Math.max(0, authoritativeAmount - costPrice),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (txError) {
      console.error("❌ Intent persistence failed:", txError);
      return res.status(500).json({ error: "Failed to create payment intent in database." });
    }

    // 🚀 STAGE EXPLICIT PAYER IDENTITY FOR COMPLIANCE (using payer_phone_number)
    const rawPayerPhone = payerPhone || phone;
    
    // STEP 6: Defensive Sanitization of phone string
    const payerPhoneNumber = (rawPayerPhone || "").toString().trim();
    
    // Generate deterministic customer email using payer phone number:
    const normalizedPhone = payerPhoneNumber.replace(/\D/g, '').trim();

    const customerEmail =
      normalizedPhone.length > 0
        ? `${normalizedPhone}@datapapa.site`
        : `guest_${Date.now()}@datapapa.site`;

    // STEP 7: Forensic Payment Logging & Verification
    console.log("FINAL PAYSTACK CUSTOMER EMAIL:", customerEmail);
    console.log("=== PAYSTACK CUSTOMER EMAIL GENERATED ===");
    console.log("=== PAYER PHONE ===", normalizedPhone);
    console.log("=== PAYSTACK EMAIL ===", customerEmail);

    // 🚀 STEP 1, 2, 3 - AUTHORITATIVE IDENTITY CONVERGENCE
    // We update the record to ensure identity convergence across ALL reference fields.
    await supabase.from("transactions").update({ 
      external_reference: transaction.id, 
      paystack_receipt: transaction.id,
      internal_reference: transaction.id, // Converging all back to UUID
      reference: transaction.id           // Converging back to UUID
    }).eq("id", transaction.id);

    // Step 5: Defensive Transaction Column Persistence (fails gracefully if schema hasn't run yet)
    try {
      const { error: dbColErr } = await supabase.from("transactions").update({
        customer_payment_email: customerEmail
      }).eq("id", transaction.id);
      
      if (dbColErr) {
        throw dbColErr;
      }
      console.log("💾 Compliance email successfully saved to transaction database column.");
    } catch (colErr: any) {
      console.warn("⚠️ Database column customer_payment_email might not exist yet, defaulting to metadata-only storage:", colErr.message || colErr);
    }

    console.log("=== AUTHORITATIVE IDENTITY ESTABLISHED ===");
    console.log("📍 UUID (ID):", transaction.id);
    console.log("FINAL GENERATED EMAIL:", customerEmail);
    console.log("=== PAYSTACK_INITIALIZE_START ===");

    // ⚙️ FETCH PAYSTACK PUBLIC KEY & SECRET KEY FROM DB SETTINGS OR ENVIRONMENT
    let dbPublicKey = "";
    let dbSecretKey = "";

    // 1. First fetch separate settings keys
    try {
      const { data: keysRow } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['paystack_public_key', 'paystack_secret_key']);
      
      if (keysRow) {
        const pubRow = keysRow?.find(r => r.key === 'paystack_public_key');
        const secRow = keysRow?.find(r => r.key === 'paystack_secret_key');
        if (pubRow && pubRow.value) {
          dbPublicKey = typeof pubRow.value === 'string' ? pubRow.value : JSON.stringify(pubRow.value).replace(/^"(.*)"$/, '$1');
        }
        if (secRow && secRow.value) {
          dbSecretKey = typeof secRow.value === 'string' ? secRow.value : JSON.stringify(secRow.value).replace(/^"(.*)"$/, '$1');
        }
      }
    } catch (dbErr) {
      console.warn("Could not fetch Paystack keys from settings table:", dbErr);
    }

    // 2. Fetch/Fallback from centralized secure properties object
    try {
      const { data: secureRow } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'secure')
        .maybeSingle();

      if (secureRow && secureRow.value) {
        const secureVal = typeof secureRow.value === 'string' ? JSON.parse(secureRow.value) : secureRow.value;
        if (secureVal?.paystack_public_key && !dbPublicKey) {
          dbPublicKey = secureVal.paystack_public_key;
        }
        if (secureVal?.paystack_secret_key && !dbSecretKey) {
          dbSecretKey = secureVal.paystack_secret_key;
        }
      }
    } catch (secErr) {
      console.warn("Could not fetch Paystack keys from secure settings key:", secErr);
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || dbSecretKey || "";
    const PAYSTACK_PUBLIC_KEY = process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || dbPublicKey || "";

    console.log("=== PAYSTACK_INITIALIZE_SUCCESS ===");
    console.log("📍 UUID (ID):", transaction.id);
    console.log("🔑 Public Key Present:", !!PAYSTACK_PUBLIC_KEY);
    console.log("🔑 Secret Key Present:", !!PAYSTACK_SECRET_KEY);

    let paystackAuthorizationUrl = "";
    if (PAYSTACK_SECRET_KEY && PAYSTACK_SECRET_KEY.trim() !== "" && !PAYSTACK_SECRET_KEY.includes("PAYSTACK_SECRET_KEY")) {
      try {
        console.log("🔗 Contacting Paystack API to generate standard checkout url...");
        const pyRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PAYSTACK_SECRET_KEY.trim()}`
          },
          body: JSON.stringify({
            email: customerEmail,
            amount: Math.round(authoritativeAmount * 100),
            reference: transaction.id,
            callback_url: `${req.headers.origin || 'https://datapapa.site'}/receipt/${transaction.id}`,
            metadata: {
              transaction_id: transaction.id,
              phone,
              customer_payment_email: customerEmail,
              payer_phone: normalizedPhone,
              network: networkName,
              bundle: capacityText,
              platform
            }
          })
        });

        const pyData = await pyRes.json();
        if (pyData && pyData.status && pyData.data) {
          paystackAuthorizationUrl = pyData.data.authorization_url;
          console.log("=== PAYSTACK_AUTHORIZATION_URL_RECEIVED ===");
          console.log("✅ Paystack API Initialized successfully. URL:", paystackAuthorizationUrl);
        } else {
          console.warn("⚠️ Paystack API failed inside server initialize handler:", pyData);
        }
      } catch (pyErr) {
        console.error("❌ Failed to communicate with Paystack API server:", pyErr);
      }
    }

    const initializePayload = {
      success: true,
      config: {
        reference: transaction.id, // 🚀 AUTHORITATIVE REFERENCE = UUID
        amount: Math.round(authoritativeAmount * 100),
        email: customerEmail,
        transaction_id: transaction.id,
        publicKey: PAYSTACK_PUBLIC_KEY,
        authorizationUrl: paystackAuthorizationUrl,
        metadata: {
          transaction_id: transaction.id, // 🚀 METADATA SYNC
          phone,
          customer_payment_email: customerEmail, // Step 5: Metadata persistence
          payer_phone: normalizedPhone,
          network: networkName,
          bundle: capacityText,
          platform
        }
      }
    };
    
    console.log("PAYSTACK PAYLOAD SENT:", initializePayload);

    // 5. RETURN CLEAN CONFIG (Strictly using transaction.id as the reference)
    return res.status(200).json(initializePayload);

  } catch (error: any) {
    console.error("❌ UNEXPECTED INITIALIZATION ERROR:", error);
    return res.status(500).json({ error: "A critical error occurred during initialization." });
  }
}
