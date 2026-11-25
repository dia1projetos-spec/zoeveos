// api/manifest.js — Manifest de la app con el logo del sitio como ícono.
const { getSiteConfig, SITE_NAME } = require("./_lib");

module.exports = async (req, res) => {
  const cfg = await getSiteConfig().catch(() => ({}));
  const hasLogo = !!cfg.logoUrl;
  const icon = (size, purpose, extra = "") => ({
    src: `/api/icon?size=${size}${extra}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  const manifest = {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Diseños exclusivos para el hogar y para cada etapa de la maternidad.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es-AR",
    background_color: "#faf6ef",
    theme_color: "#faf6ef",
    icons: [icon(192, "any"), icon(512, "any"), icon(512, "maskable", "&maskable=1")],
  };
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(JSON.stringify(manifest));
};
