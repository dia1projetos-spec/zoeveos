// js/blog-post.js
import { db, collection, getDocs, doc, getDoc, query, where, limit } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { addToCart } from "./cart.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam, formatPrice } from "./utils.js";

await initHeader();

const slug = getParam("slug");
const heroEl = document.getElementById("postHero");
const coverEl = document.getElementById("postCover");
const contentEl = document.getElementById("postContent");
const featuredEl = document.getElementById("featuredProduct");
const relatedEl = document.getElementById("relatedProducts");

async function load() {
  if (!slug) {
    contentEl.innerHTML = `<div class="empty-state">Artículo no encontrado.</div>`;
    return;
  }
  try {
    const q = query(collection(db, "blog"), where("slug", "==", slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      contentEl.innerHTML = `<div class="empty-state">Artículo no encontrado.</div>`;
      return;
    }
    const post = { id: snap.docs[0].id, ...snap.docs[0].data() };
    renderSeo(post);
    renderPost(post);

    if (post.productoDestacadoId) {
      await renderFeaturedProduct(post.productoDestacadoId);
    }
  } catch (e) {
    console.error(e);
    contentEl.innerHTML = `<div class="empty-state">No se pudo cargar el artículo.</div>`;
  }
}

function renderSeo(post) {
  document.title = post.titulo + " · Zoë νέος";
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", post.metaDescription || "");
}

function renderPost(post) {
  const fecha = post.fecha?.toDate ? post.fecha.toDate().toLocaleDateString("es-AR") : "";
  heroEl.innerHTML = `
    <h1>${post.titulo}</h1>
    <div class="post-meta">Zoë νέος · ${fecha}</div>
  `;
  if (post.imagenPortada) {
    coverEl.innerHTML = `<img src="${optimizedUrl(post.imagenPortada, 1200)}" alt="${post.titulo}">`;
  }
  contentEl.innerHTML = post.contenido || "";
}

async function renderFeaturedProduct(productId) {
  const snap = await getDoc(doc(db, "productos", productId));
  if (!snap.exists()) return;
  const p = { id: snap.id, ...snap.data() };
  const img = (p.images && p.images[0]) || "https://placehold.co/600x500/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre);

  featuredEl.innerHTML = `
  <div class="fp-card">
    <div class="fp-img"><img src="${optimizedUrl(img, 700)}" alt="${p.nombre}"></div>
    <div class="fp-info">
      <span class="eyebrow">Producto destacado</span>
      <h3 style="font-family:var(--font-serif);font-size:1.6rem;margin-bottom:10px;">${p.nombre}</h3>
      <div class="price" style="color:var(--pink-dark);font-size:1.3rem;margin-bottom:16px;">${formatPrice(p.precio)}</div>
      <p style="color:var(--text-soft);margin-bottom:20px;">${(p.descripcion || "").slice(0, 140)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="/producto.html?id=${p.id}" class="btn-pill btn-taupe">Ver producto</a>
        <button class="btn-pill btn-pink" id="fpAddBtn">Agregar al carrito</button>
      </div>
    </div>
  </div>`;

  document.getElementById("fpAddBtn").addEventListener("click", () => {
    addToCart({ id: p.id, nombre: p.nombre, precio: p.precio, imagen: img }, 1);
    const btn = document.getElementById("fpAddBtn");
    btn.textContent = "¡Agregado!";
    setTimeout(() => (btn.textContent = "Agregar al carrito"), 1200);
  });

  if (p.subcategoriaId) {
    await renderRelated(p.subcategoriaId, p.id);
  }
}

async function renderRelated(subcategoriaId, excludeId) {
  const q = query(collection(db, "productos"), where("subcategoriaId", "==", subcategoriaId));
  const snap = await getDocs(q);
  const products = [];
  snap.forEach((d) => {
    if (d.id === excludeId) return;
    products.push({ id: d.id, ...d.data() });
  });
  if (products.length === 0) return;

  relatedEl.innerHTML = `
    <h2>También te puede interesar</h2>
    <div class="related-scroll">
      ${products
        .map((p) => {
          const img = (p.images && p.images[0]) || "https://placehold.co/400x320/f7f0e6/b9a488?text=" + encodeURIComponent(p.nombre);
          return `
          <a href="/producto.html?id=${p.id}" class="product-card">
            <div class="product-carousel"><div class="pc-track"><div class="pc-slide active"><img src="${optimizedUrl(img, 400)}" alt="${p.nombre}"></div></div></div>
            <div class="p-info">
              <h3>${p.nombre}</h3>
              <div class="price">${formatPrice(p.precio)}</div>
            </div>
          </a>`;
        })
        .join("")}
    </div>`;
}

load();
