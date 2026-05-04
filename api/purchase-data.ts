import { purchaseData, supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { 
    networkKey, 
    recipient, 
    capacity, 
    transaction_id,
    // Add User-specified aliases
    bundle,
    phone,
    paystack_ref,
    payer_phone_number
  } = req.body;

  // Use aliases if primary ones are missing
  const finalTransactionId = transaction_id || paystack_ref;
  const finalRecipient = recipient || phone;
  
  // Extract from bundle object if it exists
  const bundleCapacity = typeof bundle === 'object' && bundle !== null ? bundle.capacity : bundle;
  const bundleNetworkKey = typeof bundle === 'object' && bundle !== null ? bundle.network_key : networkKey;
  
  const finalCapacity = capacity || bundleCapacity;
  const finalNetworkKey = networkKey || bundleNetworkKey;

  console.log(`[API] Purchase Data Request: ${finalTransactionId} for ${finalRecipient} (${finalCapacity})`);

  try {
    // 1. Update payer phone if provided
    if (finalTransactionId && payer_phone_number) {
      await supabase
        .from('transactions')
        .update({ payer_phone_number })
        .eq('id', finalTransactionId);
    }

    // 2. Fetch transaction details if only ID is provided
    let transaction = { ...req.body };
    if (finalTransactionId && !finalRecipient) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', finalTransactionId)
        .single();
      
      if (error || !data) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      transaction = data;
    }

    // Ensure we have normalized fields for purchaseData function
    transaction.recipient_phone = transaction.recipient_phone || finalRecipient;
    transaction.capacity = transaction.capacity || finalCapacity;
    transaction.network_key = transaction.network_key || finalNetworkKey;
    transaction.id = transaction.id || finalTransactionId;
    transaction.transaction_id = transaction.id;

    if (!transaction.recipient_phone) {
      return res.status(400).json({ success: false, error: 'Target phone missing' });
    }

    // 2. Perform Data Purchase
    console.log("🚀 [DataHub] SENDING DATAHUB REQUEST");
    const result = await purchaseData(transaction);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    console.error("[API] Purchase Data Fatal Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
