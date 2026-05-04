import axios from 'axios';

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.ARKESEL_API_KEY;
    if (!apiKey) return res.json({ balance: 0, error: "API Key missing" });

    const url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${apiKey}&response=json`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;
    
    const balance = data?.balance ?? data?.main_balance ?? 0;

    return res.status(200).json({ balance: Number(balance), raw: data });
  } catch (e: any) {
    return res.status(200).json({ balance: 0, error: e.message });
  }
}
