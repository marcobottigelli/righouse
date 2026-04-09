// netlify/functions/shopify-proxy.js
// Proxy per Shopify Admin API — necessario perché il browser non può chiamare
// l'API direttamente (CORS bloccato da Shopify).
// Body: { shop, token, product }

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  let shop, token, product
  try {
    ;({ shop, token, product } = JSON.parse(event.body))
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  if (!shop || !token || !product) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing shop, token or product' }) }
  }

  try {
    const url = `https://${shop}/admin/api/2024-01/products.json`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product }),
    })

    const data = await resp.json()
    return {
      statusCode: resp.status,
      headers,
      body: JSON.stringify(data),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
