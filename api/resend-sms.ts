import { supabase, sendSMS, buildSuccessSMS } from '../lib/server-utils.js';

console.log("server-utils loaded successfully inside resend-sms");

export default async function handler(req: any, res: any) {
  console.log("resend-sms handler booted");
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: "Transaction ID required" });
    const { data: transaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchErr || !transaction) return res.status(404).json({ error: "Transaction not found" });

    const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
    const settings = settingsData?.value || {};

    const message = buildSuccessSMS({
      volume: transaction.capacity,
      network: transaction.network,
      phone: transaction.recipient_phone,
      transactionId: transaction.id,
      template: settings.sms_template_success
    });

    const result = await sendSMS(transaction.recipient_phone, message);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
