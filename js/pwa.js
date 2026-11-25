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

const isInAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|Messenger|; wv\)/i.test(navigator.userAgent);

// Espera (hasta 2,5 s) a que el navegador habilite la instalación directa
function waitForPrompt(ms = 2500) {
  return new Promise((resolve) => {
    if (deferredPrompt) return resolve(deferredPrompt);
    const t = setTimeout(() => resolve(null), ms);
    window.addEventListener("beforeinstallprompt", () => { clearTimeout(t); setTimeout(() => resolve(deferredPrompt), 0); }, { once: true });
  });
}

async function installApp(btn) {
  if (isStandalone()) return;
  if (isInAppBrowser()) return showInstallHelp("inapp");
  if (isIos()) return showInstallHelp("ios");
  const original = btn && btn.textContent;
  if (!deferredPrompt && btn) btn.textContent = "Preparando…";
  const prompt = await waitForPrompt();
  if (btn && original) btn.textContent = original;
  if (prompt) {
    prompt.prompt();
    try { await prompt.userChoice; } catch (e) {}
    deferredPrompt = null;
    return;
  }
  showInstallHelp("generic");
}

function showInstallHelp(kind) {
  if (document.getElementById("installHelp")) return;
  const steps = {
    ios: `<ol><li>Abrí esta página en <strong>Safari</strong>.</li><li>Tocá el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba).</li><li>Elegí <strong>“Agregar a pantalla de inicio”</strong> y tocá <strong>Agregar</strong>.</li></ol>`,
    inapp: `<p>Estás viendo la tienda dentro de otra app (Instagram, Facebook, WhatsApp…), que no permite instalar.</p><ol><li>Tocá los tres puntitos <strong>⋮</strong> (o el ícono de compartir) de arriba.</li><li>Elegí <strong>“Abrir en el navegador”</strong> (Chrome o Safari).</li><li>Ahí tocá de nuevo <strong>Descargar la app</strong>.</li></ol><button type="button" class="install-help-copy">Copiar enlace de la tienda</button>`,
    generic: `<ol><li>Abrí el menú del navegador (<strong>⋮</strong> arriba a la derecha).</li><li>Elegí <strong>“Instalar aplicación”</strong> o <strong>“Agregar a pantalla de inicio”</strong>.</li><li>Confirmá. ¡Listo!</li></ol>`,
  }[kind];
  const modal = document.createElement("div");
  modal.id = "installHelp";
  modal.className = "install-help-backdrop";
  modal.innerHTML = `
    <div class="install-help">
      <h3>Descargá la app de Zoë νέος</h3>
      ${steps}
      <button type="button" class="install-help-close">Entendido</button>
    </div>`;
  modal.addEventListener("click", async (e) => {
    if (e.target === modal || e.target.classList.contains("install-help-close")) modal.remove();
    if (e.target.classList.contains("install-help-copy")) {
      try { await navigator.clipboard.writeText(location.origin + "/"); e.target.textContent = "¡Enlace copiado! Pegalo en tu navegador"; } catch (err) { e.target.textContent = location.origin; }
    }
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
  document.querySelectorAll("[data-install]").forEach((btn) => btn.addEventListener("click", () => installApp(btn)));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountInstallUi);
else mountInstallUi();
