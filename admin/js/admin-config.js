// admin/js/admin-config.js
import { db, doc, getDoc, setDoc } from "/js/firebase-config.js";
import { createSlidesManager, showToast } from "./admin-shared.js";

let logoManager;

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
      if (data.logoUrl) logoManager.setSlides([{ type: "image", url: data.logoUrl }]);
    }
  } catch (e) {
    console.error(e);
  }

  document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
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
