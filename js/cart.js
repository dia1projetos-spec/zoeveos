// js/cart.js
// Carrinho de compras. Guardado em localStorage para persistir entre páginas.
// Qualquer página que importe este módulo e chame initCartUI() ganha:
// - contador no ícone do carrinho
// - drawer lateral com os itens, botões de +/- e remover, cupons de desconto, frete grátis e total

import { formatPrice } from "./utils.js";
import { optimizedUrl } from "./cloudinary.js";
import { getCartSummary, describeCondicion } from "./discounts.js";

function optimizedUrlSafe(url, width) {
  return url ? optimizedUrl(url, width) : "https://placehold.co/140x140/f7f0e6/b9a488?text=Zoe";
}

const STORAGE_KEY = "zoeveos_cart";
const DISCOUNT_KEY = "zoeveos_applied_discount";

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: getCart() }));
}

export function getCart() {
  return readCart();
}

// Subtotal "crudo", sin aplicar ningún descuento. Se usa como base para calcular descuentos.
export function getCartTotal() {
  return readCart().reduce((sum, it) => sum + it.precio * it.cantidad, 0);
}

export function getCartCount() {
  return readCart().reduce((sum, it) => sum + it.cantidad, 0);
}

/**
 * product: { id, nombre, precio, imagen, productoId?, categoriaId? }
 * - id: identificador único en el carrito (puede incluir la variación, ej "prod123__varAzul")
 * - productoId: id real del producto en Firestore (sin la variación), para que los descuentos
 *   por "producto específico" matcheen aunque haya variaciones.
 * - categoriaId: categoría raíz del producto, para los descuentos por categoría.
 */
export function addToCart(product, qty = 1) {
  const items = readCart();
  const existing = items.find((it) => it.id === product.id);
  if (existing) {
    existing.cantidad += qty;
  } else {
    items.push({
      id: product.id,
      productoId: product.productoId || product.id,
      categoriaId: product.categoriaId || "",
      nombre: product.nombre,
      precio: Number(product.precio) || 0,
      imagen: product.imagen || "",
      cantidad: qty,
    });
  }
  writeCart(items);
}

export function updateQty(productId, qty) {
  let items = readCart();
  if (qty <= 0) {
    items = items.filter((it) => it.id !== productId);
  } else {
    const it = items.find((i) => i.id === productId);
    if (it) it.cantidad = qty;
  }
  writeCart(items);
}

export function removeFromCart(productId) {
  const items = readCart().filter((it) => it.id !== productId);
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
  clearAppliedDiscount();
}

/* ---------------- Cupón de descuento aplicado ---------------- */

export function getAppliedDiscountId() {
  return localStorage.getItem(DISCOUNT_KEY) || null;
}

export function setAppliedDiscountId(id) {
  localStorage.setItem(DISCOUNT_KEY, id);
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: getCart() }));
}

export function clearAppliedDiscount() {
  localStorage.removeItem(DISCOUNT_KEY);
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: getCart() }));
}

/* ---------------- UI: contador + drawer ---------------- */

export function initCartUI() {
  renderCartCount();
  renderCartDrawer();
  document.addEventListener("cart:updated", () => {
    renderCartCount();
    renderCartDrawer();
  });

  const cartBtn = document.getElementById("cartBtn");
  const overlay = document.getElementById("cartOverlay");
  const drawer = document.getElementById("cartDrawer");
  const closeBtn = document.getElementById("cartCloseBtn");

  const open = () => {
    overlay?.classList.add("open");
    drawer?.classList.add("open");
  };
  const close = () => {
    overlay?.classList.remove("open");
    drawer?.classList.remove("open");
  };

  cartBtn?.addEventListener("click", open);
  overlay?.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);
}

function renderCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const count = getCartCount();
  el.textContent = count;
  el.style.display = count > 0 ? "flex" : "none";
}

