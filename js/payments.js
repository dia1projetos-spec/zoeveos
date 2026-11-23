// js/payments.js
// Medios de pago configurables desde el panel (Configuración → Medios de pago).
// Cada medio tiene un tipo:
//   "transferencia" → usa el "precio por transferencia" de cada producto (si lo tiene)
//   "sin_recargo"   → paga el precio normal
//   "fijo"          → precio normal + un recargo fijo en pesos (una sola vez por pedido)
//   "porcentaje"    → precio normal + un recargo en % sobre el total del pedido
import { db, doc, getDoc } from "./firebase-config.js";

let cached = null;

export async function loadMetodosPago() {
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, "config", "site"));
    const list = snap.exists() ? snap.data().metodosPago : null;
    cached = Array.isArray(list) ? list.filter((m) => m && m.nombre) : [];
  } catch (e) {
    console.warn("No se pudieron cargar los medios de pago:", e);
    cached = [];
  }
  return cached;
}

// Precio unitario de un item del carrito según el medio de pago elegido.
export function unitPrice(item, metodo) {
  if (metodo && metodo.tipo === "transferencia" && Number(item.precioTransferencia) > 0) {
    return Number(item.precioTransferencia);
  }
  return Number(item.precio) || 0;
}

export function recargoFor(metodo, baseTotal) {
  if (!metodo) return 0;
  const v = Number(metodo.valor) || 0;
  if (metodo.tipo === "fijo") return Math.round(v);
  if (metodo.tipo === "porcentaje") return Math.round(baseTotal * (v / 100));
  return 0;
}

export function describeMetodo(m) {
  const v = Number(m.valor) || 0;
  if (m.tipo === "transferencia") return "Precio especial por transferencia";
  if (m.tipo === "fijo" && v > 0) return `Recargo de $${v.toLocaleString("es-AR")}`;
  if (m.tipo === "porcentaje" && v > 0) return `Recargo del ${v}%`;
  return "Precio normal";
}
