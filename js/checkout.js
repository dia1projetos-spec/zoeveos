// js/checkout.js
import { db, doc, getDoc, collection, addDoc, serverTimestamp } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { getCart, getCartTotal, clearCart } from "./cart.js";
import { formatPrice, PROVINCIAS_AR } from "./utils.js";

await initHeader();

const formSection = document.getElementById("checkoutForm");
const confirmSection = document.getElementById("checkoutConfirm");
const summaryEl = document.getElementById("orderSummary");
const regionSelect = document.getElementById("region");
const form = document.getElementById("dataForm");
const submitBtn = document.getElementById("submitBtn");

const items = getCart();

if (items.length === 0) {
  formSection.innerHTML = `<div class="empty-state">Tu carrito está vacío. <a href="/index.html" style="color:var(--pink-dark);text-decoration:underline;">Volver a la tienda</a></div>`;
} else {
  renderSummary();
  fillRegions();
  form.addEventListener("submit", onSubmit);
}

function renderSummary() {
  const total = getCartTotal();
  summaryEl.innerHTML = `
    ${items.map((it) => `<div class="row"><span>${it.cantidad} x ${it.nombre}</span><span>${formatPrice(it.precio * it.cantidad)}</span></div>`).join("")}
    <div class="row total-row"><strong>Total</strong><strong>${formatPrice(total)}</strong></div>
    <p style="font-size:0.82rem;color:var(--text-soft);margin-top:10px;">* El costo de envío se coordina por WhatsApp según tu ubicación.</p>
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

  const total = getCartTotal();

  try {
    const pedidoRef = await addDoc(collection(db, "pedidos"), {
      cliente,
      items,
      total,
      estado: "pendiente",
      fecha: serverTimestamp(),
    });

    const waNumber = await getStoreWhatsapp();
    const message = buildWhatsappMessage(pedidoRef.id, cliente, items, total);
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

function buildWhatsappMessage(pedidoId, cliente, items, total) {
  const lines = [
    `¡Hola! Quiero finalizar mi compra en Zoë νέος 🌿`,
    `Pedido: #${pedidoId.slice(0, 6).toUpperCase()}`,
    ``,
    ...items.map((it) => `• ${it.cantidad}x ${it.nombre} - ${formatPrice(it.precio * it.cantidad)}`),
    ``,
    `Total: ${formatPrice(total)}`,
    ``,
    `Datos de envío:`,
    `Nombre: ${cliente.nombre}`,
    `Dirección: ${cliente.calle}, ${cliente.ciudad}, ${cliente.region}`,
    ``,
    `Quedo a la espera para coordinar el método de pago y el costo de envío. ¡Gracias!`,
  ];
  return lines.join("\n");
}

function showConfirmation(waLink) {
  formSection.style.display = "none";
  confirmSection.style.display = "block";
  confirmSection.querySelector("#waLink").href = waLink;
}
