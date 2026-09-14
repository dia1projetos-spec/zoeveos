// js/blog.js
import { db, collection, getDocs, query, orderBy } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { optimizedUrl } from "./cloudinary.js";

await initHeader();

const grid = document.getElementById("blogGrid");

async function load() {
  try {
    const q = query(collection(db, "blog"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    const posts = [];
    snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));

    if (posts.length === 0) {
      grid.innerHTML = `<div class="empty-state">Todavía no hay artículos publicados.</div>`;
      return;
    }

    grid.innerHTML = posts.map(renderCard).join("");
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty-state">No se pudieron cargar los artículos.</div>`;
  }
}

function renderCard(post) {
  const fecha = post.fecha?.toDate ? post.fecha.toDate().toLocaleDateString("es-AR") : "";
  const cover = post.imagenPortada
    ? optimizedUrl(post.imagenPortada, 600)
    : "https://placehold.co/600x400/f7f0e6/b9a488?text=Blog";
  return `
  <a class="blog-card" href="/blog-post.html?slug=${post.slug}">
    <img src="${cover}" alt="${post.titulo}">
    <div class="bc-info">
      <span class="date">${fecha}</span>
      <h3>${post.titulo}</h3>
      <p>${post.metaDescription || ""}</p>
    </div>
  </a>`;
}

load();
