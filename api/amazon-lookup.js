// api/amazon-lookup.js — Vercel Serverless Function
// Cerca un EAN su Amazon.it e restituisce i campi prodotto principali.
// Body: { ean }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { ean } = req.body
  if (!ean) return res.status(400).json({ error: 'Missing ean' })

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }

  try {
    // 1. Cerca l'EAN su Amazon.it
    const searchUrl = `https://www.amazon.it/s?k=${encodeURIComponent(ean)}&i=aps`
    const searchResp = await fetch(searchUrl, { headers })
    if (!searchResp.ok) return res.status(502).json({ error: `amazon search HTTP ${searchResp.status}` })
    const searchHtml = await searchResp.text()

    // DEBUG: restituisce snippet HTML per capire la struttura della pagina
    const snippet = searchHtml.slice(0, 3000)
    return res.json({ debug: true, snippet, hasSr1: searchHtml.includes('ref=sr_1_1'), allDpLinks: [...searchHtml.matchAll(/\/dp\/([A-Z0-9]{10})\//g)].map(m=>m[1]).slice(0,10) })

    // 2. Apri la pagina prodotto
    const productUrl = `https://www.amazon.it/dp/${asin}`
    const productResp = await fetch(productUrl, { headers })
    if (!productResp.ok) return res.status(502).json({ error: `amazon product HTTP ${productResp.status}` })
    const html = await productResp.text()

    // ── Estrai titolo ──────────────────────────────────────────────────────
    const titleMatch = html.match(/id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/)
    const name = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null

    // ── Estrai brand ──────────────────────────────────────────────────────
    const brandMatch = html.match(/id="bylineInfo"[^>]*>[\s\S]*?(?:Marchio:|Brand:)?\s*<[^>]*>([^<]+)</)
      || html.match(/id="bylineInfo"[^>]*>\s*(?:Visita il negozio|Brand:)?\s*([A-Za-z0-9 &'.,-]+)/)
    let brand = brandMatch ? brandMatch[1].replace(/Visita il negozio/i,'').trim() : null
    if (brand && brand.length > 60) brand = null

    // ── Estrai immagine principale ─────────────────────────────────────────
    const imgMatch = html.match(/"hiRes"\s*:\s*"(https:[^"]+)"/)
      || html.match(/"large"\s*:\s*"(https:[^"]+\.jpg[^"]*)"/)
      || html.match(/id="landingImage"[^>]*src="([^"]+)"/)
    const image = imgMatch ? imgMatch[1] : null

    // ── Estrai descrizione breve ───────────────────────────────────────────
    const descMatch = html.match(/id="feature-bullets"[\s\S]*?<ul[\s\S]*?<\/ul>/)
    let description = null
    if (descMatch) {
      const bullets = [...descMatch[0].matchAll(/<span class="a-list-item">\s*([\s\S]*?)\s*<\/span>/g)]
        .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
        .filter(t => t.length > 5 && t.length < 300)
        .slice(0, 3)
      if (bullets.length) description = bullets.join(' • ')
    }

    if (!name) return res.status(404).json({ error: 'not_found' })

    return res.json({
      source: 'amazon',
      asin,
      name,
      brand,
      description,
      images: image ? [image] : [],
    })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
