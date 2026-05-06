export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://app.datahubgh.com/api/external/data-purchase",
      {
        method: "POST",
        headers: {
          "X-API-Key": process.env.DATAHUB_API_KEY || '',
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          networkKey: "YELLO",
          recipient: "0240000000",
          capacity: "1"
        })
      }
    );

    const text = await response.text();

    return res.status(200).json({
      ok: response.ok,
      providerStatus: response.status,
      providerResponse: text
    });

  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
