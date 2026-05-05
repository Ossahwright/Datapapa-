import { sendSMS } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, recipients, message, sender, to } = req.body;
  const target = to || phone || (Array.isArray(recipients) ? recipients[0] : recipients);

  if (!target || !message) {
    return res.status(400).json({ success: false, error: 'Target phone and message are required' });
  }

  console.log(`[API] Send SMS Request to: ${target}`);

  try {
    const result = await sendSMS(target, message, sender);
    
    if (result.status === 'success' || result.code === '1000' || result.code === 1000) {
      return res.status(200).json({ success: true, data: result });
    } else {
      return res.status(400).json({ success: false, error: result.message || 'Failed to send SMS', details: result });
    }
  } catch (err: any) {
    console.error("[API] Send SMS Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
