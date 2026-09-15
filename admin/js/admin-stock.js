// admin/js/admin-stock.js
import { db, doc, updateDoc } from "/js/firebase-config.js";
import { showToast } from "./admin-shared.js";
import { getCachedProductos } from "./admin-productos.js";
import { getCachedSubcategorias } from "./admin-subcategorias.js";

export async function initStockTab() {
  fillSubcatFilter();
  document.getElementById("stockSearch").addEventListener("input", renderStockTable);
  document.getElementById("stockFilterSubcat").addEventListener("change", renderStockTable);
  document.getElementById("stockFilterLevel").addEventListener("change", renderStockTable);
  renderStockTable();
}

// Se llama cada vez que se entra a la pestaña, para reflejar productos nuevos/editados.
export function refreshStockTab() {
  fillSubcatFilter();
  renderStockTable();
}

function fillSubcatFilter() {
  const select = document.getElementById("stockFilterSubcat");
  const current = select.value;
  const subs = getCachedSubcategorias();
  select.innerHTML = `<option value="">Todas</option>` + subs.map((s) => `<option value="${s.id}">${s.nombre}</option>`).join("");
  select.value = current;
}

function buildRows() {
  const subsById = Object.fromEntries(getCachedSubcategorias().map((s) => [s.id, s.nombre]));
  const rows = [];
  getCachedProductos().forEach((p) => {
    const subNombre = subsById[p.subcategoriaId] || "—";
    if (p.variantes && p.variantes.length > 0) {
      p.variantes.forEach((v) => {
        rows.push({
          productoId: p.id,
          nombre: p.nombre,
          variante: v.nombre,
          varianteId: v.id,
          subNombre,
          subcategoriaId: p.subcategoriaId,
          thumb: v.imagen || (p.images && p.images[0]) || "",
          stock: Number(v.stock) || 0,
        });
      });
    } else {
      rows.push({
        productoId: p.id,
        nombre: p.nombre,
        variante: "—",
        varianteId: null,
        subNombre,
        subcategoriaId: p.subcategoriaId,
        thumb: (p.images && p.images[0]) || "",
        stock: Number(p.stock) || 0,
      });
    }
  });
  return rows;
}

function renderStockTable() {
  const tbody = document.getElementById("stockTableBody");
  const search = document.getElementById("stockSearch").value.trim().toLowerCase();
  const subcatFilter = document.getElementById("stockFilterSubcat").value;
  const levelFilter = document.getElementById("stockFilterLevel").value;

  let rows = buildRows();

  if (search) rows = rows.filter((r) => r.nombre.toLowerCase().includes(search));
  if (subcatFilter) rows = rows.filter((r) => r.subcategoriaId === subcatFilter);
  if (levelFilter === "bajo") rows = rows.filter((r) => r.stock > 0 && r.stock <= 5);
  if (levelFilter === "sin") rows = rows.filter((r) => r.stock <= 0);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No hay productos que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const badge = r.stock <= 0 ? `<span class="badge badge-zero">Sin stock</span>` : r.stock <= 5 ? `<span class="badge badge-low">Stock bajo</span>` : "";
      return `
      <tr>
        <td>${r.thumb ? `<img src="${r.thumb}">` : ""}</td>
        <td>${r.nombre}</td>
        <td>${r.variante}</td>
        <td>${r.subNombre}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="number" class="stock-input" min="0" value="${r.stock}" data-producto="${r.productoId}" data-variante="${r.varianteId || ""}">
            ${badge}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".stock-input").forEach((input) => {
    input.addEventListener("change", () => onStockChange(input));
  });
}

async function onStockChange(input) {
  const productoId = input.dataset.producto;
  const varianteId = input.dataset.variante;
  const nuevoValor = Math.max(0, Number(input.value) || 0);
  input.value = nuevoValor;

  const producto = getCachedProductos().find((p) => p.id === productoId);
  if (!producto) return;

  try {
    if (varianteId) {
      const variantes = (producto.variantes || []).map((v) => (v.id === varianteId ? { ...v, stock: nuevoValor } : v));
      await updateDoc(doc(db, "productos", productoId), { variantes });
      producto.variantes = variantes; // mantiene el cache en memoria sincronizado
    } else {
      await updateDoc(doc(db, "productos", productoId), { stock: nuevoValor });
      producto.stock = nuevoValor;
    }
    showToast("Stock actualizado ✓");
    renderStockTable();
  } catch (e) {
    console.error(e);
    showToast("Error al actualizar el stock");
  }
}
