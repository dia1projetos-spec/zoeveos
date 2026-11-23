// js/checkout.js
import { db, doc, getDoc, collection, addDoc, serverTimestamp } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { getCart, getAppliedDiscountId, clearCart } from "./cart.js";
import { getCartSummary } from "./discounts.js";
import { formatPrice, PROVINCIAS_AR } from "./utils.js";
import { loadMetodosPago, describeMetodo } from "./payments.js";

await initHeader();

const formSection = document.getElementById("checkoutForm");
const confirmSection = document.getElementById("checkoutConfirm");
const summaryEl = document.getElementById("orderSummary");
const regionSelect = document.getElementById("region");
const form = document.getElementById("dataForm");
const submitBtn = document.getElementById("submitBtn");

const items = getCart();
let cartSummary = null; // se completa en renderSummary()
let metodos = [];
let metodoSel = null; // medio de pago elegido (objeto) o null si no hay medios configurados

if (items.length === 0) {
  formSection.innerHTML = `<div class="empty-state">Tu carrito está vacío. <a href="/index.html" style="color:var(--pink-dark);text-decoration:underline;">Volver a la tienda</a></div>`;
} else {
  metodos = await loadMetodosPago();
  metodoSel = metodos[0] || null;
  renderPayOptions();
  renderSummary();
  fillRegions();
  form.addEventListener("submit", onSubmit);
}

function renderPayOptions() {
  const section = document.getElementById("paymentSection");
  const box = document.getElementById("payOptions");
  if (!metodos.length) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  box.innerHTML = metodos
    .map(
      (m, i) => `
    <label class="pay-option ${metodoSel === m ? "active" : ""}">
      <input type="radio" name="metodoPago" value="${i}" ${metodoSel === m ? "checked" : ""}>
      <span class="pay-name">${m.nombre}</span>
      <span class="pay-desc">${describeMetodo(m)}</span>
    </label>`
    )
    .join("");
  box.querySelectorAll("input").forEach((inp) =>
    inp.addEventListener("change", () => {
      metodoSel = metodos[Number(inp.value)];
      renderPayOptions();
      renderSummary();
    })
  );
}

async function renderSummary() {
  cartSummary = await getCartSummary(items, getAppliedDiscountId(), metodoSel);
  const { subtotal, appliedEval, discountAmount, recargo, totalFinal: total, envioGratis, envioGratisMonto, envioGratisFaltante } = cartSummary;

  summaryEl.innerHTML = `
    ${cartSummary.items.map((it) => `<div class="row"><span>${it.cantidad} x ${it.nombre}</span><span>${formatPrice(it.precio * it.cantidad)}</span></div>`).join("")}
    ${
      appliedEval
        ? `<div class="row" style="color:var(--pink-dark);"><span>🏷️ ${appliedEval.descuento.nombre}</span><span>-${formatPrice(discountAmount)}</span></div>`
        : ""
    }
    ${
      recargo > 0
        ? `<div class="row"><span>Recargo ${metodoSel ? "(" + metodoSel.nombre + ")" : ""}</span><span>+${formatPrice(recargo)}</span></div>`
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

  const summary = await getCartSummary(items, getAppliedDiscountId(), metodoSel);
  const orderItems = summary.items; // con el precio según el medio de pago elegido

  try {
    const pedidoRef = await addDoc(collection(db, "pedidos"), {
      cliente,
      items: orderItems,
      metodoPago: metodoSel ? { nombre: metodoSel.nombre, tipo: metodoSel.tipo, valor: Number(metodoSel.valor) || 0 } : null,
      recargo: summary.recargo,
      subtotal: summary.subtotal,
      descuentoAplicado: summary.appliedEval
        ? { nombre: summary.appliedEval.descuento.nombre, monto: summary.discountAmount }
        : null,
      envioGratis: summary.envioGratis,
      total: summary.totalFinal,
      estado: "pendiente",
      fecha: serverTimestamp(),
    });

    const waNumber = await getStoreWhatsapp();
    const message = buildWhatsappMessage(pedidoRef.id, cliente, orderItems, summary);
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
    ...items.map((it) => `• ${it.cantidad}x ${it.nombre}${it.codigo ? ` [Cod: ${it.codigo}]` : ""} - ${formatPrice(it.precio * it.cantidad)}`),
    ``,
  ];

  if (summary.appliedEval || summary.recargo > 0) {
    lines.push(`Subtotal: ${formatPrice(summary.subtotal)}`);
  }
  if (summary.appliedEval) lines.push(`Descuento (${summary.appliedEval.descuento.nombre}): -${formatPrice(summary.discountAmount)}`);
  if (metodoSel) {
    lines.push(`Medio de pago: ${metodoSel.nombre}`);
    if (summary.recargo > 0) lines.push(`Recargo: +${formatPrice(summary.recargo)}`);
  }
  lines.push(`Total: ${formatPrice(summary.totalFinal)}`);
  if (summary.envioGratis) lines.push(`Envío: gratis 🚚`);
  lines.push(``, `Datos de envío:`, `Nombre: ${cliente.nombre}`, `Dirección: ${cliente.calle}, ${cliente.ciudad}, ${cliente.region}`, ``, `Quedo a la espera para coordinar el pago${summary.envioGratis ? "" : " y el costo de envío"}. ¡Gracias!`);

  return lines.join("\n");
}

function showConfirmation(waLink) {
  formSection.style.display = "none";
  confirmSection.style.display = "block";
  confirmSection.querySelector("#waLink").href = waLink;
}
