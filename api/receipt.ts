import { supabase, apiClient, purchaseData } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  console.log("=== API RECEIPT FETCH INITIATED ===");
  
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const id = req.query.id || req.body?.id;
    const cleanId = (id || '').toString().trim();

    if (!cleanId) {
      return res.status(400).json({ error: "Receipt identifier missing" });
    }

    // Determine if the requested ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(cleanId);

    console.log(`📍 Receipt Lookup - Identifier: "${cleanId}", Is UUID: ${isUuid}`);

    let query = supabase.from('transactions').select('*');

    if (isUuid) {
      // Direct UUID primary key lookup
      query = query.eq('id', cleanId);
    } else {
      // Alphanumeric reference lookups to handle falls and general paystack references
      query = query.or(`paystack_receipt.eq.${cleanId},internal_reference.eq.${cleanId},external_reference.eq.${cleanId},provider_reference.eq.${cleanId},reference.eq.${cleanId}`);
    }

    const { data: transaction, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error("❌ Receipt Query Error:", fetchError);
      return res.status(500).json({ error: fetchError.message || "Database error retrieving receipt" });
    }

    if (!transaction) {
      console.warn(`⚠️ Receipt NOT Found for: "${cleanId}"`);
      return res.status(404).json({ error: "Receipt not found in database record." });
    }

    console.log(`✅ Receipt found in DB for identifier "${cleanId}": ID: ${transaction.id}, Status: ${transaction.status}, Payment Status: ${transaction.payment_status}`);

    let finalTransaction = transaction;

    // 🚀 TIME VERIFICATION SPEED UP FALLBACK TRUTH CHECK
    if (transaction.status === 'initialized' || transaction.payment_status !== 'success') {
      console.log(`⏳ [Receipt API] Transaction ${transaction.id} is in pending state. Checking Paystack truth directly...`);
      try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
        if (PAYSTACK_SECRET_KEY) {
          const { data: psVerify } = await apiClient.get(`https://api.paystack.co/transaction/verify/${transaction.id}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
          });
          
          const paystackStatus = psVerify?.data?.status === "success" || psVerify?.data?.data?.status === "success" || psVerify?.data?.data?.status === "success";
          const psData = psVerify?.data?.data || psVerify?.data;

          console.log(`📊 [Receipt API] Paystack direct verify response for ${transaction.id}:`, {
            verifiedRawStatus: psVerify?.data?.status,
            dataStatus: psVerify?.data?.data?.status
          });
          
          if ((paystackStatus || psVerify?.data?.data?.status === "success" || psVerify?.data?.data?.gateway_response?.toLowerCase() === "successful") && psData) {
            console.log(`✅ [Receipt API] Paystack confirmed SUCCESS directly for ${transaction.id}. Promoting immediately.`);
            
            // 1. Promote in database
            const { data: promoted, error: promoErr } = await supabase
              .from('transactions')
              .update({ 
                status: "payment_success",
                payment_status: "success",
                external_reference: transaction.id,
                paystack_receipt: psData.reference || transaction.id,
                updated_at: new Date().toISOString() 
              })
              .eq('id', transaction.id)
              .select()
              .single();
              
            if (!promoErr && promoted) {
              finalTransaction = promoted;
              console.log("🚀 [Receipt API] Promotion verified. Dispatching data delivery...");
              
              // Trigger delivery in background (don't block receipt return, but fulfill it)
              purchaseData(promoted, "receipt_direct_verify").then((vtuRes) => {
                console.log("[Receipt API] Background purchaseData complete:", vtuRes);
              }).catch((e) => {
                console.error("[Receipt API] Background purchaseData exception:", e);
              });
            } else if (promoErr) {
              console.error("[Receipt API] DB Promotion error:", promoErr);
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [Receipt API] Paystack direct verify failed for ${transaction.id}:`, err.message || err);
      }
    }

    return res.status(200).json({ success: true, transaction: finalTransaction });

  } catch (err: any) {
    console.error("❌ Critical exception in receipt handler:", err);
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
