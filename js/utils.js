// js/utils.js

export function formatPrice(value) {
  const n = Number(value) || 0;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Províncias da Argentina, usadas no formulário de checkout e no cadastro de endereço.
export const PROVINCIAS_AR = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco",
  "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
  "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

// ---------- Precios (base, por variación y por transferencia) ----------
export function numPos(v) {
  const n = Number(v);
  return n > 0 ? n : null;
}

/**
 * Precio efectivo de un producto (o de una de sus variaciones).
 * - precio: precio normal.
 * - precioTransferencia: precio especial pagando por transferencia (null si no hay).
 * Si la variación tiene precio propio y no tiene precio de transferencia propio,
 * no hereda el de transferencia del producto (sería de otro importe).
 */
export function priceInfo(p, v = null) {
  const base = v && numPos(v.precio) ? numPos(v.precio) : Number(p.precio) || 0;
  let transf;
  if (v) transf = numPos(v.precioTransferencia) || (numPos(v.precio) ? null : numPos(p.precioTransferencia));
  else transf = numPos(p.precioTransferencia);
  return { precio: base, precioTransferencia: transf };
}
