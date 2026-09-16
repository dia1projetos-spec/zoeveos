// js/subcategoria.js
import { db, collection, getDocs, doc, getDoc, query, where } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { addToCart } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam, formatPrice } from "./utils.js";

await initHeader();

const scId = getParam("id");
const heroWrap = document.getElementById("subcatHero");
const childrenGrid = document.getElementById("childrenGrid");
const grid = document.getElementById("productsGrid");

let globalCardIndex = 0;
const allProductsById = {};

async function load() {
  if (!scId) {
    grid.innerHTML = `<div class="empty-state">Subcategoría no encontrada.</div>`;
    return;
  }
  try {
    const scSnap = await getDoc(doc(db, "subcategorias", scId));
    if (!scSnap.exists()) {
      grid.innerHTML = `<div class="empty-state">Subcategoría no encontrada.</div>`;
      return;
    }
    const sc = scSnap.data();
    document.title = sc.nombre + " · Zoë νέος";
    renderHero(sc);

    // Primero nos fijamos si esta subcategoría tiene subcategorías anidadas.
    // Si tiene, mostramos una fila (estilo Netflix) por cada una, con sus productos.
    const childrenQ = query(collection(db, "subcategorias"), where("subcategoriaPadreId", "==", scId));
    const childrenSnap = await getDocs(childrenQ);
    const children = [];
    childrenSnap.forEach((d) => {
      const data = d.data();
      if (data.activo === false) return;
      children.push({ id: d.id, ...data });
    });
    children.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

    if (children.length > 0) {
      await renderNetflixRows(children);
      return;
    }

    await loadProducts();
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty-state">No se pudieron cargar los datos.</div>`;
  }
}

/* ---------------- Filas estilo Netflix (subcategorías anidadas) ---------------- */

async function renderNetflixRows(children) {
  grid.style.display = "none";
  childrenGrid.style.display = "flex";
  childrenGrid.classList.add("netflix-rows");
  childrenGrid.innerHTML = `<div class="empty-state">Cargando...</div>`;

  const rowsHtml = [];
  for (const child of children) {
    const q = query(collection(db, "productos"), where("subcategoriaId", "==", child.id));
    const snap = await getDocs(q);
    const products = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false) return;
      products.push({ id: d.id, ...data });
    });
    products.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
    rowsHtml.push(renderNetflixRow(child, products));
  }

  childrenGrid.innerHTML = rowsHtml.join("");

  childrenGrid.querySelectorAll(".product-carousel[data-images]").forEach((el) => {
    const images = JSON.parse(el.dataset.images || "[]");
    initProductCarousel(el.id, images);
  });
  bindAddButtons(childrenGrid);
  enableDragScroll(childrenGrid);
}

function renderNetflixRow(child, products) {
  if (products.length === 0) {
    return `
    <div class="netflix-row">
      <div class="netflix-row-header">
        <h2>${child.nombre}</h2>
        <a href="/subcategoria.html?id=${child.id}" class="row-link">Ver más →</a>
      </div>
      <div class="empty-state" style="padding:16px 0;text-align:left;">Todavía no hay productos acá.</div>
    </div>`;
  }

  const cardsHtml = products.map((p) => renderProductCard(p, true)).join("");

  return `
  <div class="netflix-row">
    <div class="netflix-row-header">
      <h2>${child.nombre}</h2>
      <a href="/subcategoria.html?id=${child.id}" class="row-link">Ver más →</a>
    </div>
    <div class="netflix-row-scroll" data-drag-scroll>${cardsHtml}</div>
  </div>`;
}

/* ---------------- Grid normal de productos (sin subcategorías anidadas) ---------------- */

async function loadProducts() {
  // Nota: filtramos solo por subcategoriaId (sin orderBy en la consulta) para no
  // depender de un índice compuesto en Firestore. El orden se aplica acá, en el navegador.
  const q = query(collection(db, "productos"), where("subcategoriaId", "==", scId));
  const snap = await getDocs(q);
  const products = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.activo === false) return;
    products.push({ id: d.id, ...data });
  });
  products.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));

  if (products.length === 0) {
    grid.innerHTML = `<div class="empty-state">Todavía no hay productos en esta subcategoría.</div>`;
    return;
  }

  grid.innerHTML = products.map((p) => renderProductCard(p, false)).join("");
  grid.querySelectorAll(".product-carousel[data-images]").forEach((el) => {
    const images = JSON.parse(el.dataset.images || "[]");
    initProductCarousel(el.id, images);
  });
  bindAddButtons(grid);
}

/* ---------------- Banner de la subcategoría ---------------- */

