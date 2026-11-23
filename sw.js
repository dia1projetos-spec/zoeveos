// sw.js — Service worker de Zoë νέος
// Estrategia "red primero": siempre se pide la versión más nueva al servidor y la copia guardada
// solo se usa si no hay conexión. Así, después de cada actualización del sitio, el usuario ve la
// página actualizada aunque tenga la app instalada.
// Cambiar VERSION en cada publicación hace que el navegador instale el service worker nuevo
// y la página se recargue sola (ver js/pwa.js).
const VERSION = "2026-11-23.1";
const CACHE = "zoeveos-" + VERSION;

self.addEventListener("install", () => {
  self.skipWaiting(); // activar de inmediato, sin esperar a que se cierren las pestañas
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Cloudinary, fuentes: directo a la red
  if (url.pathname === "/version.json" || url.pathname === "/sw.js") return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const home = await caches.match("/index.html") || (await caches.match("/"));
          if (home) return home;
        }
        throw err;
      }
    })()
  );
});
