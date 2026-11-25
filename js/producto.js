// js/producto.js
import { db, doc, getDoc } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { addToCart } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam, formatPrice, priceInfo } from "./utils.js";

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

const WA_ICON = `<svg viewBox="0 0 32 32" fill="#fff"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 1.9 6.8L3 29l6.7-2.1c1.9 1 4.1 1.6 6.3 1.6 7 0 12.7-5.7 12.7-12.7C28.7 8.7 23 3 16 3z"/></svg>`;
const MAIN_ID = "__main__";

function mainImages(p) {
  return p.images && p.images.length ? p.images : ["https://placehold.co/700x600/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre)];
}

// Disponibilidad del producto principal (cuando hay variaciones) o del producto simple
function mainAvailable(p) {
  return !!p.porEncargo || Number(p.stock) > 0;
}

function renderGallery(images, sold) {
  const el = document.getElementById("pdGallery");
  el.innerHTML = `
    <div class="product-carousel ${sold ? "is-sold" : ""}" id="pdCarousel">
      <div class="pc-track">
        ${images.map((img, i) => `<div class="pc-slide ${i === 0 ? "active" : ""}"><img src="${optimizedUrl(img, 900)}" alt="${currentProduct.nombre}"></div>`).join("")}
      </div>
      ${
        images.length > 1
          ? `<button class="pc-arrow prev" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
             <button class="pc-arrow next" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
             <div class="pc-dots">${images.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div>`
          : ""
      }
    </div>`;
  initCarousel(images);
}

function priceHtml(info) {
  return `${formatPrice(info.precio)}${
    info.precioTransferencia ? `<div class="price-transf">💸 ${formatPrice(info.precioTransferencia)} <span>pagando por transferencia</span></div>` : ""
  }`;
}

function setCanonical(p) {
  if (!p.landingActiva || !p.landingSlug) return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = `https://www.zoeveos.com/p/${p.landingSlug}`;
}

function render() {
  setCanonical(currentProduct);
  const p = currentProduct;
  const hasVariants = p.variantes && p.variantes.length > 0;
  const sold = !!p.vendido;

  wrap.innerHTML = `
  <div class="pd-gallery" id="pdGallery"></div>
  <div class="pd-info">
    <h1>${p.nombre}</h1>
    ${p.porEncargo ? `<span class="badge-encargo">Por encargo</span>` : ""}
    ${sold ? `<span class="badge-sold">Vendido</span>` : ""}
    <div class="price" id="pdPrice"></div>
    <p class="desc">${p.descripcion || ""}</p>

    ${hasVariants && !sold ? renderVariantSelector(p) : ""}

    ${sold ? "" : `<div class="qty-selector">
      <button id="qtyMinus">−</button>
      <span id="qtyValue">1</span>
      <button id="qtyPlus">+</button>
    </div>`}

    <div id="pdAction"></div>
  </div>`;

  // Selección inicial: el producto principal (o la primera variación si el principal no está disponible)
  let initial = null;
  if (hasVariants && !mainAvailable(p) && !p.porEncargo) {
    initial = p.variantes.find((v) => Number(v.stock) > 0) || null;
    if (!initial) selectedVariant = null;
  }
  applySelection(initial, true);

  if (!sold) {
    document.getElementById("qtyMinus").addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      document.getElementById("qtyValue").textContent = qty;
      refreshEncargoLink();
    });
    document.getElementById("qtyPlus").addEventListener("click", () => {
      qty += 1;
      document.getElementById("qtyValue").textContent = qty;
      refreshEncargoLink();
    });
  }
  if (hasVariants && !sold) bindVariantPills(p);
}

