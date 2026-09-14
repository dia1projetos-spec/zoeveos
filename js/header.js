// js/header.js
// Injeta o header, o menu lateral (hambúrguer) e o drawer do carrinho em qualquer página
// que tenha um elemento <div id="app-header"></div> e <div id="app-cart-drawer"></div>.

import { db, collection, getDocs, doc, getDoc, query, orderBy } from "./firebase-config.js";
import { initCartUI } from "./cart.js";

const HEADER_HTML = `
<header class="site-header">
  <button class="menu-btn" id="menuBtn" aria-label="Abrir menú">
    <span></span><span></span><span></span>
  </button>

  <a href="/index.html" class="brand">
    <div class="brand-badge" id="brandBadge">
      <span class="logo-fallback-title">Zoë νέος</span>
      <span class="logo-fallback-sub">Diseños exclusivos</span>
    </div>
  </a>

  <button class="cart-btn" id="cartBtn" aria-label="Ver carrito">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="9.5" cy="20.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="20.5" r="1.2" fill="currentColor"/></svg>
    <span class="cart-count" id="cartCount" style="display:none;">0</span>
  </button>
</header>

<div class="side-nav-overlay" id="sideNavOverlay"></div>
<nav class="side-nav" id="sideNav">
  <button class="close-btn" id="sideNavClose" aria-label="Cerrar menú">✕</button>
  <h3>Menú</h3>
  <ul id="sideNavList">
    <li><a href="/index.html">Inicio</a></li>
    <li><a href="/blog.html">Blog</a></li>
  </ul>
</nav>
`;

const CART_DRAWER_HTML = `
<div class="cart-overlay" id="cartOverlay"></div>
<aside class="cart-drawer" id="cartDrawer">
  <div class="cart-drawer-header">
    <h3>Tu carrito</h3>
    <button id="cartCloseBtn" aria-label="Cerrar carrito">✕</button>
  </div>
  <div class="cart-items" id="cartItemsList"></div>
  <div class="cart-drawer-footer" id="cartDrawerFooter" style="display:none;">
    <div class="cart-total-row"><span>Total</span><strong id="cartTotalValue">$0</strong></div>
    <a href="/checkout.html" class="btn-full">Finalizar compra</a>
  </div>
</aside>
`;

export async function initHeader() {
  const headerEl = document.getElementById("app-header");
  const cartEl = document.getElementById("app-cart-drawer");
  if (headerEl) headerEl.innerHTML = HEADER_HTML;
  if (cartEl) cartEl.innerHTML = CART_DRAWER_HTML;

  // Menu lateral
  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("sideNavOverlay");
  const nav = document.getElementById("sideNav");
  const closeBtn = document.getElementById("sideNavClose");
  const openNav = () => { overlay.classList.add("open"); nav.classList.add("open"); };
  const closeNav = () => { overlay.classList.remove("open"); nav.classList.remove("open"); };
  menuBtn?.addEventListener("click", openNav);
  overlay?.addEventListener("click", closeNav);
  closeBtn?.addEventListener("click", closeNav);

  initCartUI();

  await loadLogo();
  await loadCategoriesIntoMenu();
}

async function loadLogo() {
  try {
    const snap = await getDoc(doc(db, "config", "site"));
    const badge = document.getElementById("brandBadge");
    if (snap.exists() && snap.data().logoUrl && badge) {
      badge.classList.add("has-logo");
      badge.innerHTML = `<img class="logo-img" src="${snap.data().logoUrl}" alt="Logo">`;
    }
  } catch (e) {
    console.warn("No se pudo cargar el logo:", e);
  }
}

async function loadCategoriesIntoMenu() {
  try {
    const q = query(collection(db, "categorias"), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    const list = document.getElementById("sideNavList");
    if (!list) return;
    snap.forEach((d) => {
      const cat = d.data();
      if (cat.activo === false) return;
      const li = document.createElement("li");
      li.innerHTML = `<a href="/categoria.html?id=${d.id}">${cat.nombre}</a>`;
      list.insertBefore(li, list.children[list.children.length - 1]);
    });
  } catch (e) {
    console.warn("No se pudieron cargar las categorías del menú:", e);
  }
}
