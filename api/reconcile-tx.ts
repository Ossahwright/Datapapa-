import { reconcileTransaction, isAdminAuth } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isAuthorized = await isAdminAuth(req);
  if (!isAuthorized) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: "Missing transactionId" });
  }

  try {
    const result = await reconcileTransaction(transactionId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("❌ [API Reconcile] Fatal error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
