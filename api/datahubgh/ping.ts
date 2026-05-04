import axios from 'axios';
import { getDataHubConfig } from '../../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  const start = Date.now();
  const { baseUrl, apiKey } = await getDataHubConfig();
  
  try {
    const statusUrl = `${baseUrl}/status`;
    const resp = await axios.get(statusUrl, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    const duration = Date.now() - start;
    const isOnline = resp.status === 200;
    
    return res.json({ 
      status: isOnline ? (duration < 2500 ? 'online' : 'degraded') : 'offline', 
      responseTimeMs: duration,
      online: isOnline,
      httpStatus: resp.status,
      baseUrl: baseUrl,
      hasApiKey: !!apiKey,
      data: resp.data
    });
  } catch (err: any) {
    return res.json({ 
      status: 'offline', 
      responseTimeMs: Date.now() - start,
      online: false,
      baseUrl: baseUrl,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 2).join('\n')
    });
  }
}
