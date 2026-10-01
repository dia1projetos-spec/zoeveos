// admin/js/admin-descuentos.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { showToast } from "./admin-shared.js";
import { getCachedCategorias } from "./admin-categorias.js";
import { getCachedProductos } from "./admin-productos.js";

let editingId = null;

export async function initDescuentosTab() {
  fillAlcanceSelects();

  document.getElementById("descTipo").addEventListener("change", updateUmbralLabel);
  document.getElementById("descAlcance").addEventListener("change", updateAlcanceVisibility);
  document.getElementById("saveDescBtn").addEventListener("click", saveDescuento);
  document.getElementById("cancelDescBtn").addEventListener("click", resetForm);

  updateUmbralLabel();
  updateAlcanceVisibility();
  await loadDescuentos();
}

export function fillAlcanceSelects() {
  const catSelect = document.getElementById("descAlcanceCategoriaId");
  const cats = getCachedCategorias();
  catSelect.innerHTML = cats.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("") || `<option value="">Creá una categoría primero</option>`;

  const prodSelect = document.getElementById("descAlcanceProductoId");
  const prods = getCachedProductos();
  prodSelect.innerHTML = prods.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("") || `<option value="">Creá un producto primero</option>`;
}

function updateUmbralLabel() {
  const tipo = document.getElementById("descTipo").value;
  document.getElementById("descUmbralLabel").textContent = tipo === "cantidad" ? "Cantidad mínima de unidades" : "Monto mínimo ($)";
  document.getElementById("descUmbral").placeholder = tipo === "cantidad" ? "Ej: 3" : "Ej: 50000";
}

function updateAlcanceVisibility() {
  const alcance = document.getElementById("descAlcance").value;
  document.getElementById("descAlcanceCategoriaWrap").style.display = alcance === "categoria" ? "block" : "none";
  document.getElementById("descAlcanceProductoWrap").style.display = alcance === "producto" ? "block" : "none";
}

async function loadDescuentos() {
  const tbody = document.getElementById("descTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "descuentos"), orderBy("umbral", "asc"));
  const snap = await getDocs(q);
  const descuentos = [];
  snap.forEach((d) => descuentos.push({ id: d.id, ...d.data() }));

  if (descuentos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Todavía no creaste ningún descuento.</td></tr>`;
    return;
  }

  const catsById = Object.fromEntries(getCachedCategorias().map((c) => [c.id, c.nombre]));
  const prodsById = Object.fromEntries(getCachedProductos().map((p) => [p.id, p.nombre]));

  tbody.innerHTML = descuentos
    .map((d) => {
      const condicion = d.tipo === "cantidad" ? `${d.umbral} u. o más` : `$${Number(d.umbral).toLocaleString("es-AR")} o más`;
      const alcanceTxt = d.alcance === "categoria" ? catsById[d.alcanceId] || "—" : d.alcance === "producto" ? prodsById[d.alcanceId] || "—" : "Todos los productos";
      return `
      <tr>
        <td>${d.nombre}</td>
        <td>${condicion}</td>
        <td>${d.porcentaje}% OFF</td>
        <td>${alcanceTxt}</td>
        <td><span class="badge ${d.activo === false ? "badge-inactive" : "badge-active"}">${d.activo === false ? "Inactivo" : "Activo"}</span></td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${d.id}">Editar</button>
          <button class="btn-danger btn" data-del="${d.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editDescuento(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deleteDescuento(btn.dataset.del)));
}

async function editDescuento(id) {
  const snap = await getDoc(doc(db, "descuentos", id));
  if (!snap.exists()) return;
  const d = snap.data();
  editingId = id;
  document.getElementById("descFormTitle").textContent = "Editar descuento";
  document.getElementById("descNombre").value = d.nombre || "";
  document.getElementById("descTipo").value = d.tipo || "monto";
  document.getElementById("descUmbral").value = d.umbral || 0;
  document.getElementById("descPorcentaje").value = d.porcentaje || 0;
  document.getElementById("descAlcance").value = d.alcance || "todos";
  document.getElementById("descActivo").checked = d.activo !== false;
  updateUmbralLabel();
  updateAlcanceVisibility();
  if (d.alcance === "categoria") document.getElementById("descAlcanceCategoriaId").value = d.alcanceId || "";
  if (d.alcance === "producto") document.getElementById("descAlcanceProductoId").value = d.alcanceId || "";
  document.getElementById("cancelDescBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("descFormTitle").textContent = "Nuevo descuento";
  document.getElementById("descNombre").value = "";
  document.getElementById("descTipo").value = "monto";
  document.getElementById("descUmbral").value = "";
  document.getElementById("descPorcentaje").value = "";
  document.getElementById("descAlcance").value = "todos";
  document.getElementById("descActivo").checked = true;
  updateUmbralLabel();
  updateAlcanceVisibility();
  document.getElementById("cancelDescBtn").style.display = "none";
}

async function saveDescuento() {
  const nombre = document.getElementById("descNombre").value.trim();
  const tipo = document.getElementById("descTipo").value;
  const umbral = Number(document.getElementById("descUmbral").value);
  const porcentaje = Number(document.getElementById("descPorcentaje").value);
  const alcance = document.getElementById("descAlcance").value;
  const alcanceId = alcance === "categoria" ? document.getElementById("descAlcanceCategoriaId").value : alcance === "producto" ? document.getElementById("descAlcanceProductoId").value : "";

  if (!nombre || !umbral || umbral <= 0 || !porcentaje || porcentaje <= 0) {
    alert("Completá el nombre, la condición y el porcentaje de descuento.");
    return;
  }
  if ((alcance === "categoria" || alcance === "producto") && !alcanceId) {
    alert("Elegí a qué categoría o producto se aplica.");
    return;
  }

  const payload = {
    nombre,
    tipo,
    umbral,
    porcentaje,
    alcance,
    alcanceId,
    activo: document.getElementById("descActivo").checked,
  };

  const btn = document.getElementById("saveDescBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "descuentos", editingId), payload);
    } else {
      await addDoc(collection(db, "descuentos"), payload);
    }
    showToast("Descuento guardado ✓");
    resetForm();
    await loadDescuentos();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar el descuento");
  } finally {
    btn.disabled = false;
  }
}

async function deleteDescuento(id) {
  if (!confirm("¿Eliminar este descuento?")) return;
  await deleteDoc(doc(db, "descuentos", id));
  showToast("Descuento eliminado");
  await loadDescuentos();
}
