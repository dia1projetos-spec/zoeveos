// admin/js/admin-productos.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";
import { getCachedSubcategorias } from "./admin-subcategorias.js";

let imagesManager;
let editingId = null;
let cachedProductos = [];

export async function initProductosTab() {
  imagesManager = createSlidesManager({
    wrapId: "prodImagesWrap",
    uploadBoxId: "prodUploadBox",
    fileInputId: "prodFileInput",
    progressId: "prodProgress",
  });

  fillSubcategoriaSelect();

  document.getElementById("saveProdBtn").addEventListener("click", saveProducto);
  document.getElementById("cancelProdBtn").addEventListener("click", resetForm);

  await loadProductos();
}

export function getCachedProductos() {
  return cachedProductos;
}

export function fillSubcategoriaSelect() {
  const select = document.getElementById("prodSubcategoriaId");
  const subs = getCachedSubcategorias();
  select.innerHTML = subs.map((s) => `<option value="${s.id}">${s.nombre}</option>`).join("") || `<option value="">Creá una subcategoría primero</option>`;
}

async function loadProductos() {
  const tbody = document.getElementById("prodTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "productos"), orderBy("nombre", "asc"));
  const snap = await getDocs(q);
  cachedProductos = [];
  snap.forEach((d) => cachedProductos.push({ id: d.id, ...d.data() }));

  if (cachedProductos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Todavía no creaste ningún producto.</td></tr>`;
    return;
  }

  const subsById = Object.fromEntries(getCachedSubcategorias().map((s) => [s.id, s.nombre]));

  tbody.innerHTML = cachedProductos
    .map((p) => {
      const thumb = p.images && p.images[0] ? p.images[0] : "";
      return `
      <tr>
        <td>${thumb ? `<img src="${thumb}">` : ""}</td>
        <td>${p.nombre}</td>
        <td>${subsById[p.subcategoriaId] || "—"}</td>
        <td>$${Number(p.precio || 0).toLocaleString("es-AR")}</td>
        <td><span class="badge ${p.activo === false ? "badge-inactive" : "badge-active"}">${p.activo === false ? "Inactivo" : "Activo"}</span></td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${p.id}">Editar</button>
          <button class="btn-danger btn" data-del="${p.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editProducto(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteProducto(btn.dataset.del)));
}

async function editProducto(id) {
  const snap = await getDoc(doc(db, "productos", id));
  if (!snap.exists()) return;
  const p = snap.data();
  editingId = id;
  document.getElementById("prodFormTitle").textContent = "Editar producto";
  document.getElementById("prodNombre").value = p.nombre || "";
  document.getElementById("prodSubcategoriaId").value = p.subcategoriaId || "";
  document.getElementById("prodPrecio").value = p.precio || 0;
  document.getElementById("prodStock").value = p.stock || 0;
  document.getElementById("prodDescripcion").value = p.descripcion || "";
  document.getElementById("prodActivo").checked = p.activo !== false;
  imagesManager.setSlides((p.images || []).map((url) => ({ type: "image", url })));
  document.getElementById("cancelProdBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("prodFormTitle").textContent = "Nuevo producto";
  document.getElementById("prodNombre").value = "";
  document.getElementById("prodPrecio").value = "";
  document.getElementById("prodStock").value = 0;
  document.getElementById("prodDescripcion").value = "";
  document.getElementById("prodActivo").checked = true;
  imagesManager.setSlides([]);
  document.getElementById("cancelProdBtn").style.display = "none";
}

async function saveProducto() {
  const nombre = document.getElementById("prodNombre").value.trim();
  const subcategoriaId = document.getElementById("prodSubcategoriaId").value;
  const precio = Number(document.getElementById("prodPrecio").value) || 0;
  if (!nombre || !subcategoriaId) {
    alert("Completá el nombre y elegí una subcategoría.");
    return;
  }
  const payload = {
    nombre,
    subcategoriaId,
    precio,
    stock: Number(document.getElementById("prodStock").value) || 0,
    descripcion: document.getElementById("prodDescripcion").value.trim(),
    activo: document.getElementById("prodActivo").checked,
    images: imagesManager.getSlides().map((s) => s.url),
  };

  const btn = document.getElementById("saveProdBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "productos", editingId), payload);
    } else {
      await addDoc(collection(db, "productos"), payload);
    }
    showToast("Producto guardado ✓");
    resetForm();
    await loadProductos();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar el producto");
  } finally {
    btn.disabled = false;
  }
}

async function deleteProducto(id) {
  if (!confirm("¿Eliminar este producto?")) return;
  await deleteDoc(doc(db, "productos", id));
  showToast("Producto eliminado");
  await loadProductos();
}
