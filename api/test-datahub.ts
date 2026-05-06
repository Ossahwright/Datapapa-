export default async function handler(req: any, res: any) {
  const apiKey = process.env.DATAHUB_API_KEY;
  const testUrls = [
    "https://app.datahubgh.com/api/external/user",
    "https://datahubgh.com/api/external/user",
    "https://datahubgh.com/api/user"
  ];

  const results = [];

  for (const url of testUrls) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": `${apiKey}`,
        },
      });

      const text = await response.text();
      results.push({
        url,
        status: response.status,
        isHtml: text.trim().toLowerCase().startsWith("<!doctype html>"),
        preview: text.substring(0, 100)
      });
    } catch (err: any) {
      results.push({
        url,
        error: err.message
      });
    }
  }

  return res.status(200).json({
    results,
    timestamp: new Date().toISOString()
  });
}
