import axios from 'axios';

export default async function handler(req: any, res: any) {
  try {
    const response = await axios.get("https://app.datahubgh.com/api/external/status", {
      timeout: 10000,
      validateStatus: () => true
    });

    const data = response.data;
    const isOnline = response.status === 200 && (
      data?.status === "operational" || 
      data?.status === "ok" || 
      data?.services?.api === "healthy"
    );

    return res.status(200).json({ online: isOnline, data });
  } catch (err: any) {
    return res.status(200).json({ online: false, error: err.message });
  }
}
