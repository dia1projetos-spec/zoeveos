// admin/js/admin-app.js
import { auth, onAuthStateChanged, signOut } from "/js/firebase-config.js";
import { initConfigTab } from "./admin-config.js";
import { initCategoriasTab } from "./admin-categorias.js";
import { initSubcategoriasTab, fillCategoriaSelect } from "./admin-subcategorias.js";
import { initProductosTab, fillSubcategoriaSelect } from "./admin-productos.js";
import { initStockTab, refreshStockTab } from "./admin-stock.js";
import { initPedidosTab } from "./admin-pedidos.js";
import { initBlogTab, fillProductoSelect } from "./admin-blog.js";

// --- Guarda de autenticación ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/admin/index.html";
  } else {
    boot();
  }
});

let booted = false;
async function boot() {
  if (booted) return;
  booted = true;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/admin/index.html";
  });

  setupTabs();

  // El orden importa: cada módulo depende de los datos cacheados del anterior.
  await initConfigTab();
  await initCategoriasTab();
  await initSubcategoriasTab();
  await initProductosTab();
  await initStockTab();
  await initPedidosTab();
  await initBlogTab();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".admin-nav button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");

      // Refresca los selects dependientes al entrar a cada pestaña
      if (btn.dataset.tab === "subcategorias") fillCategoriaSelect();
      if (btn.dataset.tab === "productos") fillSubcategoriaSelect();
      if (btn.dataset.tab === "stock") refreshStockTab();
      if (btn.dataset.tab === "blog") fillProductoSelect();
    });
  });
}
