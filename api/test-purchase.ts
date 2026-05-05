export default async function handler(req: any, res: any) {
  try {
    const response = await fetch("https://app.datahubgh.com/api/external/data-purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.DATAHUB_API_KEY || "",
      },
      body: JSON.stringify({
        networkKey: "YELLO",          // MTN
        recipient: "0240000000",      // use your real test number or check logs
        capacity: "1"                 // 1GB
      }),
    });

    const text = await response.text();
    console.log("🚀 [Direct Test] Status:", response.status);
    console.log("🚀 [Direct Test] Body:", text);

    return res.status(200).json({
      status: response.status,
      response: text,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("💥 [Direct Test] Error:", err.message);
    return res.status(500).json({
      error: err.message
    });
  }
}
