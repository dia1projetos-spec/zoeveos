// js/discounts.js
// Motor de descuentos automáticos, al estilo "Shopee": el sistema detecta cuándo el carrito
// cumple una condición (monto mínimo o cantidad mínima) y habilita un cupón que el cliente
// puede aplicar con un clic. También calcula el envío gratis a partir de un monto configurado.

import { db, collection, getDocs, doc, getDoc, query, where } from "./firebase-config.js";

let cachedDescuentos = null;
let cachedEnvioGratisMonto = null;

export async function loadDescuentos() {
  if (cachedDescuentos) return cachedDescuentos;
  try {
    const q = query(collection(db, "descuentos"), where("activo", "==", true));
    const snap = await getDocs(q);
    cachedDescuentos = [];
    snap.forEach((d) => cachedDescuentos.push({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("No se pudieron cargar los descuentos:", e);
    cachedDescuentos = [];
  }
  return cachedDescuentos;
}

export async function loadEnvioGratisMonto() {
  if (cachedEnvioGratisMonto !== null) return cachedEnvioGratisMonto;
  try {
    const snap = await getDoc(doc(db, "config", "site"));
    cachedEnvioGratisMonto = snap.exists() ? Number(snap.data().envioGratisMonto) || 0 : 0;
  } catch (e) {
    console.warn(e);
    cachedEnvioGratisMonto = 0;
  }
  return cachedEnvioGratisMonto;
}

// El id "limpio" del producto, sin el sufijo de variación (ver cart.js, ids tipo "prodId__varId").
function productIdOf(item) {
  return item.productoId || (item.id || "").split("__")[0];
}

function scopedItems(items, descuento) {
  if (descuento.alcance === "categoria") return items.filter((it) => (it.categoriaId || "") === descuento.alcanceId);
  if (descuento.alcance === "producto") return items.filter((it) => productIdOf(it) === descuento.alcanceId);
  return items; // "todos"
}

/**
 * Evalúa un descuento contra el carrito actual: si ya se cumple la condición,
 * cuánto falta si todavía no, y cuánto dinero descontaría si se aplica.
 */
export function evaluateDescuento(descuento, items) {
  const scoped = scopedItems(items, descuento);
  const subtotal = scoped.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const cantidad = scoped.reduce((s, it) => s + it.cantidad, 0);
  const valorActual = descuento.tipo === "cantidad" ? cantidad : subtotal;
  const elegible = scoped.length > 0 && valorActual >= descuento.umbral;
  const faltante = Math.max(0, Number(descuento.umbral) - valorActual);
  const montoDescuento = elegible ? Math.round(subtotal * (Number(descuento.porcentaje) / 100)) : 0;
  return { descuento, scopedSubtotal: subtotal, scopedCantidad: cantidad, valorActual, elegible, faltante, montoDescuento };
}

/**
 * Arma el resumen completo del carrito: subtotal, descuento aplicado (si corresponde
 * y sigue siendo válido), total final, estado del envío gratis, y la lista de evaluaciones
 * de todos los descuentos activos (para mostrar el progreso de cada uno).
 */
export async function getCartSummary(items, appliedDiscountId) {
  const descuentos = await loadDescuentos();
  const envioGratisMonto = await loadEnvioGratisMonto();
  const subtotal = items.reduce((s, it) => s + it.precio * it.cantidad, 0);

  const evaluaciones = descuentos.map((d) => evaluateDescuento(d, items));

  let appliedEval = null;
  if (appliedDiscountId) {
    appliedEval = evaluaciones.find((e) => e.descuento.id === appliedDiscountId && e.elegible) || null;
  }

  const discountAmount = appliedEval ? appliedEval.montoDescuento : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const envioGratis = envioGratisMonto > 0 && subtotal >= envioGratisMonto;
  const envioGratisFaltante = envioGratisMonto > 0 ? Math.max(0, envioGratisMonto - subtotal) : 0;

  return {
    subtotal,
    evaluaciones,
    appliedEval,
    discountAmount,
    total,
    envioGratisMonto,
    envioGratis,
    envioGratisFaltante,
  };
}

export function describeCondicion(descuento) {
  const alcanceTxt = descuento.alcance === "categoria" ? " en esa categoría" : descuento.alcance === "producto" ? " en ese producto" : "";
  if (descuento.tipo === "cantidad") {
    return `Llevando ${descuento.umbral} u. o más${alcanceTxt}`;
  }
  return `Con $${Number(descuento.umbral).toLocaleString("es-AR")} o más${alcanceTxt}`;
}
