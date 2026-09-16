// js/producto.js
import { db, doc, getDoc } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { addToCart } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam, formatPrice } from "./utils.js";

await initHeader();

const productId = getParam("id");
const wrap = document.getElementById("productDetail");

let currentProduct = null;
let qty = 1;
let selectedVariant = null;
let storeWhatsapp = "";

async function load() {
  if (!productId) {
    wrap.innerHTML = `<div class="empty-state">Producto no encontrado.</div>`;
    return;
  }
  try {
    const snap = await getDoc(doc(db, "productos", productId));
    if (!snap.exists()) {
      wrap.innerHTML = `<div class="empty-state">Producto no encontrado.</div>`;
      return;
    }
    currentProduct = { id: snap.id, ...snap.data() };
    document.title = currentProduct.nombre + " · Zoë νέος";

    if (currentProduct.porEncargo) {
      storeWhatsapp = await getStoreWhatsapp();
    }

    render();
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty-state">No se pudo cargar el producto.</div>`;
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
  return "";
}

function render() {
  const p = currentProduct;
  const images = p.images && p.images.length ? p.images : ["https://placehold.co/700x600/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre)];
  const hasVariants = p.variantes && p.variantes.length > 0;
  const sinStockSimple = !p.porEncargo && !hasVariants && Number(p.stock) <= 0;

  wrap.innerHTML = `
  <div class="pd-gallery">
    <div class="product-carousel" id="pdCarousel">
      <div class="pc-track">
        ${images.map((img, i) => `<div class="pc-slide ${i === 0 ? "active" : ""}"><img src="${optimizedUrl(img, 900)}" alt="${p.nombre}"></div>`).join("")}
      </div>
      ${
        images.length > 1
          ? `<button class="pc-arrow prev" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
             <button class="pc-arrow next" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
             <div class="pc-dots">${images.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div>`
          : ""
      }
    </div>
  </div>
  <div class="pd-info">
    <h1>${p.nombre}</h1>
    ${p.porEncargo ? `<span class="badge-encargo">Por encargo</span>` : ""}
    <div class="price">${formatPrice(p.precio)}</div>
    <p class="desc">${p.descripcion || ""}</p>

    ${hasVariants ? renderVariantSelector(p) : ""}

    <div class="qty-selector">
      <button id="qtyMinus">−</button>
      <span id="qtyValue">1</span>
      <button id="qtyPlus">+</button>
    </div>

    ${
      p.porEncargo
        ? `<a href="#" id="encargoBtn" class="whatsapp-btn ${hasVariants ? "is-disabled" : ""}" style="max-width:320px;" target="_blank" rel="noopener">
             <svg viewBox="0 0 32 32" fill="#fff"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 1.9 6.8L3 29l6.7-2.1c1.9 1 4.1 1.6 6.3 1.6 7 0 12.7-5.7 12.7-12.7C28.7 8.7 23 3 16 3z"/></svg>
             ${hasVariants ? "Elegí una variación" : "Consultar por WhatsApp"}
           </a>
           <p class="encargo-hint">Este producto es por encargo. Te vamos a confirmar tiempos y detalles por WhatsApp.</p>`
        : `<button class="btn-full" id="addToCartBtn" style="max-width:320px;" ${hasVariants || sinStockSimple ? "disabled" : ""}>
             ${sinStockSimple ? "Sin stock" : hasVariants ? "Elegí una variación" : "Agregar al carrito"}
           </button>`
    }
  </div>`;

  initCarousel(images);

  document.getElementById("qtyMinus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    document.getElementById("qtyValue").textContent = qty;
    if (p.porEncargo) updateEncargoLink(document.getElementById("encargoBtn"), hasVariants);
  });
  document.getElementById("qtyPlus").addEventListener("click", () => {
    qty += 1;
    document.getElementById("qtyValue").textContent = qty;
    if (p.porEncargo) updateEncargoLink(document.getElementById("encargoBtn"), hasVariants);
  });

  if (hasVariants) bindVariantPills(p);

  if (p.porEncargo) {
    const btn = document.getElementById("encargoBtn");
    updateEncargoLink(btn, hasVariants);
    btn.addEventListener("click", (e) => {
      if (hasVariants && !selectedVariant) e.preventDefault();
    });
  } else {
    document.getElementById("addToCartBtn").addEventListener("click", () => onAddToCart(images));
  }
}

function renderVariantSelector(p) {
  return `
  <div class="variant-selector">
    <label>Elegí una variación</label>
    <div class="variant-pills" id="variantPills">
      ${p.variantes
        .map((v) => {
          const sinStock = !p.porEncargo && Number(v.stock) <= 0;
          return `
          <button type="button" class="variant-pill ${sinStock ? "disabled" : ""}" data-id="${v.id}" ${sinStock ? "disabled" : ""}>
            ${v.imagen ? `<img src="${optimizedUrl(v.imagen, 80)}" alt="${v.nombre}">` : ""}
            <span>${v.nombre}${sinStock ? " (sin stock)" : ""}</span>
          </button>`;
        })
        .join("")}
    </div>
  </div>`;
}

function bindVariantPills(p) {
  const pills = document.querySelectorAll(".variant-pill:not(.disabled)");
  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".variant-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedVariant = p.variantes.find((v) => v.id === btn.dataset.id) || null;

      if (p.porEncargo) {
        const encargoBtn = document.getElementById("encargoBtn");
        encargoBtn.classList.remove("is-disabled");
        encargoBtn.innerHTML = `
          <svg viewBox="0 0 32 32" fill="#fff"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 1.9 6.8L3 29l6.7-2.1c1.9 1 4.1 1.6 6.3 1.6 7 0 12.7-5.7 12.7-12.7C28.7 8.7 23 3 16 3z"/></svg>
          Consultar por WhatsApp`;
        updateEncargoLink(encargoBtn, true);
      } else {
        const addBtn = document.getElementById("addToCartBtn");
        addBtn.disabled = false;
        addBtn.textContent = "Agregar al carrito";
      }
    });
  });
}

