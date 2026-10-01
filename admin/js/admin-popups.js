// admin/js/admin-popups.js
import { db, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";

let mediaManager;
let editingId = null;

export async function initPopupsTab() {
  mediaManager = createSlidesManager({
    wrapId: "popupMediaWrap",
    uploadBoxId: "popupUploadBox",
    fileInputId: "popupFileInput",
    progressId: "popupProgress",
    max: 1,
    uploadLabel: "Subir archivo",
  });

  document.getElementById("savePopupBtn").addEventListener("click", savePopup);
  document.getElementById("cancelPopupBtn").addEventListener("click", resetForm);

  await loadPopups();
}

async function loadPopups() {
  const tbody = document.getElementById("popupTableBody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Cargando...</td></tr>`;
  const q = query(collection(db, "popups"), orderBy("nombre", "asc"));
  const snap = await getDocs(q);
  const popups = [];
  snap.forEach((d) => popups.push({ id: d.id, ...d.data() }));

  if (popups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Todavía no creaste ningún popup.</td></tr>`;
    return;
  }

  tbody.innerHTML = popups
    .map((p) => {
      const thumb = p.media?.url
        ? p.media.type === "video"
          ? `<video src="${p.media.url}" muted style="width:44px;height:44px;object-fit:cover;border-radius:8px;"></video>`
          : `<img src="${p.media.url}">`
        : "";
      return `
      <tr>
        <td>${thumb}</td>
        <td>${p.nombre}</td>
        <td>${p.delay ?? 3}s</td>
        <td>${p.link ? `<span style="font-size:0.8rem;color:var(--text-soft);">${p.link}</span>` : "—"}</td>
        <td><span class="badge ${p.activo ? "badge-active" : "badge-inactive"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
        <td class="row-actions">
          <button class="btn-secondary btn" data-edit="${p.id}">Editar</button>
          <button class="btn-danger btn" data-del="${p.id}">Eliminar</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editPopup(btn.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deletePopup(btn.dataset.del)));
}

async function editPopup(id) {
  const snap = await getDoc(doc(db, "popups", id));
  if (!snap.exists()) return;
  const p = snap.data();
  editingId = id;
  document.getElementById("popupFormTitle").textContent = "Editar popup";
  document.getElementById("popupNombre").value = p.nombre || "";
  document.getElementById("popupDelay").value = p.delay ?? 3;
  document.getElementById("popupLink").value = p.link || "";
  document.getElementById("popupActivo").checked = !!p.activo;
  mediaManager.setSlides(p.media?.url ? [p.media] : []);
  document.getElementById("cancelPopupBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  document.getElementById("popupFormTitle").textContent = "Nuevo popup";
  document.getElementById("popupNombre").value = "";
  document.getElementById("popupDelay").value = 3;
  document.getElementById("popupLink").value = "";
  document.getElementById("popupActivo").checked = false;
  mediaManager.setSlides([]);
  document.getElementById("cancelPopupBtn").style.display = "none";
}

async function savePopup() {
  const nombre = document.getElementById("popupNombre").value.trim();
  const media = mediaManager.getSlides()[0] || null;

  if (!nombre) {
    alert("Ingresá un nombre para identificar el popup.");
    return;
  }
  if (!media) {
    alert("Subí una imagen o un video para el popup.");
    return;
  }

  const payload = {
    nombre,
    media: { type: media.type, url: media.url },
    delay: Number(document.getElementById("popupDelay").value) || 0,
    link: document.getElementById("popupLink").value.trim(),
    activo: document.getElementById("popupActivo").checked,
  };

  const btn = document.getElementById("savePopupBtn");
  btn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(db, "popups", editingId), payload);
    } else {
      await addDoc(collection(db, "popups"), payload);
    }
    showToast("Popup guardado ✓");
    resetForm();
    await loadPopups();
  } catch (e) {
    console.error(e);
    showToast("Error al guardar el popup");
  } finally {
    btn.disabled = false;
  }
}

async function deletePopup(id) {
  if (!confirm("¿Eliminar este popup?")) return;
  await deleteDoc(doc(db, "popups", id));
  showToast("Popup eliminado");
  await loadPopups();
}
