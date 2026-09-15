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
    render();
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty-state">No se pudo cargar el producto.</div>`;
  }
}

function render() {
  const p = currentProduct;
  const images = p.images && p.images.length ? p.images : ["https://placehold.co/700x600/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre)];
  const hasVariants = p.variantes && p.variantes.length > 0;
  const sinStockSimple = !hasVariants && Number(p.stock) <= 0;

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
    <div class="price">${formatPrice(p.precio)}</div>
    <p class="desc">${p.descripcion || ""}</p>

    ${hasVariants ? renderVariantSelector(p) : ""}

    <div class="qty-selector">
      <button id="qtyMinus">−</button>
      <span id="qtyValue">1</span>
      <button id="qtyPlus">+</button>
    </div>
    <button class="btn-full" id="addToCartBtn" style="max-width:320px;" ${hasVariants || sinStockSimple ? "disabled" : ""}>
      ${sinStockSimple ? "Sin stock" : hasVariants ? "Elegí una variación" : "Agregar al carrito"}
    </button>
  </div>`;

  initCarousel(images);

  document.getElementById("qtyMinus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    document.getElementById("qtyValue").textContent = qty;
  });
  document.getElementById("qtyPlus").addEventListener("click", () => {
    qty += 1;
    document.getElementById("qtyValue").textContent = qty;
  });

  if (hasVariants) bindVariantPills(p);

  document.getElementById("addToCartBtn").addEventListener("click", () => onAddToCart(images));
}

function renderVariantSelector(p) {
  return `
  <div class="variant-selector">
    <label>Elegí una variación</label>
    <div class="variant-pills" id="variantPills">
      ${p.variantes
        .map((v) => {
          const sinStock = Number(v.stock) <= 0;
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
      const addBtn = document.getElementById("addToCartBtn");
      addBtn.disabled = false;
      addBtn.textContent = "Agregar al carrito";
    });
  });
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
