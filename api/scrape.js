import * as cheerio from 'cheerio';
import { v2 as cloudinary } from 'cloudinary';
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';

cloudinary.config({
  cloud_name: 'mediaflows_053746fa-770e-4e95-9be6-36aa65cadb4c',
  api_key: '967988277885785',
  api_secret: 'y0EuP1sq57vUaFmu6-cxWG-u7ek',
  secure: true,
});

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL' });
  try {
    const browser = await pw.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    await browser.close();
    const $ = cheerio.load(html);
    let products = [];
    $('.product,.product-item,[class*="product"],article').each((_,el)=>{
      const name=$(el).find('h2,h3,.title').first().text().trim();
      const price=$(el).find('.price,.amount').first().text().trim();
      let img=$(el).find('img').attr('src')||$(el).find('img').attr('data-src');
      if(img?.startsWith('//')) img='https:'+img;
      if(name) products.push({name,price,image:img});
    });
    products=products.slice(0,30);
    await Promise.all(products.slice(0,20).map(async p=>{
      if(!p.image) return;
      try{ const u=await cloudinary.uploader.upload(p.image,{folder:'catalogos'}); p.image=u.secure_url; }catch{}
    }));
    res.json({count:products.length,products});
  } catch(e){ res.status(500).json({error:e.message}); }
}
