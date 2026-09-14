// admin/js/admin-categorias.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";

let slidesManager;
let editingId = null;
let cachedCategorias = [];

export async function initCategoriasTab() {
  slidesManager = createSlidesManager({
    wrapId: "catSlidesWrap",
    uploadBoxId: "catUploadBox",
    fileInputId: "catFileInput",
    progressId: "catProgress",
  });

  document.getElementById("saveCatBtn").addEventListener("click", saveCategoria);
  document.getElementById("cancelCatBtn").addEventListener("click", resetForm);

  await loadCategorias();
}

export function getCachedCategorias() {
  return cachedCategorias;
}

async function loadCategorias() {
  const tbody = document.getElementById("catTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "categorias"), orderBy("orden", "asc"));
  const snap = await getDocs(q);
  cachedCategorias = [];
  snap.forEach((d) => cachedCategorias.push({ id: d.id, ...d.data() }));

  if (cachedCategorias.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Todavía no creaste ninguna categoría.</td></tr>`;
    return;
  }

  tbody.innerHTML = cachedCategorias
    .map((c) => {
      const thumb = c.slides && c.slides[0] ? c.slides[0].url : "";
      return `
      <tr>
        <td>${thumb ? `<img src="${thumb}">` : ""}</td>
        <td>${c.nombre}</td>
        <td>${c.orden ?? 0}</td>
        <td><span class="badge ${c.activo === false ? "badge-inactive" : "badge-active"}">${c.activo === false ? "Inactiva" : "Activa"}</span></td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${c.id}">Editar</button>
          <button class="btn-danger btn" data-del="${c.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editCategoria(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteCategoria(btn.dataset.del)));
}

async function editCategoria(id) {
  const snap = await getDoc(doc(db, "categorias", id));
  if (!snap.exists()) return;
  const c = snap.data();
  editingId = id;
  document.getElementById("catFormTitle").textContent = "Editar categoría";
  document.getElementById("catNombre").value = c.nombre || "";
  document.getElementById("catOrden").value = c.orden ?? 0;
  document.getElementById("catDescripcion").value = c.descripcion || "";
  document.getElementById("catActivo").checked = c.activo !== false;
  slidesManager.setSlides(c.slides || []);
  document.getElementById("cancelCatBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("catFormTitle").textContent = "Nueva categoría";
  document.getElementById("catNombre").value = "";
  document.getElementById("catOrden").value = 0;
  document.getElementById("catDescripcion").value = "";
  document.getElementById("catActivo").checked = true;
  slidesManager.setSlides([]);
  document.getElementById("cancelCatBtn").style.display = "none";
}

async function saveCategoria() {
  const nombre = document.getElementById("catNombre").value.trim();
  if (!nombre) {
    alert("Ingresá el nombre de la categoría.");
    return;
  }
  const payload = {
    nombre,
    orden: Number(document.getElementById("catOrden").value) || 0,
    descripcion: document.getElementById("catDescripcion").value.trim(),
    activo: document.getElementById("catActivo").checked,
    slides: slidesManager.getSlides(),
  };

  const btn = document.getElementById("saveCatBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "categorias", editingId), payload);
    } else {
      await addDoc(collection(db, "categorias"), payload);
    }
    showToast("Categoría guardada ✓");
    resetForm();
    await loadCategorias();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar la categoría");
  } finally {
    btn.disabled = false;
  }
}

async function deleteCategoria(id) {
  if (!confirm("¿Eliminar esta categoría? Esto no elimina sus subcategorías automáticamente.")) return;
  await deleteDoc(doc(db, "categorias", id));
  showToast("Categoría eliminada");
  await loadCategorias();
}
