import axios from "axios";

export async function sendSMS(to: string, message: string, senderId: string = "Datapapa") {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    console.error("❌ SMS Error: ARKESEL_API_KEY missing");
    return { success: false, error: "API Key missing" };
  }

  // Normalize phone to format like 23324XXXXXXX if needed, 
  // but Arkesel usually handles local formats too. 
  // We'll ensure it's a string.
  const recipient = String(to);

  console.log(`📡 [SMS] Sending to ${recipient}:`);
  console.log(`💬 [SMS] Content: ${message}`);

  try {
    const response = await axios.get(`https://sms.arkesel.com/sms/api`, {
      params: {
        action: "send-sms",
        api_key: apiKey,
        to: recipient,
        from: senderId,
        sms: message
      },
      timeout: 10000
    });

    console.log("📡 [SMS] Response:", JSON.stringify(response.data));
    return { success: true, data: response.data };
  } catch (err: any) {
    console.error("❌ [SMS] Error:", err.message);
    return { success: false, error: err.message };
  }
}

export function buildSmsMessage(data: {
  capacity: string;
  network: string;
  phone: string;
}) {
  return `Datapapa\n\nYour purchase of ${data.capacity} ${data.network} data for ${data.phone} was successful.\n\nKindly contact or WhatsApp us on 0244014207\nThank you for your trust.`;
}
