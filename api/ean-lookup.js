// api/ean-lookup.js — Vercel Function
// Proxy per EAN lookup — aggira CORS e prova più fonti in sequenza:
// 1. ean-search.org (europeo, richiede chiave gratuita)
// 2. go-upc.com (richiede chiave gratuita)
// 3. upcitemdb.com (US, no chiave)
// Body: { ean, ean_search_key?, go_upc_key? }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { ean, ean_search_key, go_upc_key } = req.body
  if (!ean) return res.status(400).json({ error: 'Missing ean' })

  // 1. ean-search.org
  if (ean_search_key) {
    try {
      const r = await fetch(
        `https://api.ean-search.org/api?token=${ean_search_key}&op=barcode-lookup&ean=${ean}&format=json`,
        { headers: { 'User-Agent': 'RigHouse/1.0' } }
      )
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data) && data.length && data[0].name) {
          const p = data[0]
          return res.json({
            source: 'ean-search',
            name: p.name || null,
            brand: null,
            category: p.categoryName || null,
            description: null,
            images: [],
          })
        }
      }
    } catch (e) {}
  }

  // 2. go-upc.com
  if (go_upc_key) {
    try {
      const r = await fetch(`https://api.go-upc.com/v1/code/${ean}`, {
        headers: { Authorization: `Bearer ${go_upc_key}` },
      })
      if (r.ok) {
        const data = await r.json()
        const p = data.product
        if (p && p.name) {
          return res.json({
            source: 'go-upc',
            name: p.name || null,
            brand: p.brand || null,
            category: p.category || null,
            description: p.description || null,
            images: p.imageUrl ? [p.imageUrl] : [],
          })
        }
      }
    } catch (e) {}
  }

  // 3. upcitemdb (US, no key)
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`)
    if (r.ok) {
      const data = await r.json()
      if (data.items && data.items.length) {
        const it = data.items[0]
        return res.json({
          source: 'upcitemdb',
          name: it.title || null,
          brand: it.brand || null,
          category: it.category || null,
          description: it.description || null,
          images: it.images || [],
        })
      }
    }
  } catch (e) {}

  return res.status(404).json({ error: 'not_found' })
}
