import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ HANDLE BROWSER TEST
    if (req.method === "GET") {
      return res.status(200).send("Webhook is live ✅");
    }

    console.log("🔥 WEBHOOK RECEIVED");

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    
    // Verify Signature
    const hash = crypto
      .createHmac("sha512", paystackSecretKey || '')
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("❌ Invalid signature mismatch");
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).send("Invalid signature");
      }
    }

    const event = req.body || {};
    console.log("📢 EVENT:", event?.event);

    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    console.log("✅ PAYMENT CONFIRMED");

    let metadata = event.data.metadata;
    if (typeof metadata === "string") {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        console.error("❌ Metadata parse failed");
      }
    }

    const transactionId = metadata?.transaction_id;
    console.log("📌 TRANSACTION ID:", transactionId);

    if (!transactionId) {
      console.error("❌ No transaction ID found in metadata");
      return res.status(200).send("no transaction id");
    }

    // 🔥 FETCH TRANSACTION
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      console.error("❌ Transaction not found", fetchError);
      return res.status(200).send("transaction not found");
    }

    // IDEMPOTENCY CHECK
    if (transaction.vtu_status === "success") {
      console.log("⚠️ Already processed");
      return res.status(200).send("already processed");
    }

    console.log("🚀 CALLING DATAHUB");

    const payload = {
      networkKey: transaction.datahub_network_key || transaction.network_key || transaction.network,
      recipient: transaction.recipient_phone,
      capacity: transaction.datahub_capacity || transaction.capacity || "",
    };

    // Standardize capacity
    if (typeof payload.capacity === 'string') {
      payload.capacity = payload.capacity.toUpperCase().replace("GB", "").trim();
    }

    console.log("📤 PAYLOAD:", payload);

    const datahubApiKey = process.env.DATAHUB_API_KEY;
    if (!datahubApiKey) {
      console.error("❌ DATAHUB_API_KEY not set");
    }

    const resDH = await fetch(
      "https://app.datahubgh.com/api/external/data-purchase",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": datahubApiKey || "",
        },
        body: JSON.stringify(payload),
      }
    );

    const result: any = await resDH.json();
    console.log("📥 DATAHUB RESPONSE:", result);

    if (result?.success || result?.status === 'SUCCESSFUL' || result?.status === 'PROCESSING') {
      await supabase.from("transactions").update({
        vtu_status: "success",
        status: "completed",
        api_response: result,
        paystack_receipt: event.data.reference,
        updated_at: new Date().toISOString(),
      }).eq("id", transaction.id);

      console.log("✅ VTU SUCCESS");
    } else {
      await supabase.from("transactions").update({
        vtu_status: "failed",
        status: "failed",
        api_response: result,
        paystack_receipt: event.data.reference,
        updated_at: new Date().toISOString(),
      }).eq("id", transaction.id);

      console.error("❌ VTU FAILED");
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ WEBHOOK ERROR:", err.message || err);
    return res.status(200).send("safe exit");
  }
}
