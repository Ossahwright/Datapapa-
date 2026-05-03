import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      return res.status(200).send("Webhook is live ✅");
    }

    console.log("🔥 WEBHOOK RECEIVED");

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ ERROR:", err?.message || err);
    return res.status(200).send("safe exit");
  }
}
