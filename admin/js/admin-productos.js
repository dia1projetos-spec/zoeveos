// admin/js/admin-productos.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";
import { uploadToCloudinary, optimizedUrl } from "/js/cloudinary.js";
import { getCachedSubcategorias } from "./admin-subcategorias.js";

let imagesManager;
let editingId = null;
let cachedProductos = [];
let variants = []; // [{ id, nombre, imagen, stock }]
let variantFileTargetId = null;

export async function initProductosTab() {
  imagesManager = createSlidesManager({
    wrapId: "prodImagesWrap",
    uploadBoxId: "prodUploadBox",
    fileInputId: "prodFileInput",
    progressId: "prodProgress",
  });

  fillSubcategoriaSelect();

  document.getElementById("addVariantBtn").addEventListener("click", () => {
    variants.push({ id: genId(), nombre: "", imagen: "", stock: 0 });
    renderVariants();
  });

  document.getElementById("variantFileInput").addEventListener("change", onVariantFileChange);

  document.getElementById("saveProdBtn").addEventListener("click", saveProducto);
  document.getElementById("cancelProdBtn").addEventListener("click", resetForm);

  renderVariants();
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

function genId() {
  return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- Variantes ---------------- */

function renderVariants() {
  const wrap = document.getElementById("prodVariantsWrap");
  const simpleStockWrap = document.getElementById("prodStockSimpleWrap");
  simpleStockWrap.style.opacity = variants.length > 0 ? "0.45" : "1";
  document.getElementById("prodStock").disabled = variants.length > 0;

  if (variants.length === 0) {
    wrap.innerHTML = `<p style="font-size:0.85rem;color:var(--text-soft);">Todavía no agregaste ninguna variación.</p>`;
    return;
  }

  wrap.innerHTML = variants
    .map(
      (v) => `
    <div class="variant-row" data-id="${v.id}">
      <div class="variant-thumb" data-thumb="${v.id}">
        ${v.imagen ? `<img src="${optimizedUrl(v.imagen, 120)}">` : `<span>Foto</span>`}
      </div>
      <input type="text" placeholder="Ej: Celeste, Rayas..." value="${v.nombre.replace(/"/g, "&quot;")}" data-field="nombre" data-id="${v.id}">
      <input type="number" placeholder="Stock" value="${v.stock}" data-field="stock" data-id="${v.id}">
      <button type="button" class="remove-variant" data-remove="${v.id}">Eliminar</button>
    </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-thumb]").forEach((el) =>
    el.addEventListener("click", () => {
      variantFileTargetId = el.dataset.thumb;
      document.getElementById("variantFileInput").click();
    })
  );
  wrap.querySelectorAll('input[data-field="nombre"]').forEach((el) =>
    el.addEventListener("input", () => {
      const v = variants.find((x) => x.id === el.dataset.id);
      if (v) v.nombre = el.value;
    })
  );
  wrap.querySelectorAll('input[data-field="stock"]').forEach((el) =>
    el.addEventListener("input", () => {
      const v = variants.find((x) => x.id === el.dataset.id);
      if (v) v.stock = Number(el.value) || 0;
    })
  );
  wrap.querySelectorAll("[data-remove]").forEach((el) =>
    el.addEventListener("click", () => {
      variants = variants.filter((x) => x.id !== el.dataset.remove);
      renderVariants();
    })
  );
}

async function onVariantFileChange(e) {
  const file = e.target.files[0];
  if (!file || !variantFileTargetId) return;
  const v = variants.find((x) => x.id === variantFileTargetId);
  if (!v) return;
  try {
    const result = await uploadToCloudinary(file);
    v.imagen = result.url;
    renderVariants();
  } catch (err) {
    console.error(err);
    alert("Error al subir la imagen de la variación.");
  }
  e.target.value = "";
}

/* ---------------- CRUD de productos ---------------- */

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
        <td>${p.nombre}${p.variantes && p.variantes.length ? ` <span style="font-size:0.75rem;color:var(--text-soft);">(${p.variantes.length} variaciones)</span>` : ""}${p.porEncargo ? ` <span class="badge badge-low">Por encargo</span>` : ""}</td>
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
  document.getElementById("prodPorEncargo").checked = !!p.porEncargo;
  imagesManager.setSlides((p.images || []).map((url) => ({ type: "image", url })));
  variants = (p.variantes || []).map((v) => ({ ...v }));
  renderVariants();
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
  document.getElementById("prodPorEncargo").checked = false;
  imagesManager.setSlides([]);
  variants = [];
  renderVariants();
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

  const variantesLimpias = variants
    .map((v) => ({ id: v.id, nombre: v.nombre.trim(), imagen: v.imagen || "", stock: Number(v.stock) || 0 }))
    .filter((v) => v.nombre);

  if (variants.length > 0 && variantesLimpias.length === 0) {
    alert("Completá el nombre de al menos una variación, o eliminalas todas si no querés usar variaciones.");
    return;
  }

  const payload = {
    nombre,
    subcategoriaId,
    precio,
    stock: Number(document.getElementById("prodStock").value) || 0,
    descripcion: document.getElementById("prodDescripcion").value.trim(),
    activo: document.getElementById("prodActivo").checked,
    porEncargo: document.getElementById("prodPorEncargo").checked,
    images: imagesManager.getSlides().map((s) => s.url),
    variantes: variantesLimpias,
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
