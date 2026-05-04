import axios from 'axios';
import { getDataHubConfig } from '../../src/lib/server-utils';

export default async function handler(req: any, res: any) {
  const { apiKey, baseUrl } = await getDataHubConfig();
  if (!apiKey) return res.status(401).json({ error: "API key not set" });

  try {
    const parentUrl = baseUrl.replace(/\/external$/, "");
    const baseApiUrl = baseUrl.replace(/\/api\/external$/, "/api");
    
    const endpoints = [
      `${baseUrl}/user`,
      `${baseUrl}/balance`,
      `${parentUrl}/user`,
      `${baseUrl}/fetch-user`,
      `${baseApiUrl}/user`,
      "https://app.datahubgh.com/api/external/user"
    ];

    for (const url of endpoints) {
      try {
        const resp = await axios.get(url, {
          headers: { 'X-API-Key': apiKey },
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        
        if (resp.status === 200 && resp.data) {
          let balance = 0;
          const d = resp.data;
          if (d.wallet_balance !== undefined) balance = Number(d.wallet_balance);
          else if (d.balance !== undefined) balance = Number(d.balance);
          else if (d.user?.wallet_balance !== undefined) balance = Number(d.user.wallet_balance);
          
          return res.json({ balance, url }); 
        }
      } catch (err) {}
    }
    
    return res.status(200).json({ balance: 0, error: "Could not fetch balance" });
  } catch (err: any) {
    return res.status(200).json({ balance: 0, error: err.message });
  }
}
