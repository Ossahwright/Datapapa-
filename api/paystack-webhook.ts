import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("🔥 WEBHOOK RECEIVED");

  try {
    const event = req.body;

    console.log("📢 EVENT:", event.event);

    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    console.log("✅ PAYMENT CONFIRMED");

    const metadata = event.data.metadata;

    let transactionId = metadata?.transaction_id;

    // handle string metadata
    if (typeof metadata === "string") {
      try {
        const parsed = JSON.parse(metadata);
        transactionId = parsed.transaction_id;
      } catch (e) {
        console.error("❌ Metadata parse failed");
      }
    }

    console.log("📌 TRANSACTION ID:", transactionId);

    if (!transactionId) {
      return res.status(200).send("no transaction id");
    }

    // 🔥 CALL DATAHUB (TEST FIRST)
    const response = await fetch(
      "https://app.datahubgh.com/api/external/data-purchase",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.DATAHUB_API_KEY!,
        },
        body: JSON.stringify({
          networkKey: "YELLO",
          recipient: "0201234567",
          capacity: "1",
        }),
      }
    );

    const result = await response.json();

    console.log("📥 DATAHUB RESPONSE:", result);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ WEBHOOK ERROR:", err.message);
    return res.status(500).send("error");
  }
}
