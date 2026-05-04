export default async function handler(req: any, res: any) {
  res.status(200).json({ 
    status: "ok", 
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
}
