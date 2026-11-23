// admin/js/admin-config.js
import { db, doc, getDoc, setDoc } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";

let logoManager;
let metodos = []; // [{ nombre, tipo, valor }]

export async function initConfigTab() {
  logoManager = createSlidesManager({
    wrapId: "logoPreviewWrap",
    uploadBoxId: "logoUploadBox",
    fileInputId: "logoInput",
    progressId: "logoProgress",
    max: 1,
    uploadLabel: "Subir logo",
    initial: [],
  });

  try {
    const snap = await getDoc(doc(db, "config", "site"));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("siteName").value = data.siteName || "";
      document.getElementById("whatsappNumber").value = data.whatsappNumber || "";
      document.getElementById("envioGratisMonto").value = data.envioGratisMonto || 0;
      metodos = Array.isArray(data.metodosPago) ? data.metodosPago.map((m) => ({ ...m })) : [];
      if (data.logoUrl) logoManager.setSlides([{ type: "image", url: data.logoUrl }]);
    }
  } catch (e) {
    console.error(e);
  }

  document.getElementById("addMetodoBtn").addEventListener("click", () => {
    metodos.push({ nombre: "", tipo: "sin_recargo", valor: 0 });
    renderMetodos();
  });
  renderMetodos();
  document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
}

function renderMetodos() {
  const wrap = document.getElementById("metodosPagoWrap");
  if (!metodos.length) {
    wrap.innerHTML = `<p style="font-size:0.85rem;color:var(--text-soft);">Todavía no cargaste medios de pago.</p>`;
    return;
  }
  wrap.innerHTML = metodos
    .map(
      (m, i) => `
    <div class="variant-row" data-i="${i}">
      <input type="text" placeholder="Ej: Transferencia, Tarjeta, Mercado Pago" value="${(m.nombre || "").replace(/"/g, "&quot;")}" data-f="nombre" data-i="${i}">
      <select data-f="tipo" data-i="${i}" style="padding:9px 11px;border-radius:8px;border:1px solid var(--line);font-family:inherit;background:#fff;">
        <option value="transferencia" ${m.tipo === "transferencia" ? "selected" : ""}>Precio por transferencia</option>
        <option value="sin_recargo" ${m.tipo === "sin_recargo" ? "selected" : ""}>Sin recargo</option>
        <option value="fijo" ${m.tipo === "fijo" ? "selected" : ""}>Recargo en $ (ARS)</option>
        <option value="porcentaje" ${m.tipo === "porcentaje" ? "selected" : ""}>Recargo en %</option>
      </select>
      <input type="number" min="0" step="any" placeholder="Valor" value="${m.valor || ""}" data-f="valor" data-i="${i}" ${m.tipo === "fijo" || m.tipo === "porcentaje" ? "" : "disabled"}>
      <button type="button" class="remove-variant" data-del="${i}">Eliminar</button>
    </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-f]").forEach((el) =>
    el.addEventListener("input", () => {
      const m = metodos[Number(el.dataset.i)];
      if (!m) return;
      m[el.dataset.f] = el.dataset.f === "valor" ? Number(el.value) || 0 : el.value;
    })
  );
  wrap.querySelectorAll('select[data-f="tipo"]').forEach((el) =>
    el.addEventListener("change", renderMetodos)
  );
  wrap.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", () => {
      metodos.splice(Number(el.dataset.del), 1);
      renderMetodos();
    })
  );
}

async function saveConfig() {
  const btn = document.getElementById("saveConfigBtn");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  const slides = logoManager.getSlides();

  try {
    await setDoc(
      doc(db, "config", "site"),
      {
        siteName: document.getElementById("siteName").value.trim(),
        whatsappNumber: document.getElementById("whatsappNumber").value.trim(),
        envioGratisMonto: Number(document.getElementById("envioGratisMonto").value) || 0,
        metodosPago: metodos
          .filter((m) => (m.nombre || "").trim())
          .map((m) => ({
            nombre: m.nombre.trim(),
            tipo: m.tipo,
            valor: m.tipo === "fijo" || m.tipo === "porcentaje" ? Number(m.valor) || 0 : 0,
          })),
        logoUrl: slides.length ? slides[0].url : "",
      },
      { merge: true }
    );
    showToast("Configuración guardada ✓");
  } catch (e) {
    console.error(e);
    showToast("Error al guardar");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar configuración";
  }
}
