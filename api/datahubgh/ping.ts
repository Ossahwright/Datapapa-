import axios from 'axios';

export default async function handler(req: any, res: any) {
  const start = Date.now();
  try {
    const resp = await axios.get("https://app.datahubgh.com/api/external/status", {
      timeout: 5000,
      validateStatus: () => true
    });
    
    const duration = Date.now() - start;
    const isOnline = resp.status === 200;
    
    return res.json({ 
      status: isOnline ? (duration < 2000 ? 'online' : 'degraded') : 'offline', 
      responseTime: duration,
      online: isOnline,
      data: resp.data
    });
  } catch (err: any) {
    return res.json({ 
      status: 'offline', 
      responseTime: Date.now() - start,
      online: false,
      error: err.message
    });
  }
}