function renderHero(sc) {
  const slides = sc.slides && sc.slides.length ? sc.slides : null;
  if (!slides) {
    heroWrap.innerHTML = `
    <div class="subcat-hero" style="background:var(--cream-dark);">
      <div class="subcat-hero-caption"><h1 style="color:var(--text-main)">${sc.nombre}</h1></div>
    </div>`;
    return;
  }
  heroWrap.innerHTML = `
  <div class="subcat-hero">
    <div class="cb-slides" id="scHeroSlides">
      ${slides
        .map(
          (s, i) => `
        <div class="cb-slide ${i === 0 ? "active" : ""}">
          ${s.type === "video" ? `<video src="${s.url}" autoplay muted loop playsinline></video>` : `<img src="${optimizedUrl(s.url, 1200)}" alt="${sc.nombre}">`}
        </div>`
        )
        .join("")}
      ${slides.length > 1 ? `<div class="cb-dots">${slides.map((_, i) => `<button class="${i === 0 ? "active" : ""}" data-i="${i}"></button>`).join("")}</div>` : ""}
    </div>
    <div class="subcat-hero-caption"><h1>${sc.nombre}</h1></div>
  </div>`;

  if (slides.length > 1) {
    const container = document.getElementById("scHeroSlides");
    const slideEls = container.querySelectorAll(".cb-slide");
    const dotEls = container.querySelectorAll(".cb-dots button");
    let current = 0;
    setInterval(() => {
      slideEls[current].classList.remove("active");
      dotEls[current].classList.remove("active");
      current = (current + 1) % slideEls.length;
      slideEls[current].classList.add("active");
      dotEls[current].classList.add("active");
    }, 5000);
  }
}

/* ---------------- Card de producto (reutilizado en grid normal y en filas Netflix) ---------------- */

function renderProductCard(p, compact) {
  const i = globalCardIndex++;
  allProductsById[p.id] = p;
  const images = p.images && p.images.length ? p.images : ["https://placehold.co/500x400/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre)];
  const hasVariants = p.variantes && p.variantes.length > 0;
  const cardClass = compact ? "product-card product-card-compact" : "product-card";

  return `
  <article class="${cardClass}">
    <a href="/producto.html?id=${p.id}" class="product-carousel" id="pcard-${i}" data-images='${JSON.stringify(images).replace(/'/g, "&#39;")}'>
      <div class="pc-track">
        ${images.map((img, si) => `<div class="pc-slide ${si === 0 ? "active" : ""}"><img src="${optimizedUrl(img, 600)}" alt="${p.nombre}"></div>`).join("")}
      </div>
      ${
        images.length > 1
          ? `<button class="pc-arrow prev" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
             <button class="pc-arrow next" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
             <div class="pc-dots">${images.map((_, si) => `<span class="${si === 0 ? "active" : ""}"></span>`).join("")}</div>`
          : ""
      }
    </a>
    <div class="p-info">
      <h3><a href="/producto.html?id=${p.id}">${p.nombre}</a></h3>
      ${p.porEncargo ? `<span class="badge-encargo" style="margin-bottom:0;">Por encargo</span>` : ""}
      <div class="price">${formatPrice(p.precio)}</div>
      ${
        p.porEncargo
          ? `<a href="/producto.html?id=${p.id}" class="add-btn add-btn-encargo">Consultar</a>`
          : hasVariants
          ? `<a href="/producto.html?id=${p.id}" class="add-btn">Ver opciones</a>`
          : `<button class="add-btn" data-id="${p.id}">Agregar al carrito</button>`
      }
    </div>
  </article>`;
}

function initProductCarousel(id, images) {
  if (!images || images.length <= 1) return;
  const el = document.getElementById(id);
  if (!el) return;
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
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      goTo(current + Number(btn.dataset.dir));
    });
  });
}

function bindAddButtons(container) {
  container.querySelectorAll(".add-btn[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = allProductsById[btn.dataset.id];
      if (!p) return;
      addToCart({ id: p.id, nombre: p.nombre, precio: p.precio, imagen: (p.images && p.images[0]) || "" }, 1);
      btn.textContent = "¡Agregado!";
      setTimeout(() => (btn.textContent = "Agregar al carrito"), 1200);
    });
  });
}

/* ---------------- Arrastrar para el costado (estilo Netflix) con mouse ---------------- */

function enableDragScroll(container) {
  container.querySelectorAll("[data-drag-scroll]").forEach((row) => {
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let moved = false;

    row.addEventListener("mousedown", (e) => {
      isDown = true;
      moved = false;
      row.classList.add("dragging");
      startX = e.pageX;
      scrollStart = row.scrollLeft;
    });
    window.addEventListener("mouseup", () => {
      isDown = false;
      row.classList.remove("dragging");
    });
    row.addEventListener("mouseleave", () => {
      isDown = false;
      row.classList.remove("dragging");
    });
    row.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const delta = e.pageX - startX;
      if (Math.abs(delta) > 5) moved = true;
      row.scrollLeft = scrollStart - delta;
    });
    // Evita que un simple "arrastrón" termine activando el link del producto.
    row.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  });
}

load();
