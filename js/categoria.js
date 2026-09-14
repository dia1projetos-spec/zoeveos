// js/categoria.js
import { db, collection, getDocs, doc, getDoc, query, where, orderBy } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { optimizedUrl } from "./cloudinary.js";
import { getParam } from "./utils.js";

await initHeader();

const catId = getParam("id");
const titleEl = document.getElementById("pageTitle");
const descEl = document.getElementById("pageDesc");
const grid = document.getElementById("subcatGrid");

async function load() {
  if (!catId) {
    grid.innerHTML = `<div class="empty-state">Categoría no encontrada.</div>`;
    return;
  }
  try {
    const catSnap = await getDoc(doc(db, "categorias", catId));
    if (catSnap.exists()) {
      titleEl.textContent = catSnap.data().nombre;
      descEl.textContent = catSnap.data().descripcion || "";
      document.title = catSnap.data().nombre + " · Zoë νέος";
    }

    const q = query(collection(db, "subcategorias"), where("categoriaId", "==", catId), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    const subcats = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false) return;
      subcats.push({ id: d.id, ...data });
    });

    if (subcats.length === 0) {
      grid.innerHTML = `<div class="empty-state">Todavía no hay subcategorías en esta categoría.</div>`;
      return;
    }

    grid.innerHTML = subcats.map(renderCard).join("");
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty-state">No se pudieron cargar las subcategorías.</div>`;
  }
}

function renderCard(sc) {
  const cover = sc.slides && sc.slides.length ? sc.slides[0] : null;
  const media = cover
    ? cover.type === "video"
      ? `<video src="${cover.url}" autoplay muted loop playsinline></video>`
      : `<img src="${optimizedUrl(cover.url, 600)}" alt="${sc.nombre}">`
    : `<img src="https://placehold.co/600x400/f7f0e6/b9a488?text=${encodeURIComponent(sc.nombre)}" alt="${sc.nombre}">`;

  return `
  <a class="subcat-card" href="/subcategoria.html?id=${sc.id}">
    <div class="thumb">${media}</div>
    <div class="info">
      <h3>${sc.nombre}</h3>
      <span>Ver más →</span>
    </div>
  </a>`;
}

load();
