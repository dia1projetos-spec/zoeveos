// js/checkout.js
import { db, doc, getDoc, collection, addDoc, serverTimestamp } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { getCart, getAppliedDiscountId, clearCart } from "./cart.js";
import { getCartSummary } from "./discounts.js";
import { formatPrice, PROVINCIAS_AR } from "./utils.js";

await initHeader();

const formSection = document.getElementById("checkoutForm");
const confirmSection = document.getElementById("checkoutConfirm");
const summaryEl = document.getElementById("orderSummary");
const regionSelect = document.getElementById("region");
const form = document.getElementById("dataForm");
const submitBtn = document.getElementById("submitBtn");

const items = getCart();
let cartSummary = null; // se completa en renderSummary()

if (items.length === 0) {
  formSection.innerHTML = `<div class="empty-state">Tu carrito está vacío. <a href="/index.html" style="color:var(--pink-dark);text-decoration:underline;">Volver a la tienda</a></div>`;
} else {
  renderSummary();
  fillRegions();
  form.addEventListener("submit", onSubmit);
}

async function renderSummary() {
  cartSummary = await getCartSummary(items, getAppliedDiscountId());
  const { subtotal, appliedEval, discountAmount, total, envioGratis, envioGratisMonto, envioGratisFaltante } = cartSummary;

  summaryEl.innerHTML = `
    ${items.map((it) => `<div class="row"><span>${it.cantidad} x ${it.nombre}</span><span>${formatPrice(it.precio * it.cantidad)}</span></div>`).join("")}
    ${
      appliedEval
        ? `<div class="row" style="color:var(--pink-dark);"><span>🏷️ ${appliedEval.descuento.nombre}</span><span>-${formatPrice(discountAmount)}</span></div>`
        : ""
    }
    <div class="row total-row"><strong>Total</strong><strong>${formatPrice(total)}</strong></div>
    ${
      envioGratisMonto > 0
        ? envioGratis
          ? `<p style="font-size:0.82rem;color:#2f7a45;margin-top:10px;">🚚 Tenés envío gratis en esta compra.</p>`
          : `<p style="font-size:0.82rem;color:var(--text-soft);margin-top:10px;">🚚 Te faltan ${formatPrice(envioGratisFaltante)} para envío gratis.</p>`
        : ""
    }
    <p style="font-size:0.82rem;color:var(--text-soft);margin-top:6px;">* El costo de envío se coordina por WhatsApp según tu ubicación${envioGratisMonto > 0 ? " (salvo que hayas alcanzado el envío gratis)" : ""}.</p>
  `;
}

function fillRegions() {
  regionSelect.innerHTML =
    `<option value="" disabled selected>Elegí tu provincia</option>` +
    PROVINCIAS_AR.map((r) => `<option value="${r}">${r}</option>`).join("");
}

async function onSubmit(e) {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  const cliente = {
    nombre: form.nombre.value.trim(),
    whatsapp: form.whatsapp.value.trim(),
    calle: form.calle.value.trim(),
    ciudad: form.ciudad.value.trim(),
    region: form.region.value,
  };

  const summary = cartSummary || (await getCartSummary(items, getAppliedDiscountId()));

  try {
    const pedidoRef = await addDoc(collection(db, "pedidos"), {
      cliente,
      items,
      subtotal: summary.subtotal,
      descuentoAplicado: summary.appliedEval
        ? { nombre: summary.appliedEval.descuento.nombre, monto: summary.discountAmount }
        : null,
      envioGratis: summary.envioGratis,
      total: summary.total,
      estado: "pendiente",
      fecha: serverTimestamp(),
    });

    const waNumber = await getStoreWhatsapp();
    const message = buildWhatsappMessage(pedidoRef.id, cliente, items, summary);
    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    clearCart();
    showConfirmation(waLink);
  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar pedido";
    alert("Hubo un error al enviar tu pedido. Por favor, intentá de nuevo.");
  }
}

async function getStoreWhatsapp() {
  try {
    const snap = await getDoc(doc(db, "config", "site"));
    if (snap.exists() && snap.data().whatsappNumber) {
      return snap.data().whatsappNumber.replace(/\D/g, "");
    }
  } catch (e) {
    console.warn(e);
  }
  return "5490000000000"; // fallback: configurar en el panel de administración
}

function buildWhatsappMessage(pedidoId, cliente, items, summary) {
  const lines = [
    `¡Hola! Quiero finalizar mi compra en Zoë νέος 🌿`,
    `Pedido: #${pedidoId.slice(0, 6).toUpperCase()}`,
    ``,
    ...items.map((it) => `• ${it.cantidad}x ${it.nombre} - ${formatPrice(it.precio * it.cantidad)}`),
    ``,
  ];

  if (summary.appliedEval) {
    lines.push(`Subtotal: ${formatPrice(summary.subtotal)}`);
    lines.push(`Descuento (${summary.appliedEval.descuento.nombre}): -${formatPrice(summary.discountAmount)}`);
  }
  lines.push(`Total: ${formatPrice(summary.total)}`);
  if (summary.envioGratis) lines.push(`Envío: gratis 🚚`);
  lines.push(``, `Datos de envío:`, `Nombre: ${cliente.nombre}`, `Dirección: ${cliente.calle}, ${cliente.ciudad}, ${cliente.region}`, ``, `Quedo a la espera para coordinar el método de pago${summary.envioGratis ? "" : " y el costo de envío"}. ¡Gracias!`);

  return lines.join("\n");
}

function showConfirmation(waLink) {
  formSection.style.display = "none";
  confirmSection.style.display = "block";
  confirmSection.querySelector("#waLink").href = waLink;
}
