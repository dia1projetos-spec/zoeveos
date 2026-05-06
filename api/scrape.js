import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

    let limited = products.slice(0, 50); // limite para não estourar tempo do Vercel

    // 3) Upload para Cloudinary se configurado
    const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (hasCloudinary) {
      await Promise.all(limited.map(async (p) => {
        if (!p.image) return;
        try {
          // resolve URL relativa
          const imgUrl = new URL(p.image, url).href;
          const upload = await cloudinary.uploader.upload(imgUrl, {
            folder: 'catalogos',
            transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1000 }],
            overwrite: false,
            unique_filename: true,
          });
          p.image = upload.secure_url;
          p.cloudinary_id = upload.public_id;
        } catch (e) {
          // mantém URL original se falhar
        }
      }));
    }

    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ url, count: limited.length, products: limited, cloudinary: hasCloudinary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
