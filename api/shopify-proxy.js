// api/shopify-proxy.js — Vercel Serverless Function
// Proxy per Shopify Admin API (CORS bloccato dal browser).
// Body: { shop, token, action?, product?, shopify_id? }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { shop, token, action = 'create', product, shopify_id } = req.body

  if (!shop || !token) return res.status(400).json({ error: 'Missing shop or token' })

  try {
    if (action === 'delete') {
      if (!shopify_id) return res.status(400).json({ error: 'Missing shopify_id' })
      const r = await fetch(`https://${shop}/admin/api/2024-01/products/${shopify_id}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': token },
      })
      return res.status(r.status).json({ ok: r.ok, status: r.status })
    }

    if (!product) return res.status(400).json({ error: 'Missing product' })
    const r = await fetch(`https://${shop}/admin/api/2024-01/products.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    })
    const data = await r.json()
    return res.status(r.status).json(data)

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
