export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { network, phone, plan } = req.body || {};
    
    if (!network || !phone || !plan) {
       return res.status(400).json({ 
         error: "Missing required fields", 
         received: req.body,
         expected: { network: "MTN", phone: "024xxxxxxx", plan: "1GB" }
       });
    }

    // MAPPINGS
    const networkMapping: Record<string, string> = {
      "MTN": "YELLO",
      "TELECEL": "TELECEL",
      "AIRTELTIGO": "AT"
    };

    const planMapping: Record<string, string> = {
      "1GB": "1",
      "2GB": "2",
      "5GB": "5"
    };

    const networkKey = networkMapping[network.toUpperCase()] || network;
    const capacity = planMapping[plan.toUpperCase()] || plan.replace("GB", "");

    console.log(`[TEST] DataHub Purchase: ${networkKey} | ${phone} | ${capacity}`);

    const apiKey = process.env.DATAHUB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "DATAHUB_API_KEY environment variable is missing" });
    }

    const response = await fetch("https://app.datahubgh.com/api/external/data-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey.trim(),
        "Accept": "application/json"
      },
      body: JSON.stringify({
        networkKey: networkKey,
        recipient: phone,
        capacity: capacity
      }),
    });

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }

    return res.status(200).json({
      http_status: response.status,
      ok: response.status >= 200 && response.status < 300,
      mapped: { networkKey, capacity },
      response: result
    });

  } catch (err: any) {
    console.error("[TEST] Purchase Error:", err.message);
    return res.status(500).json({
      error: err.message
    });
  }
}
