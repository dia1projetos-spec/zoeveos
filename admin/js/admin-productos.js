// admin/js/admin-productos.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";
import { uploadToCloudinary, optimizedUrl } from "/js/cloudinary.js";
import { getCachedSubcategorias } from "./admin-subcategorias.js";
import { slugify } from "/js/utils.js";

let imagesManager;
let editingId = null;
let cachedProductos = [];
let variants = []; // [{ id, nombre, imagen, stock, precio?, precioTransferencia? }]
let variantFileTargetId = null;
let faqs = []; // [{ q, a }]
let slugTouched = false;
const SITE_URL = "https://www.zoeveos.com";

export async function initProductosTab() {
  imagesManager = createSlidesManager({
    wrapId: "prodImagesWrap",
    uploadBoxId: "prodUploadBox",
    fileInputId: "prodFileInput",
    progressId: "prodProgress",
  });

  fillSubcategoriaSelect();

  document.getElementById("addVariantBtn").addEventListener("click", () => {
    variants.push({ id: genId(), nombre: "", imagen: "", stock: 0, precio: null });
    renderVariants();
  });

  document.getElementById("variantFileInput").addEventListener("change", onVariantFileChange);

  initLanding();
  document.getElementById("saveProdBtn").addEventListener("click", saveProducto);
  document.getElementById("cancelProdBtn").addEventListener("click", resetForm);

  renderVariants();
  await loadProductos();
}

// ---------- Landing page (SEO) ----------
function initLanding() {
  const $ = (id) => document.getElementById(id);
  $("prodLandingActiva").addEventListener("change", toggleLanding);
  $("addFaqBtn").addEventListener("click", () => {
    faqs.push({ q: "", a: "" });
    renderFaqs();
  });
  $("landSlug").addEventListener("input", () => {
    slugTouched = true;
    updateLandingHints();
  });
  $("prodNombre").addEventListener("input", () => {
    if (!slugTouched && $("prodLandingActiva").checked) {
      $("landSlug").value = slugify($("prodNombre").value);
      updateLandingHints();
    }
  });
  $("landSeoTitle").addEventListener("input", updateLandingHints);
  $("landSeoDesc").addEventListener("input", updateLandingHints);
  renderFaqs();
}

function toggleLanding() {
  const on = document.getElementById("prodLandingActiva").checked;
  document.getElementById("landingFields").style.display = on ? "block" : "none";
  const slugEl = document.getElementById("landSlug");
  if (on && !slugEl.value) {
    slugEl.value = slugify(document.getElementById("prodNombre").value);
    const t = document.getElementById("landSeoTitle");
    if (!t.value && document.getElementById("prodNombre").value) t.value = document.getElementById("prodNombre").value.trim() + " | Zoë νέος";
    const d = document.getElementById("landSeoDesc");
    if (!d.value) d.value = (document.getElementById("prodDescripcion").value || "").trim().slice(0, 155);
  }
  updateLandingHints();
}

function updateLandingHints() {
  const $ = (id) => document.getElementById(id);
  const slug = slugify($("landSlug").value);
  $("landUrlPreview").textContent = slug ? `${SITE_URL}/p/${slug}` : "";
  const tl = $("landSeoTitle").value.length;
  const dl = $("landSeoDesc").value.length;
  $("landTitleCount").textContent = `(${tl}/60)`;
  $("landDescCount").textContent = `(${dl}/155)`;
}

function renderFaqs() {
  const wrap = document.getElementById("landFaqWrap");
  wrap.innerHTML = faqs
    .map(
      (f, i) => `
    <div style="display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;">
      <input type="text" placeholder="Pregunta" value="${(f.q || "").replace(/"/g, "&quot;")}" data-faq="q" data-i="${i}">
      <textarea rows="2" placeholder="Respuesta" data-faq="a" data-i="${i}">${(f.a || "").replace(/</g, "&lt;")}</textarea>
      <button type="button" class="remove-variant" data-faq-del="${i}" style="align-self:flex-end;">Eliminar</button>
    </div>`
    )
    .join("");
  wrap.querySelectorAll("[data-faq]").forEach((el) =>
    el.addEventListener("input", () => {
      faqs[Number(el.dataset.i)][el.dataset.faq] = el.value;
    })
  );
  wrap.querySelectorAll("[data-faq-del]").forEach((el) =>
    el.addEventListener("click", () => {
      faqs.splice(Number(el.dataset.faqDel), 1);
      renderFaqs();
    })
  );
}

