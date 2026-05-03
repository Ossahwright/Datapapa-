import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Try to parse body if it's a string, or use directly if already parsed by Express
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { phone, message } = body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    // 🔐 ENV CHECK
    const apiKey = process.env.ARKESEL_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing ARKESEL_API_KEY in environment");
      return res.status(500).json({ error: "SMS service not configured (API key missing)" });
    }

    // 📞 FORMAT NUMBER
    let formatted = phone.trim().replace(/\D/g, '');

    if (formatted.startsWith("0")) {
      formatted = "233" + formatted.substring(1);
    } else if (formatted.length === 9) {
      formatted = "233" + formatted;
    }

    console.log("📤 [API] Sending SMS to:", formatted);

    const senderId = process.env.ARKESEL_SENDER_ID || "Datapapa";

    const response = await fetch(
      "https://sms.arkesel.com/api/v2/sms/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: senderId.slice(0, 11), // Arkesel limit is 11 chars
          message,
          recipients: [formatted],
        }),
      }
    );

    const result = await response.json();

    console.log("📥 ARKESEL RESPONSE:", result);

    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: "Arkesel API error", 
        details: result 
      });
    }

    return res.status(200).json({ success: true, result });
  } catch (err: any) {
    console.error("❌ SMS ERROR:", err);
    return res.status(500).json({ error: "SMS failed", message: err.message });
  }
}
