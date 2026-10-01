// js/popup.js
// Muestra el popup promocional configurado en el panel (si hay alguno activo), después del
// retraso indicado. Se muestra una sola vez por visita (se guarda en sessionStorage).

import { db, collection, getDocs, query, where, limit } from "./firebase-config.js";

const SESSION_KEY_PREFIX = "zoeveos_popup_shown_";

export async function initPopup() {
  try {
    const q = query(collection(db, "popups"), where("activo", "==", true), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const popup = { id: snap.docs[0].id, ...snap.docs[0].data() };
    if (!popup.media?.url) return;

    if (sessionStorage.getItem(SESSION_KEY_PREFIX + popup.id)) return;

    const delayMs = Math.max(0, Number(popup.delay) || 0) * 1000;
    setTimeout(() => showPopup(popup), delayMs);
  } catch (e) {
    console.warn("No se pudo cargar el popup:", e);
  }
}

function showPopup(popup) {
  sessionStorage.setItem(SESSION_KEY_PREFIX + popup.id, "1");

  const mediaHtml =
    popup.media.type === "video"
      ? `<video src="${popup.media.url}" autoplay muted loop playsinline></video>`
      : `<img src="${popup.media.url}" alt="${popup.nombre || ""}">`;

  const overlay = document.createElement("div");
  overlay.className = "promo-popup-overlay";
  overlay.innerHTML = `
    <div class="promo-popup-box">
      <div class="promo-popup-media">${mediaHtml}</div>
      <div class="promo-popup-actions">
        <button type="button" class="btn-pill btn-taupe" id="promoPopupClose">Cerrar</button>
        ${popup.link ? `<a href="${popup.link}" class="btn-pill btn-pink" id="promoPopupMore">Ver más</a>` : ""}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  function close() {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 250);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#promoPopupClose").addEventListener("click", close);
}

initPopup();
