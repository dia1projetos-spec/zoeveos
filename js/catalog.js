// ============================================================
// ZOE VEOS — Gerador de Catálogo PDF
// Usa jsPDF (carregado via CDN no admin HTML)
// 3 produtos por linha, retrato A4, organizado por categoria
// ============================================================

import { db, collection, getDocs, query, orderBy } from './firebase-config.js';

const PAGE_W = 210;   // A4 largura mm
const PAGE_H = 297;   // A4 altura mm
const MARGIN = 14;    // margem lateral mm
const COLS   = 3;     // produtos por linha
const BRAND_COLOR  = [30, 30, 30];       // quase preto
const ACCENT_COLOR = [212, 165, 165];    // rose
const GOLD_COLOR   = [201, 169, 110];    // gold
const GRAY_TEXT    = [100, 100, 100];
const LIGHT_GRAY   = [240, 240, 240];

// ============================================================
// ENTRADA PRINCIPAL
// ============================================================
window.generateCatalogPDF = async function() {
  const btn = document.getElementById('generate-pdf-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...'; }

  try {
    const title     = document.getElementById('cat-pdf-title')?.value || 'ZOE VEOS — Catálogo';
    const subtitle  = document.getElementById('cat-pdf-subtitle')?.value || 'Artículos de Maternidad';
    const filterCat = document.getElementById('cat-pdf-category')?.value || '';
    const showPrice = document.getElementById('cat-pdf-price')?.value !== 'no';

    // Buscar produtos com estoque do Firebase
    const snap = await getDocs(query(collection(db, 'products'), orderBy('category')));
    let products = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => {
        const hasStock = p.stock === undefined || p.stock === null || p.stock === -1 || p.stock > 0;
        const catMatch = !filterCat || p.category === filterCat;
        return hasStock && catMatch;
      });

    if (products.length === 0) {
      adminToast('No hay productos con stock para generar el catálogo', 'err');
      return;
    }

    // Agrupar por categoria
    const byCategory = {};
    products.forEach(p => {
      const cat = p.category || 'Sin categoría';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    });

    // Carregar imagens como base64
    await loadImages(products);

    // Gerar PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Capa
    await drawCover(doc, title, subtitle, products.length);

    // Páginas de produtos por categoria
    let firstCat = true;
    for (const [cat, items] of Object.entries(byCategory)) {
      if (!firstCat) doc.addPage();
      firstCat = false;
      await drawCategoryPage(doc, cat, items, showPrice, title);
    }

    // Rodapé em todas as páginas
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      drawPageFooter(doc, i - 1, totalPages - 1, title);
    }

    // Salvar
    const filename = `catalogo-zoeveos-${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    adminToast('✅ Catálogo generado y descargado', 'ok');

  } catch(e) {
    console.error('PDF error:', e);
    adminToast('❌ Error al generar el catálogo', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-download"></i> Generar y Descargar Catálogo PDF'; }
  }
};

// ============================================================
// CAPA
// ============================================================
async function drawCover(doc, title, subtitle, totalProducts) {
  const w = PAGE_W, h = PAGE_H;

  // Fundo escuro elegante
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, w, h, 'F');

  // Bloco decorativo superior
  doc.setFillColor(...ACCENT_COLOR);
  doc.setGState(new doc.GState({ opacity: 0.15 }));
  doc.ellipse(w * 0.85, 40, 60, 60, 'F');
  doc.ellipse(20, h * 0.3, 40, 40, 'F');

  doc.setGState(new doc.GState({ opacity: 1 }));

  // Linha dourada decorativa
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 70, w - MARGIN, 70);
  doc.line(MARGIN, 72, w - MARGIN, 72);

  // Flor / ícone (texto decorativo)
  doc.setTextColor(212, 165, 165);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'normal');
  doc.text('✿', w / 2, 56, { align: 'center' });

  // Título principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('ZOE VEOS', w / 2, 100, { align: 'center' });

  // Linha divisória
  doc.setDrawColor(...ACCENT_COLOR);
  doc.setLineWidth(0.3);
  doc.line(w/2 - 30, 106, w/2 + 30, 106);

  // Subtítulo
  doc.setTextColor(...ACCENT_COLOR);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle.toUpperCase(), w / 2, 116, { align: 'center' });

  // Nome do catálogo
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const displayTitle = title.includes('ZOE VEOS') ? title.replace('ZOE VEOS —', '').trim() : title;
  doc.text(displayTitle, w / 2, 132, { align: 'center' });

  // Box central decorativo
  doc.setFillColor(255, 255, 255);
  doc.setGState(new doc.GState({ opacity: 0.04 }));
  roundedRect(doc, MARGIN + 20, 150, w - MARGIN * 2 - 40, 70, 4);
  doc.setGState(new doc.GState({ opacity: 1 }));

  // Info dentro do box
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.text(`${totalProducts} productos disponibles`, w / 2, 178, { align: 'center' });
  doc.setTextColor(...GOLD_COLOR);
  doc.setFontSize(8);
  doc.text('Córdoba, Argentina  ·  www.zoeveos.com', w / 2, 190, { align: 'center' });
  doc.text('WhatsApp: +54 9 3576 466145', w / 2, 198, { align: 'center' });

  // Linha dourada rodapé
  doc.setDrawColor(...GOLD_COLOR);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, h - 24, w - MARGIN, h - 24);

  doc.setTextColor(...GOLD_COLOR);
  doc.setFontSize(7.5);
  doc.text(new Date().toLocaleDateString('es-AR', { year:'numeric', month:'long' }), w / 2, h - 16, { align: 'center' });
}

// ============================================================
// PÁGINA DE CATEGORIA COM PRODUTOS
// ============================================================
async function drawCategoryPage(doc, category, items, showPrice, catalogTitle) {
  const colW   = (PAGE_W - MARGIN * 2 - (COLS - 1) * 6) / COLS;
  const imgH   = colW * 1.1;  // proporção imagem
  const cardH  = imgH + 22;   // altura do card total
  const rowH   = cardH + 8;

  let y = MARGIN;

  // Header da categoria
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  // Logo pequena
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ZOE VEOS', MARGIN, 14);

  // Nome da categoria no centro
  doc.setTextColor(...ACCENT_COLOR);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(category.toUpperCase(), PAGE_W / 2, 14, { align: 'center' });

  // Data no canto direito
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-AR'), PAGE_W - MARGIN, 14, { align: 'right' });

  // Linha decorativa
  doc.setDrawColor(...ACCENT_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 22, PAGE_W - MARGIN, 22);

  y = 30;

  // Renderizar produtos em grid
  let col = 0;
  let rowStart = y;

  for (let i = 0; i < items.length; i++) {
    const p = items[i];

    // Verificar se precisa de nova página
    if (y + cardH > PAGE_H - 20) {
      drawPageFooter(doc, doc.getCurrentPageInfo().pageNumber - 1, '?', catalogTitle);
      doc.addPage();

      // Header reduzido nas páginas seguintes
      doc.setFillColor(...BRAND_COLOR);
      doc.rect(0, 0, PAGE_W, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ZOE VEOS', MARGIN, 10);
      doc.setTextColor(...ACCENT_COLOR);
      doc.text(category.toUpperCase(), PAGE_W / 2, 10, { align: 'center' });
      doc.setDrawColor(...ACCENT_COLOR);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, 14, PAGE_W - MARGIN, 14);

      y = 20;
      col = 0;
      rowStart = y;
    }

    const x = MARGIN + col * (colW + 6);

    // Card background
    doc.setFillColor(252, 250, 248);
    doc.setDrawColor(230, 225, 220);
    doc.setLineWidth(0.2);
    roundedRect(doc, x, y, colW, cardH, 3, 'FD');

    // Imagem do produto
    const imgData = p._imgBase64;
    if (imgData) {
      try {
        // Imagem com bordas arredondadas (aproximado com clip)
        doc.addImage(imgData, 'JPEG', x + 1, y + 1, colW - 2, imgH - 1, undefined, 'FAST');
      } catch(e) {
        // Placeholder se imagem falhar
        doc.setFillColor(240, 235, 230);
        doc.rect(x + 1, y + 1, colW - 2, imgH - 1, 'F');
        doc.setTextColor(180, 170, 165);
        doc.setFontSize(7);
        doc.text('Sin imagen', x + colW/2, y + imgH/2, { align: 'center' });
      }
    } else {
      doc.setFillColor(240, 235, 230);
      doc.rect(x + 1, y + 1, colW - 2, imgH - 1, 'F');
      doc.setTextColor(180, 170, 165);
      doc.setFontSize(7);
      doc.text('Sin imagen', x + colW/2, y + imgH/2, { align: 'center' });
    }

    // Nome do produto
    const textY = y + imgH + 6;
    doc.setTextColor(...BRAND_COLOR);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const name = p.name.length > 28 ? p.name.slice(0, 26) + '...' : p.name;
    doc.text(name, x + colW / 2, textY, { align: 'center' });

    // Preço
    if (showPrice) {
      doc.setTextColor(...[180, 100, 70]);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const price = `$${Number(p.price).toLocaleString('es-AR')}`;
      doc.text(price, x + colW / 2, textY + 7, { align: 'center' });
    }

    // Badge se houver
    if (p.badge) {
      const badgeColors = {
        promo:    [[196, 133, 90], 'PROMO'],
        destaque: [[201, 169, 110], 'DESTAQUE'],
        nuevo:    [[184, 122, 122], 'NUEVO'],
      };
      const bc = badgeColors[p.badge];
      if (bc) {
        doc.setFillColor(...bc[0]);
        doc.roundedRect(x + 2, y + 2, 16, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(bc[1], x + 10, y + 5.5, { align: 'center' });
      }
    }

    col++;
    if (col >= COLS) {
      col = 0;
      y += rowH;
      rowStart = y;
    }
  }
}

// ============================================================
// RODAPÉ DE PÁGINA
// ============================================================
function drawPageFooter(doc, pageNum, totalPages, title) {
  const y = PAGE_H - 10;
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);

  doc.setTextColor(...GRAY_TEXT);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('ZOE VEOS — www.zoeveos.com', MARGIN, y + 1);
  doc.text(`Página ${pageNum}`, PAGE_W - MARGIN, y + 1, { align: 'right' });
}

// ============================================================
// HELPER: Rect arredondado
// ============================================================
function roundedRect(doc, x, y, w, h, r, style = 'F') {
  doc.roundedRect(x, y, w, h, r, r, style);
}

// ============================================================
// CARREGAR IMAGENS COMO BASE64
// ============================================================
async function loadImages(products) {
  const promises = products.map(async p => {
    if (!p.image) return;
    try {
      p._imgBase64 = await urlToBase64(p.image);
    } catch(e) {
      p._imgBase64 = null;
    }
  });
  await Promise.allSettled(promises);
}

async function urlToBase64(url) {
  // Usar canvas para converter imagem URL em base64
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Reduzir para economizar tamanho do PDF
      const maxSize = 400;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width  = img.width  * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    // Timeout para não travar
    setTimeout(() => reject(new Error('Timeout')), 8000);
    img.src = url;
  });
}

// Expor adminToast para uso neste módulo
function adminToast(msg, type = '') {
  const container = document.getElementById('admin-toast');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `a-toast ${type}`;
  t.innerHTML = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3500);
}