async function renderCartDrawer() {
  const list = document.getElementById("cartItemsList");
  const totalEl = document.getElementById("cartTotalValue");
  const footer = document.getElementById("cartDrawerFooter");
  const promoWrap = document.getElementById("cartPromoWrap");
  if (!list) return;

  const items = getCart();

  if (items.length === 0) {
    list.innerHTML = `<div class="cart-empty">Tu carrito está vacío.</div>`;
    if (footer) footer.style.display = "none";
    if (promoWrap) promoWrap.innerHTML = "";
    return;
  }

  if (footer) footer.style.display = "block";

  list.innerHTML = items
    .map(
      (it) => `
    <div class="cart-item" data-id="${it.id}">
      <img src="${optimizedUrlSafe(it.imagen, 140)}" alt="${it.nombre}">
      <div class="cart-item-info">
        <h4>${it.nombre}</h4>
        <div class="price">${formatPrice(it.precio * it.cantidad)}</div>
        <div class="cart-item-qty">
          <button class="qty-minus" aria-label="Restar">−</button>
          <span>${it.cantidad}</span>
          <button class="qty-plus" aria-label="Sumar">+</button>
        </div>
        <button class="cart-item-remove">Eliminar</button>
      </div>
    </div>`
    )
    .join("");

  list.querySelectorAll(".cart-item").forEach((row) => {
    const id = row.dataset.id;
    const item = items.find((i) => i.id === id);
    row.querySelector(".qty-plus").addEventListener("click", () => updateQty(id, item.cantidad + 1));
    row.querySelector(".qty-minus").addEventListener("click", () => updateQty(id, item.cantidad - 1));
    row.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(id));
  });

  // Total provisorio (subtotal, sin descuento) mientras se cargan los descuentos desde Firestore.
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());

  if (promoWrap) {
    const summary = await getCartSummary(items, getAppliedDiscountId());
    renderPromoPanel(promoWrap, summary);
    if (totalEl) totalEl.textContent = formatPrice(summary.total);
  }
}

function renderPromoPanel(promoWrap, summary) {
  const { evaluaciones, appliedEval, discountAmount, envioGratisMonto, envioGratis, envioGratisFaltante } = summary;

  let html = "";

  // Envío gratis
  if (envioGratisMonto > 0) {
    html += envioGratis
      ? `<div class="promo-banner promo-unlocked">🚚 ¡Felicitaciones! Tenés <strong>envío gratis</strong> en esta compra.</div>`
      : `<div class="promo-banner">🚚 Te faltan <strong>${formatPrice(envioGratisFaltante)}</strong> para <strong>envío gratis</strong>.</div>`;
  }

  // Descuento aplicado
  if (appliedEval) {
    html += `
    <div class="promo-applied">
      <span>🏷️ ${appliedEval.descuento.nombre} aplicado</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <strong>-${formatPrice(discountAmount)}</strong>
        <button type="button" id="promoRemoveBtn" class="promo-remove">Quitar</button>
      </div>
    </div>`;
  }

  // Cupones disponibles / progreso
  const otros = evaluaciones.filter((e) => e.descuento.id !== (appliedEval?.descuento.id || ""));
  if (otros.length > 0) {
    html += `<div class="promo-list">`;
    otros.forEach((ev) => {
      if (ev.elegible) {
        html += `
        <div class="promo-card promo-card-ready">
          <div>
            <div class="promo-card-title">🎉 ${ev.descuento.nombre}</div>
            <div class="promo-card-sub">${describeCondicion(ev.descuento)} · ${ev.descuento.porcentaje}% OFF</div>
          </div>
          <button type="button" class="promo-apply-btn" data-apply="${ev.descuento.id}">Aplicar</button>
        </div>`;
      } else {
        const faltaTxt = ev.descuento.tipo === "cantidad" ? `${ev.faltante} u. más` : formatPrice(ev.faltante);
        html += `
        <div class="promo-card promo-card-locked">
          <div class="promo-card-title">🔒 ${ev.descuento.nombre}</div>
          <div class="promo-card-sub">Te faltan ${faltaTxt} para ${ev.descuento.porcentaje}% OFF</div>
        </div>`;
      }
    });
    html += `</div>`;
  }

  promoWrap.innerHTML = html;

  promoWrap.querySelectorAll("[data-apply]").forEach((btn) => {
    btn.addEventListener("click", () => setAppliedDiscountId(btn.dataset.apply));
  });
  document.getElementById("promoRemoveBtn")?.addEventListener("click", clearAppliedDiscount);
}
