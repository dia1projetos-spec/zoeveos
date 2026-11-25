// api/llms.js — /llms.txt: resumen del sitio en texto plano pensado para asistentes de IA.
const { SITE_URL, SITE_NAME, queryCollection, getSiteConfig, truncate, money } = require("./_lib");

module.exports = async (req, res) => {
  const [landings, cfg] = await Promise.all([
    queryCollection("productos", [{ field: "landingActiva", value: true }], 1000).catch(() => []),
    getSiteConfig(),
  ]);
  const lines = [
    `# ${SITE_NAME}`,
    ``,
    `> Tienda online argentina de diseños exclusivos para el hogar y para cada etapa de la maternidad (ropa de cama, descanso, niditos, mantas y más). Envíos a todo el país. Los pedidos se coordinan por WhatsApp. Precios en pesos argentinos (ARS).`,
    ``,
    `## Información útil`,
    `- Sitio web: ${SITE_URL}/`,
    `- Idioma: español (Argentina)`,
    `- Medios de pago: transferencia (precio especial en algunos productos) y otros medios con recargo informado en el checkout`,
    cfg.whatsappNumber ? `- WhatsApp: +${String(cfg.whatsappNumber).replace(/\D/g, "")}` : ``,
    ``,
    `## Productos`,
    ...landings
      .filter((p) => p.activo !== false && p.landingSlug)
      .map((p) => `- [${p.nombre}](${SITE_URL}/p/${p.landingSlug}): ${truncate((p.landing && (p.landing.seoDescription || p.landing.intro)) || p.descripcion || "", 160)} (${money(p.precio)})`),
    ``,
    `## Más`,
    `- [Blog](${SITE_URL}/blog.html)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
  ].filter((l) => l !== undefined);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  res.status(200).send(lines.join("\n"));
};