// Aplica la opción elegida: null = producto principal, objeto = una variación.
// Cambia foto, precio, botón y marca la opción activa.
function applySelection(variant, first = false) {
  const p = currentProduct;
  const hasVariants = p.variantes && p.variantes.length > 0;
  selectedVariant = variant;

  document.querySelectorAll(".variant-pill").forEach((b) => {
    const isMain = b.dataset.id === MAIN_ID;
    b.classList.toggle("active", variant ? b.dataset.id === variant.id : isMain && mainAvailable(p));
  });

  // Foto: la de la variación (si tiene) o las del producto principal
  const images = variant && variant.imagen ? [variant.imagen] : mainImages(p);
  renderGallery(images, !!p.vendido);

  document.getElementById("pdPrice").innerHTML = priceHtml(priceInfo(p, variant));
  renderAction(p, variant, hasVariants);
}

function renderAction(p, variant, hasVariants) {
  const box = document.getElementById("pdAction");
  if (p.vendido) {
    box.innerHTML = `<button class="btn-full" style="max-width:320px;" disabled>Vendido</button>`;
    return;
  }
  const noOption = hasVariants && !variant && !mainAvailable(p); // nada elegible
  const outOfStock = !p.porEncargo && (variant ? Number(variant.stock) <= 0 : Number(p.stock) <= 0);

  if (p.porEncargo) {
    box.innerHTML = `<a href="#" id="encargoBtn" class="whatsapp-btn" style="max-width:320px;" target="_blank" rel="noopener">${WA_ICON} Consultar por WhatsApp</a>
      <p class="encargo-hint">Este producto es por encargo. Te vamos a confirmar tiempos y detalles por WhatsApp.</p>`;
    refreshEncargoLink();
    return;
  }
  box.innerHTML = `<button class="btn-full" id="addToCartBtn" style="max-width:320px;" ${noOption || outOfStock ? "disabled" : ""}>
      ${noOption ? "Sin stock" : outOfStock ? "Sin stock" : "Agregar al carrito"}
    </button>`;
  const btn = document.getElementById("addToCartBtn");
  btn.addEventListener("click", () => onAddToCart());
}

function renderVariantSelector(p) {
  const mainDisabled = !mainAvailable(p);
  const mainImg = mainImages(p)[0];
  return `
  <div class="variant-selector">
    <label>Elegí una opción</label>
    <div class="variant-pills" id="variantPills">
      <button type="button" class="variant-pill ${mainDisabled ? "disabled" : ""}" data-id="${MAIN_ID}" ${mainDisabled ? "disabled" : ""}>
        <img src="${optimizedUrl(mainImg, 80)}" alt="${p.nombre}">
        <span>${p.nombre}${mainDisabled ? " (sin stock)" : ""}</span>
      </button>
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
  document.querySelectorAll(".variant-pill:not(.disabled)").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.id === MAIN_ID) {
        applySelection(null);
      } else {
        applySelection(p.variantes.find((v) => v.id === btn.dataset.id) || null);
      }
    });
  });
}

function refreshEncargoLink() {
  const btn = document.getElementById("encargoBtn");
  if (!btn) return;
  const p = currentProduct;
  if (!storeWhatsapp) {
    btn.href = "#";
    return;
  }
  const variantText = selectedVariant ? ` (${selectedVariant.nombre})` : "";
  const lines = [
    `¡Hola! Quiero consultar sobre este producto por encargo:`,
    `${p.nombre}${variantText}`,
    `Cantidad: ${qty}`,
    ...(p.codigo ? [`Código: ${p.codigo}`] : []),
    window.location.href,
  ];
  btn.href = `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function onAddToCart() {
  const p = currentProduct;
  const addBtn = document.getElementById("addToCartBtn");
  const v = selectedVariant;
  const info = priceInfo(p, v);
  const base = { productoId: p.id, categoriaId: p.categoriaId || "", codigo: p.codigo || "", precio: info.precio, precioTransferencia: info.precioTransferencia };

  const cartItem = v
    ? { ...base, id: `${p.id}__${v.id}`, nombre: `${p.nombre} - ${v.nombre}`, imagen: v.imagen || mainImages(p)[0] }
    : { ...base, id: p.id, nombre: p.nombre, imagen: mainImages(p)[0] };

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
