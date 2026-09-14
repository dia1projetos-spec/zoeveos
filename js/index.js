// js/index.js
import { db, collection, getDocs, doc, getDoc, query, orderBy } from "./firebase-config.js";
import { initHeader } from "./header.js";
import { optimizedUrl } from "./cloudinary.js";

await initHeader();

const wrap = document.getElementById("categoryBanners");

async function setHelpWhatsappLink() {
  try {
    const snap = await getDoc(doc(db, "config", "site"));
    const num = snap.exists() ? (snap.data().whatsappNumber || "").replace(/\D/g, "") : "";
    const link = document.getElementById("helpWhatsappLink");
    if (link && num) link.href = `https://wa.me/${num}`;
  } catch (e) {
    console.warn(e);
  }
}
setHelpWhatsappLink();

async function loadCategorias() {
  try {
    const q = query(collection(db, "categorias"), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    const cats = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false) return;
      cats.push({ id: d.id, ...data });
    });

    if (cats.length === 0) {
      wrap.innerHTML = `<div class="empty-state">Todavía no hay categorías creadas. Agregalas desde el panel de administración.</div>`;
      return;
    }

    wrap.innerHTML = cats.map((cat, i) => renderBanner(cat, i)).join("");
    cats.forEach((cat, i) => startSlider(`banner-${i}`, cat.slides || []));
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="empty-state">No se pudieron cargar las categorías.</div>`;
  }
}

function renderBanner(cat, i) {
  const btnClass = i % 2 === 0 ? "btn-taupe" : "btn-pink";
  const slides = cat.slides && cat.slides.length ? cat.slides : [];

  const mediaHtml = slides.length
    ? `
    <div class="cb-media">
      <div class="cb-slides" id="banner-${i}">
        ${slides
          .map(
            (s, si) => `
          <div class="cb-slide ${si === 0 ? "active" : ""}">
            ${
              s.type === "video"
                ? `<video src="${s.url}" autoplay muted loop playsinline></video>`
                : `<img src="${optimizedUrl(s.url, 1200)}" alt="${cat.nombre}">`
            }
          </div>`
          )
          .join("")}
        ${
          slides.length > 1
            ? `<div class="cb-dots">${slides.map((_, si) => `<button class="${si === 0 ? "active" : ""}" data-i="${si}"></button>`).join("")}</div>`
            : ""
        }
      </div>
    </div>`
    : "";

  return `
  <section class="category-banner">
    ${mediaHtml}
    <div class="cb-text">
      <h2>${cat.nombre}</h2>
      <div class="cb-divider"><span class="heart">♥</span><span class="line"></span></div>
      <p>${cat.descripcion || ""}</p>
      <a class="btn-pill ${btnClass}" href="/categoria.html?id=${cat.id}">
        Ver más
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </section>`;
}

function startSlider(containerId, slides) {
  if (!slides || slides.length <= 1) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  const slideEls = container.querySelectorAll(".cb-slide");
  const dotEls = container.querySelectorAll(".cb-dots button");
  let current = 0;

  function goTo(i) {
    slideEls[current].classList.remove("active");
    dotEls[current]?.classList.remove("active");
    current = i;
    slideEls[current].classList.add("active");
    dotEls[current]?.classList.add("active");
  }

  dotEls.forEach((dot) => dot.addEventListener("click", () => goTo(Number(dot.dataset.i))));

  setInterval(() => {
    goTo((current + 1) % slideEls.length);
  }, 5000);
}

loadCategorias();
