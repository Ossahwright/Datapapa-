import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ TEST ROUTE (browser)
    if (req.method === "GET") {
      return res.status(200).send("Webhook is live ✅");
    }

    console.log("🔥 WEBHOOK RECEIVED");

    // Safely access body
    const event = req.body || {};

    console.log("📢 EVENT:", event?.event);

    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    console.log("✅ PAYMENT CONFIRMED");

    return res.status(200).send("ok");
  } catch (error: any) {
    console.error("❌ ERROR:", error?.message || error);
    return res.status(200).send("safe exit");
  }
}