function updateEncargoLink(btn, hasVariants) {
  const p = currentProduct;
  if (hasVariants && !selectedVariant) {
    btn.href = "#";
    return;
  }
  if (!storeWhatsapp) {
    btn.href = "#";
    return;
  }
  const variantText = selectedVariant ? ` (${selectedVariant.nombre})` : "";
  const lines = [
    `¡Hola! Quiero consultar sobre este producto por encargo:`,
    `${p.nombre}${variantText}`,
    `Cantidad: ${qty}`,
    window.location.href,
  ];
  btn.href = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function onAddToCart(images) {
  const p = currentProduct;
  const hasVariants = p.variantes && p.variantes.length > 0;
  const addBtn = document.getElementById("addToCartBtn");

  if (hasVariants && !selectedVariant) {
    return; // el botón debería estar deshabilitado, pero por las dudas no hacemos nada
  }

  const cartItem = hasVariants
    ? {
        id: `${p.id}__${selectedVariant.id}`,
        nombre: `${p.nombre} - ${selectedVariant.nombre}`,
        precio: p.precio,
        imagen: selectedVariant.imagen || images[0],
      }
    : { id: p.id, nombre: p.nombre, precio: p.precio, imagen: images[0] };

  addToCart(cartItem, qty);
  addBtn.textContent = "¡Agregado al carrito!";
  setTimeout(() => (addBtn.textContent = "Agregar al carrito"), 1400);
}

function initCarousel(images) {
  if (images.length <= 1) return;
  const el = document.getElementById("pdCarousel");
  const slides = el.querySelectorAll(".pc-slide");
  const dots = el.querySelectorAll(".pc-dots span");
  let current = 0;

  function goTo(i) {
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = (i + slides.length) % slides.length;
    slides[current].classList.add("active");
    dots[current].classList.add("active");
  }

  el.querySelectorAll(".pc-arrow").forEach((btn) => {
    btn.addEventListener("click", () => goTo(current + Number(btn.dataset.dir)));
  });
}

load();
