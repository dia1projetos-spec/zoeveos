// api/sitemap.js — sitemap.xml dinámico (landings, categorías, subcategorías y artículos del blog).
const { SITE_URL, queryCollection, esc } = require("./_lib");

const day = (iso) => (iso ? String(iso).slice(0, 10) : undefined);

module.exports = async (req, res) => {
  const urls = [{ loc: SITE_URL + "/", priority: "1.0", changefreq: "weekly" }, { loc: SITE_URL + "/blog.html", priority: "0.6", changefreq: "weekly" }];
  const safe = (promise) => promise.catch(() => []);
  const [landings, cats, subs, blog] = await Promise.all([
    safe(queryCollection("productos", [{ field: "landingActiva", value: true }], 1000)),
    safe(queryCollection("categorias", [], 500)),
    safe(queryCollection("subcategorias", [], 1000)),
    safe(queryCollection("blog", [], 500)),
  ]);
  cats.forEach((c) => urls.push({ loc: `${SITE_URL}/categoria.html?id=${c.id}`, lastmod: day(c._updateTime), priority: "0.7", changefreq: "weekly" }));
  subs.forEach((s) => urls.push({ loc: `${SITE_URL}/subcategoria.html?id=${s.id}`, lastmod: day(s._updateTime), priority: "0.7", changefreq: "weekly" }));
  landings
    .filter((p) => p.activo !== false && p.landingSlug)
    .forEach((p) => urls.push({ loc: `${SITE_URL}/p/${p.landingSlug}`, lastmod: day(p._updateTime), priority: "0.9", changefreq: "weekly" }));
  blog
    .filter((b) => b.slug && b.activo !== false && b.publicado !== false)
    .forEach((b) => urls.push({ loc: `${SITE_URL}/blog-post.html?slug=${encodeURIComponent(b.slug)}`, lastmod: day(b._updateTime), priority: "0.7", changefreq: "monthly" }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
  .join("\n")}
</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  res.status(200).send(xml);
};
