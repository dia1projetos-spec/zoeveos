// api/landing.js — Landing page de producto renderizada en el servidor (HTML completo para Google e IAs).
// Se sirve en /p/:slug (ver rewrites en vercel.json).
const { SITE_URL, SITE_NAME, getDocument, queryCollection, getSiteConfig, esc, cld, cldCover, money, truncate } = require("./_lib");

function paragraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const m = lines[0].match(/^#{1,3}\s+(.*)$/);
      if (m) {
        const rest = lines.slice(1).join(" ").trim();
        return `<h2>${esc(m[1].trim())}</h2>${rest ? `<p>${esc(rest)}</p>` : ""}`;
      }
      return `<p>${esc(lines.join(" "))}</p>`;
    })
    .join("\n");
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

function availabilityOf(p) {
  if (p.vendido) return "https://schema.org/SoldOut";
  if (p.porEncargo) return "https://schema.org/PreOrder";
  const stock = (Number(p.stock) || 0) + (p.variantes || []).reduce((a, v) => a + (Number(v.stock) || 0), 0);
  return stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}
const availabilityText = (a) =>
  ({ "https://schema.org/SoldOut": "Vendido", "https://schema.org/PreOrder": "Por encargo", "https://schema.org/InStock": "Disponible", "https://schema.org/OutOfStock": "Sin stock" }[a]);

