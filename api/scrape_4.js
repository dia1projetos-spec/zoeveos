import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';

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
    let html = '';
    // 1) tenta fetch simples
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      html = await r.text();
    } catch {}

    let $ = cheerio.load(html);
    let products = extractFromHtml($, url);

    // 2) se não achou nada, usa Playwright (para Tiendanube, Shopify com JS)
    if (products.length === 0) {
      const browser = await pw.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      html = await page.content();
      await browser.close();
      $ = cheerio.load(html);
      products = extractFromHtml($, url);
    }

    // 3) paginação simples para Tiendanube /productos?page=
    if (products.length < 20) {
      for (let p = 2; p <= 3; p++) {
        try {
          const pageUrl = url.includes('?') ? `${url}&page=${p}` : `${url}?page=${p}`;
          const r = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const h = await r.text();
          const $p = cheerio.load(h);
          const more = extractFromHtml($p, url);
          products = products.concat(more);
          if (more.length === 0) break;
        } catch {}
      }
    }

    // remove duplicados
    const seen = new Set();
    products = products.filter(p => {
      if (!p.name || seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });

    let limited = products.slice(0, 80);

    // upload Cloudinary
    const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (hasCloudinary) {
      await Promise.all(limited.map(async (p) => {
        if (!p.image) return;
        try {
          const imgUrl = new URL(p.image, url).href;
          const up = await cloudinary.uploader.upload(imgUrl, {
            folder: 'catalogos/zoeveos',
            transformation: [{ quality: 'auto', fetch_format: 'auto', width: 1200 }],
          });
          p.image = up.secure_url;
        } catch {}
      }));
    }

    return res.status(200).json({ url, count: limited.length, products: limited, cloudinary: hasCloudinary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function extractFromHtml($, baseUrl) {
  const products = [];

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        const graph = item['@graph'] || [item];
        graph.forEach(node => {
          if (node['@type'] === 'Product') {
            products.push({
              name: node.name,
              image: Array.isArray(node.image) ? node.image[0] : node.image,
              price: node.offers?.price ? `${node.offers.priceCurrency || '$'} ${node.offers.price}` : '',
              category: node.category || '',
              brand: node.brand?.name || '',
              url: baseUrl,
            });
          }
        });
      });
    } catch {}
  });

  // Tiendanube / Nuvemshop
  $('.js-item-product, .item-product, .product-item, .product').each((_, el) => {
    const name = $(el).find('.js-item-name, .product-name, h2, h3, .name').first().text().trim();
    const price = $(el).find('.js-price-display, .price, .product-price').first().text().trim().replace(/\s+/g, ' ');
    let image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
    if (image && image.startsWith('//')) image = 'https:' + image;
    const category = $(el).attr('data-category') || '';
    if (name) products.push({ name, price, image, category, brand: '', url: baseUrl });
  });

  return products;
}
