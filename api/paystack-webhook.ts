export default async function handler(req, res) {
  console.log("WEBHOOK HIT SUCCESSFULLY");

  return res.status(200).json({
    success: true,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}
