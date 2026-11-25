// api/icon.js — Ícono de la app generado a partir del logo cargado en el panel (Configuración).
// /api/icon?size=192|512|180|32  (&maskable=1 deja más margen para íconos adaptables de Android)
const { getSiteConfig } = require("./_lib");

module.exports = async (req, res) => {
  const size = Math.min(1024, Math.max(16, parseInt(req.query.size, 10) || 192));
  const maskable = req.query.maskable === "1";
  const fallback = () => {
    const f = size <= 32 ? "favicon-32.png" : size <= 180 ? "apple-touch-icon.png" : size <= 192 ? "icon-192.png" : maskable ? "icon-maskable-512.png" : "icon-512.png";
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.redirect(302, "/icons/" + f);
  };
  try {
    const cfg = await getSiteConfig();
    const logo = cfg.logoUrl;
    if (!logo || !logo.includes("/upload/")) return fallback();
    const inner = Math.round(size * (maskable ? 0.58 : 0.8));
    const t = `c_fit,w_${inner},h_${inner}/c_pad,w_${size},h_${size},b_rgb:FAF6EF/f_png`;
    const url = logo.replace("/upload/", `/upload/${t}/`);
    const img = await fetch(url);
    if (!img.ok) return fallback();
    const buf = Buffer.from(await img.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(buf);
  } catch (e) {
    fallback();
  }
};
