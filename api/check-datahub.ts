import { callDataHubAPI } from '../lib/datahub-client.js';

export default async function handler(req: any, res: any) {
  try {
    const result = await callDataHubAPI("balance", { method: 'GET' });

    return res.json({
      status: result.success ? "healthy" : "down",
      online: result.success,
      timestamp: new Date().toISOString(),
      data: result.data || {}
    });
  } catch (err: any) {
     return res.status(200).json({ status: "down", online: false, error: err.message });
  }
}
