import { supabase } from '../lib/server-utils.js';

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

    console.log(`✅ Receipt found for identifier "${cleanId}": ID: ${transaction.id}`);
    return res.status(200).json({ success: true, transaction });

  } catch (err: any) {
    console.error("❌ Critical exception in receipt handler:", err);
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
