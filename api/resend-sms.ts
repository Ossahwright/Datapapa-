import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendSMS(to: string, message: string) {
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.ARKESEL_API_KEY || "",
      },
      body: JSON.stringify({
        sender: process.env.ARKESEL_SENDER_ID,
        message,
        recipients: [to],
      }),
    });

    const data = await res.json();
    console.log("📩 SMS RESPONSE:", data);
    return data;
  } catch (err) {
    console.error("❌ SMS ERROR:", err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { transactionId } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const { data: transaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchErr || !transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const msg = `Datapapa ✅\nYour ${transaction.capacity} ${transaction.network} data has been delivered to ${transaction.recipient_phone}.\nRef: ${transaction.id}`;

    const result = await sendSMS(transaction.recipient_phone, msg);

    if (result) {
      return res.json({ message: "SMS resent successfully", result });
    } else {
      return res.status(500).json({ message: "Failed to send SMS" });
    }
  } catch (err: any) {
    console.error("❌ RESEND SMS ERROR:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
}
