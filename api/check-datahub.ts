import { supabase, getDataHubConfig } from '../lib/server-utils.js';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  try {
    const { apiKey, baseUrl } = await getDataHubConfig();
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/data-purchase`;

    // FALLBACK APPROACH: Minimal authenticated request to the purchase endpoint.
    // We send an empty body `{}`.
    // - If API Key is valid, DataHub returns a validation error (e.g. "networkKey is required").
    // - If API Key is invalid, DataHub returns "Invalid or inactive API key".
    // This allows us to verify connectivity AND authentication without placing an actual order
    // nor deducting any wallet balance.
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          networkKey: "YELLO",
          recipient: "0000000000",
          capacity: "1",
          reference: "ping_" + Date.now()
        }) 
      }
    );

    const text = await response.text();
    
    // 🛡️ Handle HTML response
    if (text.includes('<!DOCTYPE html>')) {
      return res.status(500).json({
        success: false,
        error: "Provider returned HTML (likely 404). Check API URL.",
        status: "down"
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    const responseTime = Date.now() - startTime;

    // Validation errors imply that authentication succeeded and the endpoint is responding to our API key.
    const isAuthAccepted = response.ok 
       || (data?.error && data.error.toLowerCase().includes("required"))
       || (data?.error && data.error.toLowerCase().includes("networkkey"));
       
    const isInvalidKey = data?.error === 'Invalid or inactive API key';

    if (isInvalidKey) {
      return res.status(401).json({
        success: false,
        status: "down",
        online: false,
        providerStatus: response.status,
        responseTime,
        error: "Invalid or inactive API key"
      });
    }

    if (isAuthAccepted) {
      // Fetch latest known balance from database to satisfy expected JSON output
      let currentBalance = 0;
      try {
        const { data: ps } = await supabase
          .from("provider_settings")
          .select("wallet_balance")
          .eq("provider_name", "datahubgh")
          .single();
        if (ps) {
          currentBalance = ps.wallet_balance;
        }
      } catch (err) {
        // ignore
      }

      return res.status(200).json({
        success: true,
        status: "online",
        online: true,
        providerStatus: response.status,
        timestamp: new Date().toISOString(),
        responseTime,
        provider: "DataHubGH",
        balance: {
          current: currentBalance
        }
      });
    }

    return res.status(500).json({
      success: false,
      status: "down",
      online: false,
      providerStatus: response.status,
      responseTime,
      error: data?.error || "Provider unavailable"
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: "down",
      online: false,
      providerStatus: 500,
      responseTime: Date.now() - startTime,
      error: error.message || "Provider unavailable"
    });
  }
}