function notFound(res) {
  res.status(404);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60");
  res.send(`<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Página no encontrada | ${SITE_NAME}</title><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/landing.css"></head><body><main class="lp-main"><h1>Página no encontrada</h1><p>Esta página no existe o ya no está disponible.</p><p><a class="lp-btn" href="/">Ir a la tienda</a></p></main></body></html>`);
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!slug) return notFound(res);

  let product;
  try {
    const found = await queryCollection("productos", [{ field: "landingSlug", value: slug }], 1);
    product = found[0];
  } catch (e) {
    res.status(502).setHeader("Cache-Control", "no-store");
    return res.send("Servicio temporalmente no disponible");
  }
  if (!product || product.landingSlug !== slug || !product.landingActiva || product.activo === false) return notFound(res);

  const p = product;
  const L = p.landing || {};
  const cfg = await getSiteConfig();
  const [sub, cat, relatedAll] = await Promise.all([
    p.subcategoriaId ? getDocument("subcategorias/" + p.subcategoriaId).catch(() => null) : null,
    p.categoriaId ? getDocument("categorias/" + p.categoriaId).catch(() => null) : null,
    p.subcategoriaId ? queryCollection("productos", [{ field: "subcategoriaId", value: p.subcategoriaId }], 30).catch(() => []) : [],
  ]);

  const url = `${SITE_URL}/p/${p.landingSlug}`;
  const images = (p.images || []).filter(Boolean);
  const title = L.seoTitle || `${p.nombre} | ${SITE_NAME}`;
  const description = truncate(L.seoDescription || p.descripcion || `${p.nombre} en ${SITE_NAME}. Envíos a todo el país.`, 160);
  const h1 = L.h1 || p.nombre;
  const ogImage = images[0] ? cldCover(images[0], 1200, 630) : "";
  const availability = availabilityOf(p);
  const prices = [Number(p.precio) || 0, ...(p.variantes || []).map((v) => Number(v.precio) || 0).filter((x) => x > 0)];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const faqs = (L.faqs || []).filter((f) => f && f.q && f.a);
  const beneficios = (L.beneficios || []).filter(Boolean);
  const related = relatedAll.filter((r) => r.id !== p.id && r.landingActiva && r.landingSlug && r.activo !== false).slice(0, 6);
  const wa = String(cfg.whatsappNumber || "").replace(/\D/g, "");
  const waLink = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(`¡Hola! Me interesa: ${p.nombre}${p.codigo ? " (Cód: " + p.codigo + ")" : ""} ${url}`)}` : "";
  const buyLink = `/producto.html?id=${p.id}`;

  // ---------- Datos estructurados (Google + IAs) ----------
  const crumbs = [{ name: "Inicio", url: SITE_URL + "/" }];
  if (cat) crumbs.push({ name: cat.nombre, url: `${SITE_URL}/categoria.html?id=${cat.id}` });
  if (sub) crumbs.push({ name: sub.nombre, url: `${SITE_URL}/subcategoria.html?id=${sub.id}` });
  crumbs.push({ name: p.nombre, url });

  const offer = {
    "@type": "Offer",
    url,
    priceCurrency: "ARS",
    price: String(Number(p.precio) || 0),
    availability,
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: SITE_NAME },
  };
  const offers =
    high > low
      ? { "@type": "AggregateOffer", priceCurrency: "ARS", lowPrice: String(low), highPrice: String(high), offerCount: String(1 + (p.variantes || []).length), availability, url }
      : offer;

  const graph = [
    {
      "@type": "Organization",
      "@id": SITE_URL + "/#organization",
      name: SITE_NAME,
      url: SITE_URL + "/",
      logo: cfg.logoUrl ? cld(cfg.logoUrl, 512) : undefined,
    },
    { "@type": "WebSite", "@id": SITE_URL + "/#website", url: SITE_URL + "/", name: SITE_NAME, inLanguage: "es-AR", publisher: { "@id": SITE_URL + "/#organization" } },
    {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
    },
    {
      "@type": "Product",
      "@id": url + "#product",
      name: p.nombre,
      description: truncate(L.intro || p.descripcion || description, 500),
      image: images.map((i) => cld(i, 1200)),
      sku: p.codigo || p.id,
      mpn: p.codigo || undefined,
      brand: { "@type": "Brand", name: SITE_NAME },
      category: [cat && cat.nombre, sub && sub.nombre].filter(Boolean).join(" > ") || undefined,
      keywords: L.keywords || undefined,
      url,
      offers,
    },
  ];
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  graph.push({ "@type": "WebPage", "@id": url, url, name: title, description, inLanguage: "es-AR", isPartOf: { "@id": SITE_URL + "/#website" }, primaryImageOfPage: ogImage ? { "@type": "ImageObject", url: ogImage } : undefined, breadcrumb: { "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })) }, dateModified: p._updateTime });

  const priceHtml =
    high > low
      ? `Desde <strong>${money(low)}</strong>`
      : `<strong>${money(p.precio)}</strong>`;

  const html = `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${L.keywords ? `<meta name="keywords" content="${esc(L.keywords)}">` : ""}
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="es-AR" href="${esc(url)}">
<link rel="alternate" hreflang="x-default" href="${esc(url)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="author" content="${esc(SITE_NAME)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}"><meta property="og:image:alt" content="${esc(p.nombre)}">` : ""}
<meta property="product:price:amount" content="${Number(p.precio) || 0}">
<meta property="product:price:currency" content="ARS">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}
<meta name="google-site-verification" content="BYMNfA_rqkTLMFft4u-P8ko_mnDU1vcFyelOSOb1ZEA" />
<meta name="theme-color" content="#faf6ef">
<link rel="manifest" href="/api/manifest">
<link rel="icon" type="image/png" sizes="32x32" href="/api/icon?size=32">
<link rel="apple-touch-icon" href="/api/icon?size=180">
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
${images[0] ? `<link rel="preload" as="image" href="${esc(cld(images[0], 900))}">` : ""}
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/css/landing.css">
${jsonLd({ "@context": "https://schema.org", "@graph": graph })}
</head>
<body class="lp-body">
<header class="lp-header">
  <a class="lp-logo" href="/" aria-label="${esc(SITE_NAME)} - Inicio">${cfg.logoUrl ? `<img src="${esc(cld(cfg.logoUrl, 240))}" alt="${esc(SITE_NAME)}" height="48">` : `<span>${esc(SITE_NAME)}</span>`}</a>
  <nav class="lp-nav" aria-label="Principal"><a href="/">Tienda</a><a href="/blog.html">Blog</a><a href="${buyLink}" class="lp-nav-cta">Comprar</a></nav>
</header>

