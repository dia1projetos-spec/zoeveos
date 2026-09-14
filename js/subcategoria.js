// js/subcategoria.js
import { db, collection, getDocs, doc, getDoc, query, where } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { initCartUI, addToCart } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam, formatPrice } from "./utils.js";

await initHeader();

const scId = getParam("id");
const heroWrap = document.getElementById("subcatHero");
const grid = document.getElementById("productsGrid");

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

    grid.innerHTML = products.map((p, i) => renderProductCard(p, i)).join("");
    products.forEach((p, i) => initProductCarousel(`pcard-${i}`, p.images || []));
    bindAddButtons(products);
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty-state">No se pudieron cargar los productos.</div>`;
  }
}

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

function renderProductCard(p, i) {
  const images = p.images && p.images.length ? p.images : ["https://placehold.co/500x400/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre)];
  return `
  <article class="product-card">
    <a href="/producto.html?id=${p.id}" class="product-carousel" id="pcard-${i}">
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
      <div class="price">${formatPrice(p.precio)}</div>
      <button class="add-btn" data-id="${p.id}">Agregar al carrito</button>
    </div>
  </article>`;
}

function initProductCarousel(id, images) {
  if (!images || images.length <= 1) return;
  const el = document.getElementById(id);
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

function bindAddButtons(products) {
  grid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = products.find((x) => x.id === btn.dataset.id);
      addToCart({ id: p.id, nombre: p.nombre, precio: p.precio, imagen: (p.images && p.images[0]) || "" }, 1);
      btn.textContent = "¡Agregado!";
      setTimeout(() => (btn.textContent = "Agregar al carrito"), 1200);
    });
  });
}

load();
