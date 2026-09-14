// admin/js/admin-pedidos.js
import { db, collection, getDocs, doc, updateDoc, query, orderBy } from "/js/firebase-config.js";
import { showToast } from "./admin-shared.js";

export async function initPedidosTab() {
  await loadPedidos();
}

async function loadPedidos() {
  const tbody = document.getElementById("pedidosTableBody");
  tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Cargando...</td></tr>`;
  try {
    const q = query(collection(db, "pedidos"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    const pedidos = [];
    snap.forEach((d) => pedidos.push({ id: d.id, ...d.data() }));

    if (pedidos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Todavía no recibiste pedidos.</td></tr>`;
      return;
    }

    tbody.innerHTML = pedidos.map(renderRow).join("");

    tbody.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => toggleEstado(btn.dataset.toggle, btn.dataset.current))
    );
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Error al cargar los pedidos.</td></tr>`;
  }
}

function renderRow(p) {
  const fecha = p.fecha?.toDate ? p.fecha.toDate().toLocaleString("es-AR") : "—";
  const cliente = p.cliente || {};
  const itemsList = (p.items || []).map((it) => `${it.cantidad}x ${it.nombre}`).join(", ");
  const estado = p.estado || "pendiente";
  return `
  <tr>
    <td>${fecha}</td>
    <td>${cliente.nombre || "—"}<br><span style="font-size:0.78rem;color:var(--text-soft);">${itemsList}</span></td>
    <td>${cliente.whatsapp || "—"}</td>
    <td>${cliente.calle || ""}, ${cliente.ciudad || ""}, ${cliente.region || ""}</td>
    <td>$${Number(p.total || 0).toLocaleString("es-AR")}</td>
    <td><span class="badge badge-${estado}">${estado === "completado" ? "Completado" : "Pendiente"}</span></td>
    <td class="row-actions">
      <button class="btn-secondary btn" data-toggle="${p.id}" data-current="${estado}">
        ${estado === "completado" ? "Marcar pendiente" : "Marcar completado"}
      </button>
    </td>
  </tr>`;
}

async function toggleEstado(id, current) {
  const nuevo = current === "completado" ? "pendiente" : "completado";
  await updateDoc(doc(db, "pedidos", id), { estado: nuevo });
  showToast("Pedido actualizado");
  await loadPedidos();
}
