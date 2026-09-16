// js/header.js
// Injeta o header, o menu lateral (hambúrguer) e o drawer do carrinho em qualquer página
// que tenha um elemento <div id="app-header"></div> e <div id="app-cart-drawer"></div>.

import { db, collection, getDocs, doc, getDoc, query, where, orderBy } from "./firebase-config.js";
import { initCartUI } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { formatPrice } from "./utils.js";

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

  <div class="nav-search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    <input type="text" id="navSearchInput" placeholder="Buscar productos..." autocomplete="off">
  </div>
  <div class="nav-search-results" id="navSearchResults"></div>

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

let productSearchIndex = null; // se carga solo la primera vez que alguien busca algo

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
  const closeNav = () => {
    overlay.classList.remove("open");
    nav.classList.remove("open");
    const input = document.getElementById("navSearchInput");
    const results = document.getElementById("navSearchResults");
    if (input) input.value = "";
    if (results) { results.innerHTML = ""; results.classList.remove("open"); }
  };
  menuBtn?.addEventListener("click", openNav);
  overlay?.addEventListener("click", closeNav);
  closeBtn?.addEventListener("click", closeNav);

  initCartUI();
  wireSearch();

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

/* ---------------- Menú con subcategorías desplegables ---------------- */

async function loadCategoriesIntoMenu() {
  try {
    const q = query(collection(db, "categorias"), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    const list = document.getElementById("sideNavList");
    if (!list) return;

    const categorias = [];
    snap.forEach((d) => {
      const cat = d.data();
      if (cat.activo === false) return;
      categorias.push({ id: d.id, ...cat });
    });

    // Para cada categoría, buscamos sus subcategorías de primer nivel para armar el submenú.
    for (const cat of categorias) {
      let subcats = [];
      try {
        const subQ = query(collection(db, "subcategorias"), where("categoriaId", "==", cat.id));
        const subSnap = await getDocs(subQ);
        subSnap.forEach((d) => {
          const s = d.data();
          if (s.activo === false) return;
          subcats.push({ id: d.id, ...s });
        });
        subcats.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      } catch (e) {
        console.warn(e);
      }

      const li = document.createElement("li");
      li.className = "nav-item" + (subcats.length ? " has-children" : "");

      if (subcats.length === 0) {
        li.innerHTML = `<a href="/categoria.html?id=${cat.id}">${cat.nombre}</a>`;
      } else {
        li.innerHTML = `
          <div class="nav-row">
            <a href="/categoria.html?id=${cat.id}">${cat.nombre}</a>
            <button type="button" class="nav-toggle" aria-label="Ver subcategorías de ${cat.nombre}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
          <ul class="nav-submenu">
            ${subcats.map((s) => `<li><a href="/subcategoria.html?id=${s.id}">${s.nombre}</a></li>`).join("")}
          </ul>`;

        li.querySelector(".nav-toggle").addEventListener("click", (e) => {
          e.preventDefault();
          li.classList.toggle("open");
        });
      }

      list.insertBefore(li, list.children[list.children.length - 1]);
    }
  } catch (e) {
    console.warn("No se pudieron cargar las categorías del menú:", e);
  }
}

/* ---------------- Búsqueda de productos ---------------- */

async function ensureSearchIndex() {
  if (productSearchIndex) return productSearchIndex;
  const snap = await getDocs(collection(db, "productos"));
  productSearchIndex = [];
  snap.forEach((d) => {
    const p = d.data();
    if (p.activo === false) return;
    productSearchIndex.push({
      id: d.id,
      nombre: p.nombre || "",
      precio: p.precio || 0,
      imagen: (p.images && p.images[0]) || "",
    });
  });
  return productSearchIndex;
}

function wireSearch() {
  const input = document.getElementById("navSearchInput");
  const results = document.getElementById("navSearchResults");
  if (!input) return;
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const term = input.value.trim().toLowerCase();
    if (!term) {
      results.innerHTML = "";
      results.classList.remove("open");
      return;
    }
    debounceTimer = setTimeout(async () => {
      const index = await ensureSearchIndex();
      const matches = index.filter((p) => p.nombre.toLowerCase().includes(term)).slice(0, 8);
      renderSearchResults(matches);
    }, 200);
  });
}

function renderSearchResults(matches) {
  const results = document.getElementById("navSearchResults");
  if (!results) return;

  if (matches.length === 0) {
    results.innerHTML = `<div class="nav-search-empty">No se encontraron productos.</div>`;
    results.classList.add("open");
    return;
  }

  results.innerHTML = matches
    .map(
      (p) => `
    <a href="/producto.html?id=${p.id}" class="nav-search-item">
      <img src="${p.imagen ? optimizedUrl(p.imagen, 100) : "https://placehold.co/100x100/f7f0e6/b9a488?text=%20"}" alt="">
      <div>
        <div class="nsi-name">${p.nombre}</div>
        <div class="nsi-price">${formatPrice(p.precio)}</div>
      </div>
    </a>`
    )
    .join("");
  results.classList.add("open");
}
