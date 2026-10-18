export default async function handler(req, res) {
  const { address } = req.query;
  const target = address || "0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a";
  const apiKey = process.env.ETHERSCAN_API_KEY || "PMEHZSC3FV9KFMGPINSRQIABKXTMVX29T5";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");

  try {
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${target}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
