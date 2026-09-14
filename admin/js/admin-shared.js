// admin/js/admin-shared.js
import { uploadToCloudinary, optimizedUrl } from "/js/cloudinary.js";

export function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

/**
 * Gerencia um conjunto de slides (imagens/vídeos) com upload para o Cloudinary.
 * options: { wrapId, uploadBoxId, fileInputId, progressId, multiple, accept, initial }
 * Retorna um objeto com .getSlides() e .setSlides(arr)
 */
export function createSlidesManager(options) {
  const wrap = document.getElementById(options.wrapId);
  const uploadBox = document.getElementById(options.uploadBoxId);
  const fileInput = document.getElementById(options.fileInputId);
  const progressEl = options.progressId ? document.getElementById(options.progressId) : null;
  const maxItems = options.max || 20;

  let slides = options.initial ? [...options.initial] : [];

  function render() {
    wrap.innerHTML = slides
      .map(
        (s, i) => `
      <div class="slide-thumb" data-i="${i}">
        ${s.type === "video" ? `<video src="${s.url}" muted></video>` : `<img src="${optimizedUrl(s.url, 260)}" alt="">`}
        <button type="button" class="remove-slide" data-i="${i}">✕</button>
      </div>`
      )
      .join("");

    wrap.querySelectorAll(".remove-slide").forEach((btn) => {
      btn.addEventListener("click", () => {
        slides.splice(Number(btn.dataset.i), 1);
        render();
      });
    });

    if (uploadBox) uploadBox.style.display = slides.length >= maxItems ? "none" : "flex";
  }

  uploadBox?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadBox.textContent = "Subiendo...";
    for (const file of files) {
      try {
        const result = await uploadToCloudinary(file, (pct) => {
          if (progressEl) progressEl.textContent = `Subiendo ${file.name}: ${pct}%`;
        });
        slides.push({ type: result.type, url: result.url, publicId: result.publicId });
        render();
      } catch (err) {
        console.error(err);
        alert("Error al subir el archivo. Probá de nuevo.");
      }
    }
    if (progressEl) progressEl.textContent = "";
    uploadBox.textContent = options.uploadLabel || "+ Agregar";
    fileInput.value = "";
  });

  render();

  return {
    getSlides: () => slides,
    setSlides: (arr) => {
      slides = arr ? [...arr] : [];
      render();
    },
  };
}