<main class="lp-main">
  <nav class="lp-breadcrumb" aria-label="Migas de pan">
    ${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${esc(c.url.replace(SITE_URL, ""))}">${esc(c.name)}</a><span aria-hidden="true">›</span>` : `<span aria-current="page">${esc(c.name)}</span>`)).join("")}
  </nav>

  <article class="lp-product" itemscope itemtype="https://schema.org/Product">
    <div class="lp-gallery ${p.vendido ? "is-sold" : ""}">
      ${images
        .map(
          (img, i) => `<img src="${esc(cld(img, 900))}" srcset="${esc(cld(img, 480))} 480w, ${esc(cld(img, 900))} 900w, ${esc(cld(img, 1400))} 1400w" sizes="(max-width: 800px) 100vw, 560px" alt="${esc(p.nombre)}${images.length > 1 ? " - foto " + (i + 1) : ""}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="900" height="900" class="${i === 0 ? "lp-img-main" : "lp-img-thumb"}">`
        )
        .join("")}
    </div>

    <div class="lp-info">
      <h1 itemprop="name">${esc(h1)}</h1>
      <p class="lp-price">${priceHtml} <span class="lp-currency">ARS</span></p>
      ${p.precioTransferencia ? `<p class="lp-transf">Pagando por transferencia: <strong>${money(p.precioTransferencia)}</strong></p>` : ""}
      <p class="lp-availability">${esc(availabilityText(availability))}${p.codigo ? ` · Código ${esc(p.codigo)}` : ""}</p>
      ${L.intro ? `<p class="lp-intro">${esc(L.intro)}</p>` : p.descripcion ? `<p class="lp-intro">${esc(p.descripcion)}</p>` : ""}
      ${p.vendido ? `<p class="lp-btn lp-btn-disabled">Vendido</p>` : `<p class="lp-actions"><a class="lp-btn" href="${buyLink}">${p.porEncargo ? "Consultar y encargar" : "Comprar ahora"}</a>${waLink ? `<a class="lp-btn lp-btn-wa" href="${esc(waLink)}" rel="noopener">Consultar por WhatsApp</a>` : ""}</p>`}
      <ul class="lp-trust"><li>Envíos a todo el país</li><li>Pagá por transferencia u otros medios</li><li>Atención personalizada</li></ul>
    </div>
  </article>

  ${beneficios.length ? `<section class="lp-section"><h2>Características y beneficios</h2><ul class="lp-benefits">${beneficios.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>` : ""}

  ${(p.variantes || []).length ? `<section class="lp-section"><h2>Opciones disponibles</h2><ul class="lp-variants">${p.variantes.map((v) => `<li>${v.imagen ? `<img src="${esc(cld(v.imagen, 160))}" alt="${esc(p.nombre + " - " + v.nombre)}" width="80" height="80" loading="lazy">` : ""}<span>${esc(v.nombre)}${Number(v.precio) > 0 ? ` — ${money(v.precio)}` : ""}</span></li>`).join("")}</ul></section>` : ""}

  ${L.contenido ? `<section class="lp-section lp-content">${paragraphs(L.contenido)}</section>` : ""}

  ${faqs.length ? `<section class="lp-section"><h2>Preguntas frecuentes</h2>${faqs.map((f) => `<div class="lp-faq"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("")}</section>` : ""}

  ${related.length ? `<section class="lp-section"><h2>También te puede interesar</h2><ul class="lp-related">${related.map((r) => `<li><a href="/p/${esc(r.landingSlug)}">${(r.images || [])[0] ? `<img src="${esc(cld(r.images[0], 400))}" alt="${esc(r.nombre)}" width="400" height="400" loading="lazy">` : ""}<span>${esc(r.nombre)}</span><strong>${money(r.precio)}</strong></a></li>`).join("")}</ul></section>` : ""}
</main>

<footer class="lp-footer">
  <p><strong>${esc(SITE_NAME)}</strong> · Diseños exclusivos para el hogar y la maternidad. Envíos a todo el país.</p>
  <p><a href="/">Ver toda la tienda</a> · <a href="/blog.html">Blog</a></p>
</footer>
<script type="module" src="/js/pwa.js"></script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(html);
};
