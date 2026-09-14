// admin/js/admin-blog.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";
import { getCachedProductos } from "./admin-productos.js";
import { slugify } from "/js/utils.js";

let coverManager;
let editingId = null;
let slugTouched = false;

export async function initBlogTab() {
  coverManager = createSlidesManager({
    wrapId: "blogCoverWrap",
    uploadBoxId: "blogUploadBox",
    fileInputId: "blogFileInput",
    progressId: null,
    max: 1,
    uploadLabel: "Subir portada",
  });

  fillProductoSelect();

  const tituloInput = document.getElementById("blogTitulo");
  const slugInput = document.getElementById("blogSlug");
  tituloInput.addEventListener("input", () => {
    if (!slugTouched) slugInput.value = slugify(tituloInput.value);
  });
  slugInput.addEventListener("input", () => (slugTouched = true));

  document.getElementById("saveBlogBtn").addEventListener("click", saveArticulo);
  document.getElementById("cancelBlogBtn").addEventListener("click", resetForm);

  await loadArticulos();
}

export function fillProductoSelect() {
  const select = document.getElementById("blogProductoId");
  const productos = getCachedProductos();
  select.innerHTML =
    `<option value="">Ninguno</option>` + productos.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("");
}

async function loadArticulos() {
  const tbody = document.getElementById("blogTableBody");
  tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "blog"), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  const posts = [];
  snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));

  if (posts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Todavía no creaste ningún artículo.</td></tr>`;
    return;
  }

  tbody.innerHTML = posts
    .map((p) => {
      const fecha = p.fecha?.toDate ? p.fecha.toDate().toLocaleDateString("es-AR") : "—";
      return `
      <tr>
        <td>${p.imagenPortada ? `<img src="${p.imagenPortada}">` : ""}</td>
        <td>${p.titulo}<br><a href="/blog-post.html?slug=${p.slug}" target="_blank" style="font-size:0.78rem;color:var(--taupe-dark);">Ver landing page →</a></td>
        <td>${fecha}</td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${p.id}">Editar</button>
          <button class="btn-danger btn" data-del="${p.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editArticulo(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteArticulo(btn.dataset.del)));
}

async function editArticulo(id) {
  const snap = await getDoc(doc(db, "blog", id));
  if (!snap.exists()) return;
  const p = snap.data();
  editingId = id;
  slugTouched = true;
  document.getElementById("blogFormTitle").textContent = "Editar artículo";
  document.getElementById("blogTitulo").value = p.titulo || "";
  document.getElementById("blogSlug").value = p.slug || "";
  document.getElementById("blogMetaDesc").value = p.metaDescription || "";
  document.getElementById("blogContenido").value = p.contenido || "";
  document.getElementById("blogProductoId").value = p.productoDestacadoId || "";
  coverManager.setSlides(p.imagenPortada ? [{ type: "image", url: p.imagenPortada }] : []);
  document.getElementById("cancelBlogBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  slugTouched = false;
  document.getElementById("blogFormTitle").textContent = "Nuevo artículo";
  document.getElementById("blogTitulo").value = "";
  document.getElementById("blogSlug").value = "";
  document.getElementById("blogMetaDesc").value = "";
  document.getElementById("blogContenido").value = "";
  document.getElementById("blogProductoId").value = "";
  coverManager.setSlides([]);
  document.getElementById("cancelBlogBtn").style.display = "none";
}

async function saveArticulo() {
  const titulo = document.getElementById("blogTitulo").value.trim();
  const slug = document.getElementById("blogSlug").value.trim() || slugify(titulo);
  if (!titulo) {
    alert("Ingresá el título del artículo.");
    return;
  }
  const cover = coverManager.getSlides();
  const payload = {
    titulo,
    slug,
    metaDescription: document.getElementById("blogMetaDesc").value.trim(),
    contenido: document.getElementById("blogContenido").value,
    productoDestacadoId: document.getElementById("blogProductoId").value || null,
    imagenPortada: cover.length ? cover[0].url : "",
  };

  const btn = document.getElementById("saveBlogBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "blog", editingId), payload);
    } else {
      await addDoc(collection(db, "blog"), { ...payload, fecha: serverTimestamp() });
    }
    showToast("Artículo guardado ✓");
    resetForm();
    await loadArticulos();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar el artículo");
  } finally {
    btn.disabled = false;
  }
}

async function deleteArticulo(id) {
  if (!confirm("¿Eliminar este artículo?")) return;
  await deleteDoc(doc(db, "blog", id));
  showToast("Artículo eliminado");
  await loadArticulos();
}
