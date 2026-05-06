import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const html = await response.text();
    const $ = cheerio.load(html);

    const products = [];
    const seen = new Set();

    // 1) JSON-LD schema.org
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).contents().text());
        const items = Array.isArray(data) ? data : [data];
        items.forEach(item => {
          const graph = item['@graph'] || [item];
          graph.forEach(node => {
            if (node['@type'] === 'Product') extractProduct(node);
            if (node['@type'] === 'ItemList' && node.itemListElement) {
              node.itemListElement.forEach(i => i.item && extractProduct(i.item));
            }
          });
        });
      } catch {}
    });

    function extractProduct(p) {
      const name = p.name;
      if (!name || seen.has(name)) return;
      seen.add(name);
      const image = Array.isArray(p.image) ? p.image[0] : p.image;
      const offers = p.offers || {};
      const price = offers.price ? `${offers.priceCurrency || 'R$'} ${offers.price}` : '';
      const category = p.category || '';
      const brand = p.brand?.name || p.brand || '';
      products.push({ name, image, price, category, brand, url });
    }

    // 2) Fallback OpenGraph
    if (products.length === 0) {
      $('.product, .product-item, [data-product]').each((_, el) => {
        const name = $(el).find('h2, h3, .name, .title').first().text().trim();
        const price = $(el).find('.price, .amount').first().text().trim();
        const image = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        if (name) products.push({ name, price, image, category: 'Geral', brand: '', url });
      });
    }

    // Limitar para demo
    const limited = products.slice(0, 200);

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ url, count: limited.length, products: limited });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
