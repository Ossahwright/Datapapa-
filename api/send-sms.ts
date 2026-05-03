export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      return res.status(200).send("SMS endpoint live ✅");
    }

    console.log("🔥 SMS ENDPOINT HIT");

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(200).send("safe exit");
  }
}
