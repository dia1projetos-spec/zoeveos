// js/pwa.js
// 1) Registra el service worker y fuerza la actualización: cuando hay una versión nueva del sitio,
//    la página se recarga sola, incluso si el usuario tiene la app instalada.
// 2) Maneja la instalación de la app: barra superior en la home + botones "Descargar la app".

/* ---------------- Actualización obligatoria ---------------- */
const hadController = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
let reloading = false;
function reloadOnce() {
  if (reloading) return;
  // No interrumpir el formulario de checkout mientras el cliente lo completa
  if (location.pathname.startsWith("/checkout")) return;
  reloading = true;
  location.reload();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reloadOnce(); // un service worker nuevo tomó el control → versión nueva
  });
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
      window.addEventListener("focus", check);
      setInterval(check, 10 * 60 * 1000);
    } catch (e) {
      console.warn("No se pudo registrar el service worker:", e);
    }
  });
}

// Respaldo: version.json. Si cambió respecto de la versión con la que cargó la página, recarga.
let loadedVersion = null;
async function checkVersion() {
  try {
    const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    const { version } = await res.json();
    if (loadedVersion === null) loadedVersion = version;
    else if (version !== loadedVersion) reloadOnce();
  } catch (e) { /* sin conexión */ }
}
checkVersion();
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkVersion(); });
setInterval(checkVersion, 5 * 60 * 1000);

/* ---------------- Instalación de la app ---------------- */
let deferredPrompt = null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  document.querySelectorAll(".js-install-hide").forEach((el) => el.remove());
});

async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) {}
    deferredPrompt = null;
    return;
  }
  showInstallHelp();
}

function showInstallHelp() {
  if (document.getElementById("installHelp")) return;
  const steps = isIos()
    ? `<ol><li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) en Safari.</li><li>Elegí <strong>“Agregar a pantalla de inicio”</strong>.</li><li>Tocá <strong>Agregar</strong>. ¡Listo!</li></ol>`
    : `<ol><li>Abrí el menú del navegador (los tres puntitos <strong>⋮</strong>).</li><li>Elegí <strong>“Instalar aplicación”</strong> o <strong>“Agregar a pantalla de inicio”</strong>.</li><li>Confirmá. ¡Listo!</li></ol>`;
  const modal = document.createElement("div");
  modal.id = "installHelp";
  modal.className = "install-help-backdrop";
  modal.innerHTML = `
    <div class="install-help">
      <h3>Descargá la app de Zoë νέος</h3>
      <p>Tenela en tu pantalla de inicio, como cualquier otra app:</p>
      ${steps}
      <button type="button" class="install-help-close">Entendido</button>
    </div>`;
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("install-help-close")) modal.remove();
  });
  document.body.appendChild(modal);
}

function mountInstallUi() {
  if (isStandalone()) return;
  const isHome = location.pathname === "/" || location.pathname === "/index.html";
  if (isHome && !sessionStorage.getItem("zoeveos_install_bar_closed")) {
    const bar = document.createElement("div");
    bar.className = "install-bar js-install-hide";
    bar.innerHTML = `
      <span class="install-bar-text">📲 <strong>Descargá nuestra app</strong> y comprá más rápido</span>
      <button type="button" class="install-bar-btn" data-install>Descargar app</button>
      <button type="button" class="install-bar-close" aria-label="Cerrar">✕</button>`;
    bar.querySelector(".install-bar-close").addEventListener("click", () => {
      try { sessionStorage.setItem("zoeveos_install_bar_closed", "1"); } catch (e) {}
      bar.remove();
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }
  document.querySelectorAll("[data-install]").forEach((btn) => btn.addEventListener("click", installApp));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountInstallUi);
else mountInstallUi();