function readLanding() {
  const $ = (id) => document.getElementById(id);
  const lines = (id) => $(id).value.split("\n").map((s) => s.trim()).filter(Boolean);
  return {
    seoTitle: $("landSeoTitle").value.trim(),
    seoDescription: $("landSeoDesc").value.trim(),
    h1: $("landH1").value.trim(),
    intro: $("landIntro").value.trim(),
    beneficios: lines("landBeneficios"),
    contenido: $("landContenido").value.trim(),
    faqs: faqs.map((f) => ({ q: (f.q || "").trim(), a: (f.a || "").trim() })).filter((f) => f.q && f.a),
    keywords: $("landKeywords").value.trim(),
  };
}

function fillLanding(p) {
  const $ = (id) => document.getElementById(id);
  const l = p.landing || {};
  $("prodLandingActiva").checked = !!p.landingActiva;
  $("landSlug").value = p.landingSlug || "";
  slugTouched = !!p.landingSlug;
  $("landSeoTitle").value = l.seoTitle || "";
  $("landSeoDesc").value = l.seoDescription || "";
  $("landH1").value = l.h1 || "";
  $("landIntro").value = l.intro || "";
  $("landBeneficios").value = (l.beneficios || []).join("\n");
  $("landContenido").value = l.contenido || "";
  $("landKeywords").value = l.keywords || "";
  faqs = (l.faqs || []).map((f) => ({ ...f }));
  renderFaqs();
  $("landingFields").style.display = p.landingActiva ? "block" : "none";
  updateLandingHints();
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

// Sube por la cadena de subcategorías (subcategoriaPadreId) hasta encontrar la categoría
// principal raíz. Así los descuentos "por categoría" funcionan sin importar cuán anidado
// esté el producto.
function resolveCategoriaId(subcategoriaId) {
  const subcats = getCachedSubcategorias();
  let current = subcats.find((s) => s.id === subcategoriaId);
  let guard = 0;
  while (current && !current.categoriaId && current.subcategoriaPadreId && guard < 12) {
    current = subcats.find((s) => s.id === current.subcategoriaPadreId);
    guard++;
  }
  return current?.categoriaId || "";
}

/* ---------------- Variantes ---------------- */

function renderVariants() {
  const wrap = document.getElementById("prodVariantsWrap");
  const simpleStockWrap = document.getElementById("prodStockSimpleWrap");
  document.getElementById("prodStockLabel").textContent = variants.length > 0 ? "Stock del producto principal" : "Stock";

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
      <input type="number" min="0" step="any" placeholder="Precio (opc.)" title="Precio propio de esta variación (opcional). Vacío = usa el precio del producto." value="${v.precio != null && v.precio !== "" ? v.precio : ""}" data-field="precio" data-id="${v.id}">
      <input type="number" min="0" step="any" placeholder="Transf. (opc.)" title="Precio por transferencia de esta variación (opcional)." value="${v.precioTransferencia != null && v.precioTransferencia !== "" ? v.precioTransferencia : ""}" data-field="precioTransferencia" data-id="${v.id}">
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
  wrap.querySelectorAll('input[data-field="precioTransferencia"]').forEach((el) =>
    el.addEventListener("input", () => {
      const v = variants.find((x) => x.id === el.dataset.id);
      if (v) v.precioTransferencia = el.value === "" ? null : Number(el.value);
    })
  );
  wrap.querySelectorAll('input[data-field="precio"]').forEach((el) =>
    el.addEventListener("input", () => {
      const v = variants.find((x) => x.id === el.dataset.id);
      if (v) v.precio = el.value === "" ? null : Number(el.value);
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
        <td>${p.codigo ? `<span style="font-size:0.78rem;color:var(--taupe-dark);">[${p.codigo}]</span> ` : ""}${p.nombre}${p.variantes && p.variantes.length ? ` <span style="font-size:0.75rem;color:var(--text-soft);">(${p.variantes.length} variaciones)</span>` : ""}${p.porEncargo ? ` <span class="badge badge-low">Por encargo</span>` : ""}${p.vendido ? ` <span class="badge badge-zero">Vendido</span>` : ""}${p.landingActiva && p.landingSlug ? ` <a href="/p/${p.landingSlug}" target="_blank" rel="noopener" class="badge badge-active" style="text-decoration:none;">Landing ↗</a>` : ""}</td>
        <td>${subsById[p.subcategoriaId] || "—"}</td>
        <td>$${Number(p.precio || 0).toLocaleString("es-AR")}${p.precioTransferencia ? `<br><span style="font-size:0.75rem;color:var(--text-soft);">Transf. $${Number(p.precioTransferencia).toLocaleString("es-AR")}</span>` : ""}</td>
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
  document.getElementById("prodPrecioTransf").value = p.precioTransferencia || "";
  document.getElementById("prodVendido").checked = !!p.vendido;
  document.getElementById("prodStock").value = p.stock || 0;
  document.getElementById("prodCodigo").value = p.codigo || "";
  document.getElementById("prodDescripcion").value = p.descripcion || "";
  document.getElementById("prodActivo").checked = p.activo !== false;
  document.getElementById("prodPorEncargo").checked = !!p.porEncargo;
  imagesManager.setSlides((p.images || []).map((url) => ({ type: "image", url })));
  variants = (p.variantes || []).map((v) => ({ ...v }));
  renderVariants();
  fillLanding(p);
  document.getElementById("cancelProdBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("prodFormTitle").textContent = "Nuevo producto";
  document.getElementById("prodNombre").value = "";
  document.getElementById("prodPrecio").value = "";
  document.getElementById("prodPrecioTransf").value = "";
  document.getElementById("prodVendido").checked = false;
  document.getElementById("prodStock").value = 0;
  document.getElementById("prodCodigo").value = "";
  document.getElementById("prodDescripcion").value = "";
  document.getElementById("prodActivo").checked = true;
  document.getElementById("prodPorEncargo").checked = false;
  imagesManager.setSlides([]);
  variants = [];
  renderVariants();
  fillLanding({});
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
    .map((v) => ({ id: v.id, nombre: v.nombre.trim(), imagen: v.imagen || "", stock: Number(v.stock) || 0, precio: v.precio != null && v.precio !== "" && Number(v.precio) > 0 ? Number(v.precio) : null, precioTransferencia: Number(v.precioTransferencia) > 0 ? Number(v.precioTransferencia) : null }))
    .filter((v) => v.nombre);

  if (variants.length > 0 && variantesLimpias.length === 0) {
    alert("Completá el nombre de al menos una variación, o eliminalas todas si no querés usar variaciones.");
    return;
  }

  const payload = {
    nombre,
    subcategoriaId,
    categoriaId: resolveCategoriaId(subcategoriaId),
    precio,
    precioTransferencia: Number(document.getElementById("prodPrecioTransf").value) > 0 ? Number(document.getElementById("prodPrecioTransf").value) : null,
    vendido: document.getElementById("prodVendido").checked,
    stock: Number(document.getElementById("prodStock").value) || 0,
    codigo: document.getElementById("prodCodigo").value.trim(),
    descripcion: document.getElementById("prodDescripcion").value.trim(),
    activo: document.getElementById("prodActivo").checked,
    porEncargo: document.getElementById("prodPorEncargo").checked,
    images: imagesManager.getSlides().map((s) => s.url),
    variantes: variantesLimpias,
  };

  // Landing page (opcional)
  const landingActiva = document.getElementById("prodLandingActiva").checked;
  let landingSlug = slugify(document.getElementById("landSlug").value || nombre);
  if (landingActiva) {
    if (!landingSlug) {
      alert("Completá la URL de la landing page.");
      return;
    }
    const duplicado = cachedProductos.some((x) => x.id !== editingId && x.landingActiva && x.landingSlug === landingSlug);
    if (duplicado) {
      alert("Ya existe otra landing con esa URL (" + landingSlug + "). Elegí una distinta.");
      return;
    }
  }
  payload.landingActiva = landingActiva;
  payload.landingSlug = landingActiva ? landingSlug : "";
  payload.landing = landingActiva ? readLanding() : null;
  payload.actualizadoEn = new Date().toISOString();

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
