import { purchaseData, supabase, sendSMS, buildSuccessSMS } from '../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ success: false, error: 'Missing transaction ID' });

  try {
    console.log(`[RetryVTU] Triggered for ID: ${transactionId}`);
    const { data: transaction, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr) {
      console.error(`[RetryVTU] Fetch error for ${transactionId}:`, fetchErr);
      return res.status(404).json({ success: false, error: `Transaction not found: ${fetchErr.message}` });
    }

    if (!transaction) {
      console.error(`[RetryVTU] No transaction found for ${transactionId}`);
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    console.log(`[RetryVTU] Found transaction: ${transaction.network} ${transaction.capacity} to ${transaction.recipient_phone}`);
    const vtuResult = await purchaseData(transaction) || { success: false, error: "No response from VTU provider" };
    console.log(`[RetryVTU] purchaseData result:`, JSON.stringify(vtuResult));
    
    // Delivery check - improved to handle various success strings
    const isActuallyDelivered = !!(vtuResult && (vtuResult.success === true || (
      vtuResult.status?.toUpperCase() === 'SUCCESSFUL' || 
      vtuResult.status?.toUpperCase() === 'SUCCESS' ||
      vtuResult.status?.toUpperCase() === 'DELIVERED' ||
      vtuResult.status?.toUpperCase() === 'COMPLETED' ||
      vtuResult.vtu_status === 'success' ||
      vtuResult.vtu_status === 'delivered'
    )));

    return res.json({
      ...vtuResult,
      message: isActuallyDelivered ? "VTU Delivery Triggered Successfully" : `VTU Failed: ${vtuResult?.error || "Unknown Provider Error"}`
    });
  } catch (err: any) {
    console.error(`[RetryVTU] FATAL ERROR for ${transactionId}:`, err);
    return res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
}
