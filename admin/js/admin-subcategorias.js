// admin/js/admin-subcategorias.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";
import { getCachedCategorias } from "./admin-categorias.js";

let slidesManager;
let editingId = null;
let cachedSubcategorias = [];

export async function initSubcategoriasTab() {
  slidesManager = createSlidesManager({
    wrapId: "subcatSlidesWrap",
    uploadBoxId: "subcatUploadBox",
    fileInputId: "subcatFileInput",
    progressId: "subcatProgress",
  });

  fillCategoriaSelect();

  document.getElementById("saveSubcatBtn").addEventListener("click", saveSubcategoria);
  document.getElementById("cancelSubcatBtn").addEventListener("click", resetForm);

  await loadSubcategorias();
}

export function getCachedSubcategorias() {
  return cachedSubcategorias;
}

export function fillCategoriaSelect() {
  const select = document.getElementById("subcatCategoriaId");
  const cats = getCachedCategorias();
  select.innerHTML = cats.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("") || `<option value="">Creá una categoría primero</option>`;
}

async function loadSubcategorias() {
  const tbody = document.getElementById("subcatTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "subcategorias"), orderBy("orden", "asc"));
  const snap = await getDocs(q);
  cachedSubcategorias = [];
  snap.forEach((d) => cachedSubcategorias.push({ id: d.id, ...d.data() }));

  if (cachedSubcategorias.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Todavía no creaste ninguna subcategoría.</td></tr>`;
    return;
  }

  const catsById = Object.fromEntries(getCachedCategorias().map((c) => [c.id, c.nombre]));

  tbody.innerHTML = cachedSubcategorias
    .map((s) => {
      const thumb = s.slides && s.slides[0] ? s.slides[0].url : "";
      return `
      <tr>
        <td>${thumb ? `<img src="${thumb}">` : ""}</td>
        <td>${s.nombre}</td>
        <td>${catsById[s.categoriaId] || "—"}</td>
        <td><span class="badge ${s.activo === false ? "badge-inactive" : "badge-active"}">${s.activo === false ? "Inactiva" : "Activa"}</span></td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${s.id}">Editar</button>
          <button class="btn-danger btn" data-del="${s.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editSubcategoria(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteSubcategoria(btn.dataset.del)));
}

async function editSubcategoria(id) {
  const snap = await getDoc(doc(db, "subcategorias", id));
  if (!snap.exists()) return;
  const s = snap.data();
  editingId = id;
  document.getElementById("subcatFormTitle").textContent = "Editar subcategoría";
  document.getElementById("subcatNombre").value = s.nombre || "";
  document.getElementById("subcatCategoriaId").value = s.categoriaId || "";
  document.getElementById("subcatOrden").value = s.orden ?? 0;
  document.getElementById("subcatActivo").checked = s.activo !== false;
  slidesManager.setSlides(s.slides || []);
  document.getElementById("cancelSubcatBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("subcatFormTitle").textContent = "Nueva subcategoría";
  document.getElementById("subcatNombre").value = "";
  document.getElementById("subcatOrden").value = 0;
  document.getElementById("subcatActivo").checked = true;
  slidesManager.setSlides([]);
  document.getElementById("cancelSubcatBtn").style.display = "none";
}

async function saveSubcategoria() {
  const nombre = document.getElementById("subcatNombre").value.trim();
  const categoriaId = document.getElementById("subcatCategoriaId").value;
  if (!nombre || !categoriaId) {
    alert("Completá el nombre y elegí una categoría principal.");
    return;
  }
  const payload = {
    nombre,
    categoriaId,
    orden: Number(document.getElementById("subcatOrden").value) || 0,
    activo: document.getElementById("subcatActivo").checked,
    slides: slidesManager.getSlides(),
  };

  const btn = document.getElementById("saveSubcatBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "subcategorias", editingId), payload);
    } else {
      await addDoc(collection(db, "subcategorias"), payload);
    }
    showToast("Subcategoría guardada ✓");
    resetForm();
    await loadSubcategorias();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar la subcategoría");
  } finally {
    btn.disabled = false;
  }
}

async function deleteSubcategoria(id) {
  if (!confirm("¿Eliminar esta subcategoría?")) return;
  await deleteDoc(doc(db, "subcategorias", id));
  showToast("Subcategoría eliminada");
  await loadSubcategorias();
}
