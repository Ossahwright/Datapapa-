import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
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
  } catch (err) {
    console.error("❌ SMS ERROR:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ HANDLE BROWSER TEST
    if (req.method === "GET") {
      return res.status(200).send("Webhook is live ✅");
    }

    console.log("🔥 WEBHOOK RECEIVED");
    
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      console.error("❌ Missing PAYSTACK_SECRET_KEY");
      return res.status(200).send("env missing");
    }

    // ✅ SIGNATURE VERIFICATION
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      console.error("❌ Invalid signature mismatch");
      // In production we should return 401, but lead requested 200 safe exit patterns for some cases
      return res.status(401).send("invalid signature");
    }

    const event = req.body || {};
    console.log("📢 EVENT:", event?.event);

    if (event.event !== "charge.success") {
      return res.status(200).send("ignored");
    }

    // ✅ PAYMENT CONFIRMED
    const paystackReference = event.data?.reference;

    // ✅ EXTRA IDEMPOTENCY CHECK (By Receipt)
    const { data: duplicate } = await supabase
      .from("transactions")
      .select("id, vtu_status")
      .eq("paystack_receipt", paystackReference)
      .maybeSingle();

    if (duplicate && duplicate.vtu_status === "success") {
      console.log("⚠️ Receipt already processed successfully");
      return res.status(200).send("already processed");
    }

    let metadata = event.data?.metadata;
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

    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("❌ Missing Supabase env");
      return res.status(200).send("env missing");
    }

    // 🔥 FETCH TRANSACTION
    const { data: transaction, error: fetchErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchErr || !transaction) {
      console.error("❌ Transaction not found", fetchErr);
      return res.status(200).send("transaction not found");
    }

    // ✅ UPDATE STATUS TO PAID
    await supabase
      .from("transactions")
      .update({
        paystack_receipt: paystackReference,
        status: "paid",
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);

    // ✅ IDEMPOTENCY CHECK
    if (transaction.vtu_status === "success") {
      console.log("⚠️ Already processed success");
      return res.status(200).send("already processed");
    }

    // ✅ VALIDATE DATA
    if (
      !transaction.datahub_network_key ||
      !transaction.datahub_capacity ||
      !transaction.recipient_phone
    ) {
      console.error("❌ Invalid transaction data");
      await supabase.from("transactions").update({
        vtu_status: "failed",
      }).eq("id", transaction.id);
      return res.status(200).send("invalid data");
    }

    console.log("🚀 CALLING DATAHUB");

    // ✅ MARK PROCESSING
    await supabase
      .from("transactions")
      .update({ vtu_status: "processing" })
      .eq("id", transaction.id);

    const payload = {
      networkKey: transaction.datahub_network_key,
      recipient: transaction.recipient_phone,
      capacity: transaction.datahub_capacity.toString().replace("GB", ""),
    };

    console.log("📤 REQUEST:", payload);

    const datahubApiKey = process.env.DATAHUB_API_KEY;
    if (!datahubApiKey) {
      console.error("❌ DATAHUB_API_KEY not set");
    }

    const callDataHub = async () => {
      try {
        const resp = await fetch(
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
        return await resp.json();
      } catch (err) {
        console.error("❌ Network error:", err);
        return null;
      }
    };

    let result: any = await callDataHub();
    console.log("📥 RESPONSE:", JSON.stringify(result, null, 2));

    // ✅ RETRY LOGIC
    if (!result?.success && (result?.status !== 'SUCCESSFUL' && result?.status !== 'PROCESSING')) {
      console.log("🔁 Retrying DataHub...");
      await new Promise(r => setTimeout(r, 3000));
      result = await callDataHub();
      console.log("📥 RESPONSE:", JSON.stringify(result, null, 2));
    }

    if (result?.success || result?.status === 'SUCCESSFUL' || result?.status === 'PROCESSING') {
      await supabase.from("transactions").update({
        vtu_status: "success",
        status: "completed",
        api_response: result,
        paystack_receipt: paystackReference,
        updated_at: new Date().toISOString(),
      }).eq("id", transaction.id);

      console.log("✅ VTU SUCCESS");

      // ✅ NOTIFY CUSTOMER
      const msg = `Datapapa ✅
Your ${transaction.capacity} ${transaction.network} data has been delivered to ${transaction.recipient_phone}.
Ref: ${transaction.id}`;
      await sendSMS(transaction.recipient_phone, msg);

      // ✅ NOTIFY ADMIN
      await sendSMS(
        process.env.ADMIN_PHONE || "",
        `💰 NEW VTU
${transaction.network} ${transaction.capacity}
To: ${transaction.recipient_phone}
₵${transaction.amount}`
      );
    } else {
      console.error("❌ DataHub Error:", result?.error || result?.message);
      await supabase.from("transactions").update({
        vtu_status: "failed",
        status: "failed",
        api_response: result,
        paystack_receipt: paystackReference,
        updated_at: new Date().toISOString(),
      }).eq("id", transaction.id);

      console.error("❌ VTU FAILED");

      // ✅ NOTIFY ADMIN OF FAILURE
      await sendSMS(
        process.env.ADMIN_PHONE || "",
        `⚠️ VTU FAILED
${transaction.recipient_phone}
Ref: ${transaction.id}`
      );
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("❌ ERROR:", err?.message || err);
    return res.status(200).send("safe exit");
  }
}
