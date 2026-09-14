// js/cart.js
// Carrinho de compras. Guardado em localStorage para persistir entre páginas.
// Qualquer página que importe este módulo e chame initCartUI() ganha:
// - contador no ícone do carrinho
// - drawer lateral com os itens, botões de +/- e remover, e total

import { formatPrice } from "./utils.js";
import { optimizedUrl } from "./cloudinary.js";

function optimizedUrlSafe(url, width) {
  return url ? optimizedUrl(url, width) : "https://placehold.co/140x140/f7f0e6/b9a488?text=Zoe";
}

const STORAGE_KEY = "zoeveos_cart";

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

export function getCartTotal() {
  return readCart().reduce((sum, it) => sum + it.precio * it.cantidad, 0);
}

export function getCartCount() {
  return readCart().reduce((sum, it) => sum + it.cantidad, 0);
}

export function addToCart(product, qty = 1) {
  const items = readCart();
  const existing = items.find((it) => it.id === product.id);
  if (existing) {
    existing.cantidad += qty;
  } else {
    items.push({
      id: product.id,
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

function renderCartDrawer() {
  const list = document.getElementById("cartItemsList");
  const totalEl = document.getElementById("cartTotalValue");
  const footer = document.getElementById("cartDrawerFooter");
  if (!list) return;

  const items = getCart();

  if (items.length === 0) {
    list.innerHTML = `<div class="cart-empty">Tu carrito está vacío.</div>`;
    if (footer) footer.style.display = "none";
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

  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());

  list.querySelectorAll(".cart-item").forEach((row) => {
    const id = row.dataset.id;
    const item = items.find((i) => i.id === id);
    row.querySelector(".qty-plus").addEventListener("click", () => updateQty(id, item.cantidad + 1));
    row.querySelector(".qty-minus").addEventListener("click", () => updateQty(id, item.cantidad - 1));
    row.querySelector(".cart-item-remove").addEventListener("click", () => removeFromCart(id));
  });
}
