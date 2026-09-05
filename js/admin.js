// ============================================================
// ZOE VEOS — admin.js (Firebase + Cloudinary reais)
// ============================================================
import {
  db, auth, CLOUDINARY,
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, setDoc, getDoc,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase-config.js';

// ============================================================
// ESTADO
// ============================================================
let currentSection = 'dashboard';
let editingProduct = null;
let editingSlide = null;
let editingArticle = null;

// ============================================================
// AUTH
// ============================================================
function initLogin() {
  onAuthStateChanged(auth, user => {
    if (user) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('admin-app').classList.add('show');
      initAdmin();
    }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.remove('show');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch(err) {
      errEl.classList.add('show');
      const msgs = {
        'auth/user-not-found': '❌ Usuario no encontrado. Créalo en Firebase Console.',
        'auth/wrong-password': '❌ Contraseña incorrecta.',
        'auth/invalid-credential': '❌ Credenciales inválidas. Verifica email y contraseña.',
        'auth/invalid-email': '❌ Email inválido.',
        'auth/too-many-requests': '❌ Demasiados intentos. Espera unos minutos.',
        'auth/operation-not-allowed': '❌ Email/Password no habilitado en Firebase Console.',
        'auth/network-request-failed': '❌ Error de red. Verifica tu conexión.',
      };
      errEl.textContent = msgs[err.code] || '❌ Error: ' + err.code;
    }
  });
}

async function logout() {
  await signOut(auth);
  location.reload();
}

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================
async function uploadToCloudinary(file, targetInput, previewEl) {
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.uploadPreset);
  adminToast('⬆️ Subiendo imagen...');
  try {
    const res = await fetch(CLOUDINARY.uploadUrl, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) {
      if (targetInput) targetInput.value = data.secure_url;
      if (previewEl) previewEl.innerHTML = `<div class="img-preview-item"><img src="${data.secure_url}"></div>`;
      adminToast('✅ Imagen subida', 'ok');
    } else { adminToast('❌ Error Cloudinary', 'err'); }
  } catch(e) { adminToast('❌ Error al subir imagen', 'err'); }
}
window.uploadToCloudinary = uploadToCloudinary;

// ============================================================
// SIDEBAR
// ============================================================
function initSidebar() {
  document.querySelectorAll('.nav-item[data-dropdown]').forEach(item => {
    item.querySelector('.nav-link').addEventListener('click', () => item.classList.toggle('open'));
  });
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.section);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
  document.getElementById('sidebar-logout')?.addEventListener('click', logout);
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function navigateTo(section) {
  currentSection = section;
  document.querySelectorAll('[data-section]').forEach(el => el.classList.toggle('active-sub', el.dataset.section === section));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.add('active');
  const titles = {
    dashboard:'Dashboard', products:'Productos', categories:'Categorías',
    slides:'Slides del Hero', blog:'Blog & Artículos',
    cupones:'Cupones', promotions:'Promociones', pricing:'Precios en Masa',
    shipping:'Configuración de Flete', orders:'Pedidos',
    destaque:'Sección Destaque', promo_section:'Sección Promoción'
  };
  const topbar = document.getElementById('topbar-title');
  if (topbar) topbar.textContent = titles[section] || section;
  loadSection(section);
}

function loadSection(section) {
  const loaders = {
    dashboard: loadDashboard, products: loadProducts, categories: loadCategories,
    slides: loadSlides, blog: loadBlog, cupones: loadCupones,
    promotions: loadPromotions, pricing: loadPricing,
    shipping: loadShipping, orders: loadOrders,
    destaque: loadDestaque, promo_section: loadPromoSection,
    provincial_shipping: loadProvincialShipping,
    catalogo: loadCatalogo,
    landpages: loadLandpages
  };
  loaders[section]?.();
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const [prods, arts, cups, slides] = await Promise.all([
      getDocs(collection(db,'products')),
      getDocs(collection(db,'articles')),
      getDocs(collection(db,'cupones')),
      getDocs(collection(db,'slides'))
    ]);
    document.getElementById('stat-products').textContent = prods.size;
    document.getElementById('stat-articles').textContent = arts.size;
    const now = Date.now();
    document.getElementById('stat-cupones').textContent = cups.docs.filter(d => d.data().expiry > now).length;
    document.getElementById('stat-slides').textContent = slides.size;
  } catch(e) { console.error(e); }
}

// ============================================================
// SLIDES
// ============================================================
async function loadSlides() {
  const container = document.getElementById('slides-list');
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'slides'), orderBy('createdAt','asc')));
    const slides = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (slides.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No hay slides. Agrega el primero 👆</div>`;
      return;
    }
    container.innerHTML = slides.map((s,i) => `
      <div class="slide-item">
        <div class="slide-img-wrap">
          ${s.image?`<img src="${s.image}" alt="${s.title}">`:'<div style="width:100%;height:100%;background:var(--cream-dark);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Sin imagen</div>'}
          <div class="slide-order-badge">${i+1}</div>
        </div>
        <div class="slide-info">
          <div class="slide-title">${s.title||'(Sin título)'}</div>
          <div class="slide-subtitle">${s.subtitle||''}</div>
          <div class="slide-actions">
            <button class="tbl-btn tbl-edit" onclick="editSlide('${s.id}')">✏️ Editar</button>
            <button class="tbl-btn tbl-delete" onclick="deleteSlide('${s.id}')">🗑️</button>
          </div>
        </div>
      </div>`).join('');
  } catch(e) { adminToast('Error al cargar slides','err'); }
}

window.openSlideModal = function(slide=null) {
  editingSlide = slide;
  document.getElementById('slide-modal-title').textContent = slide ? 'Editar Slide' : 'Nuevo Slide';
  document.getElementById('slide-title').value = slide?.title||'';
  document.getElementById('slide-subtitle').value = slide?.subtitle||'';
  document.getElementById('slide-cta').value = slide?.cta||'Ver Productos';
  document.getElementById('slide-image-url').value = slide?.image||'';
  document.getElementById('slide-image-preview').innerHTML = slide?.image?`<img src="${slide.image}" style="max-height:120px;border-radius:8px;">`:'';
  openModal('slide-modal');
};

window.editSlide = async function(id) {
  const d = await getDoc(doc(db,'slides',id));
  if (d.exists()) window.openSlideModal({ id: d.id, ...d.data() });
};

window.deleteSlide = async function(id) {
  if (!confirm('¿Eliminar este slide?')) return;
  await deleteDoc(doc(db,'slides',id));
  loadSlides(); adminToast('Slide eliminado','ok');
};

window.saveSlide = async function() {
  const title = document.getElementById('slide-title').value.trim();
  const subtitle = document.getElementById('slide-subtitle').value.trim();
  const cta = document.getElementById('slide-cta').value.trim();
  const image = document.getElementById('slide-image-url').value.trim();
  if (!title) { adminToast('El título es obligatorio','err'); return; }
  const data = { title, subtitle, cta, image, createdAt: editingSlide?.createdAt || Date.now() };
  try {
    if (editingSlide) { await updateDoc(doc(db,'slides',editingSlide.id), data); adminToast('Slide actualizado','ok'); }
    else { await addDoc(collection(db,'slides'), data); adminToast('Slide creado','ok'); }
    closeModal('slide-modal'); loadSlides();
  } catch(e) { adminToast('Error al guardar','err'); }
};

// ============================================================
// PRODUCTOS
// ============================================================
async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  try {
    const snap = await getDocs(query(collection(db,'products'), orderBy('createdAt','desc')));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No hay productos. Agrega el primero 👆</td></tr>`;
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.image||''}" onerror="this.style.background='var(--cream-dark)'"></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category||'-'}</td>
        <td><strong>$${Number(p.price).toLocaleString('es-AR')}</strong></td>
        <td>${buildBadge(p.badge)}</td>
        <td>${p.stock>=0?p.stock:'∞'}</td>
        <td class="table-actions">
          <button class="tbl-btn tbl-edit" onclick="editProduct('${p.id}')">Editar</button>
          <button class="tbl-btn tbl-delete" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </td>
      </tr>`).join('');
    document.getElementById('products-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      tbody.querySelectorAll('tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q)?'':'none'; });
    });
  } catch(e) { adminToast('Error al cargar productos','err'); }
}

function buildBadge(badge) {
  if (!badge) return '<span class="badge badge-gray">Normal</span>';
  const m = { destaque:['badge-gold','⭐ Destaque'], promo:['badge-terra','🔥 Promo'], nuevo:['badge-rose','✨ Nuevo'] };
  const [cls,lbl] = m[badge]||['badge-gray',badge];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

window.openProductModal = async function(product=null) {
  editingProduct = product;
  document.getElementById('product-modal-title').textContent = product?'Editar Producto':'Nuevo Producto';
  document.getElementById('p-name').value = product?.name||'';
  document.getElementById('p-price').value = product?.price||'';
  document.getElementById('p-old-price').value = product?.oldPrice||'';
  document.getElementById('p-description').value = product?.description||'';
  document.getElementById('p-stock').value = product?.stock??'';
  const pWaEl = document.getElementById('p-frete-wa');
  if (pWaEl) pWaEl.checked = product?.freteWhatsapp || false;
  const pConsultaWa = document.getElementById('p-consultar-wa');
  if (pConsultaWa) pConsultaWa.checked = product?.consultarWa || false;
  document.getElementById('p-badge').value = product?.badge||'';
  // Carregar imagens múltiplas (p-images-preview é o ID correto no HTML)
  window._productImages = product?.images?.length ? [...product.images] : (product?.image ? [product.image] : []);
  setTimeout(() => {
    if (typeof renderImagesPreview === 'function') renderImagesPreview();
  }, 50);
  document.getElementById('p-seo-title').value = product?.seoTitle||'';
  document.getElementById('p-art-title').value = product?.articleTitle||'';
  document.getElementById('p-art-cover').value = product?.articleCover||'';
  document.getElementById('p-art-content').innerHTML = product?.articleContent||'';
  document.getElementById('p-seo-desc').value = product?.seoDescription||'';
  document.getElementById('p-seo-keywords').value = product?.seoKeywords||'';
  // Mostrar link da landpage se produto já existe
  const linkEl = document.getElementById('p-landpage-link');
  if (linkEl && product?.id) {
    linkEl.innerHTML = `<a href="https://www.zoeveos.com/product.html?id=${product.id}" target="_blank" style="color:#0077b6;">https://www.zoeveos.com/product.html?id=${product.id}</a>`;
  } else if (linkEl) {
    linkEl.textContent = 'Guardá el producto para ver el link';
  }
  document.getElementById('p-weight').value = product?.weight||'';
  document.getElementById('p-height').value = product?.height||'';
  document.getElementById('p-width').value = product?.width||'';
  document.getElementById('p-depth').value = product?.depth||'';

  // Load categories — múltiplas selecionáveis com checkboxes
  const snap = await getDocs(collection(db,'categories'));
  const cats = snap.docs.map(d => d.data());
  const productCats = product?.categories || (product?.category ? [product.category] : []);
  const catsWrap = document.getElementById('p-categories-wrap');
  if (catsWrap) {
    catsWrap.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted);width:100%;margin-bottom:4px;display:block;">Seleccioná una o más categorías:</span>';
    cats.forEach(c => {
      const checked = productCats.includes(c.name);
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.82rem;cursor:pointer;padding:4px 10px;background:white;border-radius:99px;border:1.5px solid var(--border);';
      lbl.innerHTML = `<input type="checkbox" value="${c.name}" class="p-cat-check" ${checked?'checked':''}> ${c.name}`;
      catsWrap.appendChild(lbl);
    });
    catsWrap.addEventListener('change', syncCategoryFields);
    syncCategoryFields();
  }

  openModal('product-modal');
};

window.editProduct = async function(id) {
  const d = await getDoc(doc(db,'products',id));
  if (d.exists()) window.openProductModal({ id: d.id, ...d.data() });
};

window.deleteProduct = async function(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  await deleteDoc(doc(db,'products',id));
  loadProducts(); adminToast('Producto eliminado','ok');
};

window.saveProduct = async function() {
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  if (!name||!price) { adminToast('Nombre y precio son obligatorios','err'); return; }
  const data = {
    name,
    category: document.getElementById('p-category').value,
    categories: JSON.parse(document.getElementById('p-categories-json')?.value || '[]'),
    price,
    oldPrice: parseFloat(document.getElementById('p-old-price').value)||null,
    description: document.getElementById('p-description').value.trim(),
    stock: parseInt(document.getElementById('p-stock').value)||-1,
    freteWhatsapp: document.getElementById('p-frete-wa')?.checked || false,
    consultarWa: document.getElementById('p-consultar-wa')?.checked || false,
    badge: document.getElementById('p-badge').value,
    images: window._productImages || [],
    image: window._productImages?.[0] || '', // compatibilidade
    weight: parseInt(document.getElementById('p-weight').value)||null,
    height: parseInt(document.getElementById('p-height').value)||null,
    width: parseInt(document.getElementById('p-width').value)||null,
    depth: parseInt(document.getElementById('p-depth').value)||null,
    seoTitle: document.getElementById('p-seo-title').value.trim(),
    seoDescription: document.getElementById('p-seo-desc').value.trim(),
    seoKeywords: document.getElementById('p-seo-keywords').value.trim(),
    articleTitle:   document.getElementById('p-art-title').value.trim(),
    articleCover:   document.getElementById('p-art-cover').value.trim(),
    articleContent: document.getElementById('p-art-content').innerHTML,
    updatedAt: Date.now(),
    createdAt: editingProduct?.createdAt||Date.now()
  };
  try {
    if (editingProduct) { await updateDoc(doc(db,'products',editingProduct.id), data); adminToast('Producto actualizado ✅','ok'); }
    else {
      const newDoc = await addDoc(collection(db,'products'), data);
      adminToast(`Producto creado ✅ — Link: /product.html?id=${newDoc.id}`,'ok');
      // Mostrar link no modal antes de fechar
      setTimeout(() => {
        const linkEl = document.getElementById('p-landpage-link');
        if (linkEl) linkEl.innerHTML = `<a href="https://www.zoeveos.com/product.html?id=${newDoc.id}" target="_blank" style="color:#0077b6;">https://www.zoeveos.com/product.html?id=${newDoc.id}</a>`;
      }, 100);
    }
    closeModal('product-modal'); loadProducts();
  } catch(e) { adminToast('Error al guardar','err'); }
};

// ============================================================
// CATEGORÍAS
// ============================================================
async function loadCategories() {
  const tbody = document.getElementById('categories-tbody');
  if (!tbody) return;
  const snap = await getDocs(collection(db,'categories'));
  const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  tbody.innerHTML = cats.map(c => `
    <tr>
      <td>${c.icon||'🎀'}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.description||'-'}</td>
      <td class="table-actions">
        <button class="tbl-btn tbl-edit" onclick="editCategory('${c.id}')">Editar</button>
        <button class="tbl-btn tbl-delete" onclick="deleteCategory('${c.id}')">Eliminar</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">Sin categorías</td></tr>`;
}

window.openCategoryModal = function(cat=null) {
  document.getElementById('cat-id').value = cat?.id||'';
  document.getElementById('cat-name').value = cat?.name||'';
  document.getElementById('cat-icon').value = cat?.icon||'';
  document.getElementById('cat-description').value = cat?.description||'';
  document.getElementById('cat-subcategories').value = (cat?.subcategories||[]).join(', ');
  document.getElementById('cat-show-banner').checked = cat?.showBanner || false;
  document.getElementById('cat-banner-desc').value = cat?.bannerDesc || '';
  document.getElementById('cat-order').value = cat?.order || 1;
  document.getElementById('cat-banner-slides').value = (cat?.bannerSlides||[]).join('\n');
  // Preview slides existentes
  const prev = document.getElementById('cat-banner-slides-preview');
  if (prev) prev.innerHTML = (cat?.bannerSlides||[]).map(url =>
    `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid var(--rose-light);">`
  ).join('');
  document.getElementById('category-modal-title').textContent = cat?'Editar Categoría':'Nueva Categoría';
  openModal('category-modal');
};

window.editCategory = async function(id) {
  const d = await getDoc(doc(db,'categories',id));
  if (d.exists()) window.openCategoryModal({ id: d.id, ...d.data() });
};

window.deleteCategory = async function(id) {
  if (!confirm('¿Eliminar?')) return;
  await deleteDoc(doc(db,'categories',id));
  loadCategories(); adminToast('Categoría eliminada','ok');
};

window.saveCategory = async function() {
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { adminToast('El nombre es obligatorio','err'); return; }
  const subRaw = document.getElementById('cat-subcategories')?.value?.trim() || '';
  const subcategories = subRaw ? subRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const data = { name, icon: document.getElementById('cat-icon').value.trim(), description: document.getElementById('cat-description').value.trim(), subcategories };
  try {
    if (id) { await updateDoc(doc(db,'categories',id), data); adminToast('Categoría actualizada ✅','ok'); }
    else { await addDoc(collection(db,'categories'), data); adminToast('Categoría creada ✅','ok'); }
    closeModal('category-modal'); loadCategories();
  } catch(e) { adminToast('Error al guardar','err'); }
};

// ============================================================
// CUPONES
// ============================================================
async function loadCupones() {
  const container = document.getElementById('cupones-list');
  if (!container) return;
  const snap = await getDocs(collection(db,'cupones'));
  const now = Date.now();
  const active = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.expiry > now);
  // Auto-delete expired
  snap.docs.forEach(d => { if (d.data().expiry <= now) deleteDoc(doc(db,'cupones',d.id)); });
  if (active.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No hay cupones activos</div>`;
    return;
  }
  container.innerHTML = active.map(c => `
    <div class="cupon-card">
      <div class="cupon-card-info">
        <div class="cupon-card-name">🎟️ ${c.code}</div>
        <div class="cupon-card-detail">${c.discount}% descuento · Vence: ${new Date(c.expiry).toLocaleDateString('es-AR')}</div>
      </div>
      <div class="promo-card-actions">
        <span class="badge badge-green">Activo</span>
        <button class="tbl-btn tbl-delete" onclick="deleteCupon('${c.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

window.openCuponModal = function() {
  document.getElementById('cupon-code').value='';
  document.getElementById('cupon-discount').value='';
  document.getElementById('cupon-expiry').value='';
  openModal('cupon-modal');
};

window.deleteCupon = async function(id) {
  if (!confirm('¿Eliminar cupón?')) return;
  await deleteDoc(doc(db,'cupones',id));
  loadCupones(); adminToast('Cupón eliminado','ok');
};

window.saveCupon = async function() {
  const btn = document.querySelector('#cupon-modal .btn-main');
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;

  const code = document.getElementById('cupon-code').value.trim().toUpperCase();
  const discount = parseFloat(document.getElementById('cupon-discount').value);
  const expiryStr = document.getElementById('cupon-expiry').value;
  if (!code||!discount||!expiryStr) { adminToast('Todos los campos son obligatorios','err'); if (btn) btn.disabled = false; return; }
  const expiry = new Date(expiryStr).getTime();
  if (expiry <= Date.now()) { adminToast('La fecha debe ser futura','err'); if (btn) btn.disabled = false; return; }

  // Verificar se já existe cupom com esse código
  const snap = await getDocs(collection(db,'cupones'));
  const exists = snap.docs.some(d => d.data().code?.toUpperCase() === code);
  if (exists) { adminToast(`❌ Ya existe un cupón con el código ${code}`,'err'); if (btn) btn.disabled = false; return; }

  try {
    await addDoc(collection(db,'cupones'), { code, discount, expiry, createdAt: Date.now() });
    closeModal('cupon-modal'); loadCupones(); adminToast(`Cupón ${code} creado ✅`,'ok');
  } catch(e) {
    adminToast('❌ Error al guardar','err');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ============================================================
// PROMOCIONES
// ============================================================
async function loadPromotions() {
  const container = document.getElementById('promos-list');
  if (!container) return;
  const snap = await getDocs(collection(db,'promotions'));
  const promos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (promos.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No hay promociones</div>`;
    return;
  }
  container.innerHTML = promos.map(p => `
    <div class="promo-card">
      <div class="promo-card-info">
        <div class="promo-card-name">${getPromoLabel(p)}</div>
        <div class="promo-card-detail">${getPromoDetail(p)}</div>
      </div>
      <div class="promo-card-actions">
        <label class="toggle"><input type="checkbox" ${p.active?'checked':''} onchange="togglePromo('${p.id}',this.checked)"><span class="toggle-slider"></span></label>
        <button class="tbl-btn tbl-delete" onclick="deletePromo('${p.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function getPromoLabel(p) {
  return { valor_minimo:'💰 Descuento por monto mínimo', leve_n:'🛍️ Llevá N productos', frete_gratis:'🚚 Envío Gratis' }[p.type]||p.type;
}
function getPromoDetail(p) {
  if (p.type==='valor_minimo') return `A partir de $${p.minValue} → ${p.discountType==='percent'?p.discountValue+'%':'$'+p.discountValue} descuento`;
  if (p.type==='leve_n') return `Llevá ${p.minQty}+ de ${p.limitCategory||'todas las categorías'} → ${p.discountType==='percent'?p.discountValue+'%':'$'+p.discountValue} descuento`;
  if (p.type==='frete_gratis') return `Envío gratis a partir de $${p.minValue}`;
  return '';
}

window.togglePromo = async function(id, active) {
  await updateDoc(doc(db,'promotions',id), { active });
  adminToast(active?'Promoción activada':'Desactivada','ok');
};

window.deletePromo = async function(id) {
  if (!confirm('¿Eliminar?')) return;
  await deleteDoc(doc(db,'promotions',id));
  loadPromotions(); adminToast('Promoción eliminada','ok');
};

window.openPromoModal = async function(type) {
  // Limpar campos antes de abrir
  ['promo-min-value','promo-discount-value','promo-min-qty',
   'promo-leve-discount-value','promo-frete-min'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('promo-type').value = type;
  document.getElementById('promo-modal-title').textContent = getPromoLabel({type});
  document.getElementById('promo-fields-valor').style.display = type==='valor_minimo'?'block':'none';
  document.getElementById('promo-fields-leve').style.display = type==='leve_n'?'block':'none';
  document.getElementById('promo-fields-frete').style.display = type==='frete_gratis'?'block':'none';

  const snap = await getDocs(collection(db,'categories'));
  const sel = document.getElementById('promo-category');
  if (sel) sel.innerHTML = '<option value="">Todas las categorías</option>'+snap.docs.map(d=>`<option value="${d.data().name}">${d.data().name}</option>`).join('');

  // Reativar botão caso tenha ficado desabilitado
  const btn = document.querySelector('#promo-modal .btn-main');
  if (btn) btn.disabled = false;

  openModal('promo-modal');
};

window.savePromo = async function() {
  // Proteção contra duplo clique
  const btn = document.querySelector('#promo-modal .btn-main');
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;

  const type = document.getElementById('promo-type').value;
  let data = { type, active: true, createdAt: Date.now() };
  if (type==='valor_minimo') {
    data.minValue = parseFloat(document.getElementById('promo-min-value').value);
    data.discountType = document.getElementById('promo-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-discount-value').value);
    if (!data.minValue||!data.discountValue) { adminToast('Completa todos los campos','err'); if (btn) btn.disabled = false; return; }
  } else if (type==='leve_n') {
    data.minQty = parseInt(document.getElementById('promo-min-qty').value);
    data.limitCategory = document.getElementById('promo-category').value;
    data.discountType = document.getElementById('promo-leve-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-leve-discount-value').value);
    if (!data.minQty||!data.discountValue) { adminToast('Completa todos los campos','err'); if (btn) btn.disabled = false; return; }
  } else if (type==='frete_gratis') {
    data.minValue = parseFloat(document.getElementById('promo-frete-min').value);
    if (!data.minValue) { adminToast('Ingresa el monto mínimo','err'); if (btn) btn.disabled = false; return; }
  }

  try {
    await addDoc(collection(db,'promotions'), data);
    closeModal('promo-modal');
    loadPromotions();
    adminToast('Promoción creada ✅','ok');
  } catch(e) {
    adminToast('❌ Error al guardar','err');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ============================================================
// PRECIOS EN MASA
// ============================================================
async function loadPricing() {
  const snap = await getDocs(collection(db,'products'));
  document.getElementById('pricing-count').textContent = `${snap.size} productos en la tienda`;
  const cats = await getDocs(collection(db,'categories'));
  const sel = document.getElementById('mass-category');
  if (sel) sel.innerHTML = '<option value="">Todas las categorías</option>'+cats.docs.map(d=>`<option value="${d.data().name}">${d.data().name}</option>`).join('');
}

window.applyMassPrice = async function() {
  const type = document.getElementById('mass-type').value;
  const value = parseFloat(document.getElementById('mass-value').value);
  const category = document.getElementById('mass-category').value;
  if (!value) { adminToast('Ingresa un valor','err'); return; }
  const snap = await getDocs(collection(db,'products'));
  let count = 0;
  for (const d of snap.docs) {
    const p = d.data();
    if (category && p.category !== category) continue;
    let newPrice = p.price;
    if (type==='add') newPrice = p.price + value;
    else if (type==='subtract') newPrice = Math.max(0, p.price - value);
    else if (type==='percent_add') newPrice = p.price * (1 + value/100);
    else if (type==='percent_sub') newPrice = p.price * (1 - value/100);
    else if (type==='set') newPrice = value;
    await updateDoc(doc(db,'products',d.id), { price: Math.round(newPrice) });
    count++;
  }
  adminToast(`✅ ${count} productos actualizados`,'ok');
};

// ============================================================
// SHIPPING CONFIG
// ============================================================
async function loadShipping() {
  const d = await getDoc(doc(db,'config','shipping'));
  if (d.exists()) {
    const cfg = d.data();
    document.getElementById('sh-correo-user').value = cfg.correoUser||'';
    document.getElementById('sh-correo-pass').value = cfg.correoPass||'';
    document.getElementById('sh-customer-id').value = cfg.correoCustomerId||'';
    document.getElementById('sh-origin-postal').value = cfg.originPostal||'2434';
    document.getElementById('sh-origin-city').value = cfg.originCity||'Córdoba';
    document.getElementById('sh-default').value = cfg.defaultShipping||'';
    const toggleWa = document.getElementById('sh-frete-wa');
    if (toggleWa) {
      toggleWa.checked = cfg.freteWhatsapp || false;
      updateFreteWaUI(cfg.freteWhatsapp || false);
    }
  }
}

window.updateFreteWaUI = function(active) {
  const correoFields = document.getElementById('sh-correo-fields');
  const waInfo = document.getElementById('sh-wa-info');
  if (correoFields) correoFields.style.opacity = active ? '0.4' : '1';
  if (waInfo) waInfo.style.display = active ? 'block' : 'none';
};

window.saveShippingConfig = async function() {
  const freteWa = document.getElementById('sh-frete-wa')?.checked || false;
  const data = {
    correoUser: document.getElementById('sh-correo-user').value,
    correoPass: document.getElementById('sh-correo-pass').value,
    correoCustomerId: document.getElementById('sh-customer-id').value,
    originPostal: document.getElementById('sh-origin-postal').value,
    originCity: document.getElementById('sh-origin-city').value,
    defaultShipping: parseFloat(document.getElementById('sh-default').value)||0,
    freteWhatsapp: freteWa
  };
  await setDoc(doc(db,'config','shipping'), data);
  adminToast('Configuración guardada ✅','ok');
};

// ============================================================
// BLOG
// ============================================================
async function loadBlog() {
  const tbody = document.getElementById('blog-tbody');
  if (!tbody) return;
  const snap = await getDocs(query(collection(db,'articles'), orderBy('createdAt','desc')));
  const arts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (arts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No hay artículos. Crea el primero 👆</td></tr>`;
    return;
  }
  tbody.innerHTML = arts.map(a => `
    <tr>
      <td>${a.image?`<img src="${a.image}" style="width:60px;height:40px;object-fit:cover;border-radius:6px;">`:'-'}</td>
      <td><strong>${a.title}</strong></td>
      <td>${new Date(a.createdAt).toLocaleDateString('es-AR')}</td>
      <td><span class="badge ${a.published!==false?'badge-green':'badge-gray'}">${a.published!==false?'Publicado':'Borrador'}</span></td>
      <td class="table-actions">
        <button class="tbl-btn tbl-edit" onclick="editArticle('${a.id}')">Editar</button>
        <button class="tbl-btn tbl-delete" onclick="deleteArticle('${a.id}')">Eliminar</button>
      </td>
    </tr>`).join('');
}

window.openArticleModal = function(article=null) {
  editingArticle = article;
  document.getElementById('article-modal-title').textContent = article?'Editar Artículo':'Nuevo Artículo';
  document.getElementById('art-title').value = article?.title||'';
  document.getElementById('art-excerpt').value = article?.excerpt||'';
  document.getElementById('art-image-url').value = article?.image||'';
  document.getElementById('art-seo-title').value = article?.seoTitle||'';
  document.getElementById('art-seo-desc').value = article?.seoDesc||'';
  document.getElementById('art-seo-keywords').value = article?.seoKeywords||'';
  document.getElementById('art-published').checked = article?.published??true;
  document.getElementById('art-content').innerHTML = article?.content||'';
  document.getElementById('art-image-preview').innerHTML = article?.image?`<div class="img-preview-item"><img src="${article.image}"></div>`:'';
  openModal('article-modal');
};

window.editArticle = async function(id) {
  const d = await getDoc(doc(db,'articles',id));
  if (d.exists()) window.openArticleModal({ id: d.id, ...d.data() });
};

window.deleteArticle = async function(id) {
  if (!confirm('¿Eliminar este artículo?')) return;
  await deleteDoc(doc(db,'articles',id));
  loadBlog(); adminToast('Artículo eliminado','ok');
};

window.saveArticle = async function() {
  const title = document.getElementById('art-title').value.trim();
  if (!title) { adminToast('El título es obligatorio','err'); return; }
  const data = {
    title,
    excerpt: document.getElementById('art-excerpt').value.trim(),
    content: document.getElementById('art-content').innerHTML,
    image: document.getElementById('art-image-url').value.trim(),
    seoTitle: document.getElementById('art-seo-title').value.trim(),
    seoDesc: document.getElementById('art-seo-desc').value.trim(),
    seoKeywords: document.getElementById('art-seo-keywords').value.trim(),
    published: document.getElementById('art-published').checked,
    createdAt: editingArticle?.createdAt||Date.now()
  };
  try {
    if (editingArticle) { await updateDoc(doc(db,'articles',editingArticle.id), data); adminToast('Artículo actualizado ✅','ok'); }
    else { await addDoc(collection(db,'articles'), data); adminToast('Artículo creado ✅','ok'); }
    closeModal('article-modal'); loadBlog();
  } catch(e) { adminToast('Error al guardar','err'); }
};

window.execCmd = function(cmd, value=null) {
  document.getElementById('art-content').focus();
  document.execCommand(cmd, false, value);
};

// ============================================================
// DESTAQUE / PROMO SECTION
// ============================================================
async function loadDestaque() {
  const snap = await getDocs(collection(db,'products'));
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('destaque-product-select');
  if (!sel) return;
  const current = await getDoc(doc(db,'config','destaque'));
  const currentId = current.exists() ? current.data().id : '';
  sel.innerHTML = '<option value="">Sin producto destacado</option>' +
    products.map(p => `<option value="${p.id}" ${currentId===p.id?'selected':''}>${p.name}</option>`).join('');
}

window.saveDestaque = async function() {
  const id = document.getElementById('destaque-product-select').value;
  if (!id) { await setDoc(doc(db,'config','destaque'), {}); adminToast('Destaque removido','ok'); return; }
  const d = await getDoc(doc(db,'products',id));
  if (d.exists()) { await setDoc(doc(db,'config','destaque'), { id, ...d.data() }); adminToast('Destaque guardado ✅','ok'); }
};

async function loadPromoSection() {
  const snap = await getDocs(collection(db,'products'));
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('promo-section-select');
  if (!sel) return;
  const current = await getDoc(doc(db,'config','promo_section'));
  const currentId = current.exists() ? current.data()?.product?.id : '';
  sel.innerHTML = '<option value="">Sin producto</option>' +
    products.map(p => `<option value="${p.id}" ${currentId===p.id?'selected':''}>${p.name}</option>`).join('');
  if (current.exists()) document.getElementById('promo-section-text').value = current.data()?.text||'';
}

window.savePromoSection = async function() {
  const id = document.getElementById('promo-section-select').value;
  const text = document.getElementById('promo-section-text').value;
  if (!id) { await setDoc(doc(db,'config','promo_section'), { text }); adminToast('Promo removida','ok'); return; }
  const d = await getDoc(doc(db,'products',id));
  if (d.exists()) { await setDoc(doc(db,'config','promo_section'), { text, product: { id, ...d.data() } }); adminToast('Sección promo guardada ✅','ok'); }
};

async function loadOrders() {
  document.getElementById('orders-tbody').innerHTML =
    `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">Los pedidos llegan por WhatsApp. Próximamente integración completa.</td></tr>`;
}

// ============================================================
// MODALES
// ============================================================
window.openModal = function(id) { document.getElementById(id)?.classList.add('open'); document.body.style.overflow='hidden'; };
window.closeModal = function(id) { document.getElementById(id)?.classList.remove('open'); document.body.style.overflow=''; };

// ============================================================
// TOAST
// ============================================================
function adminToast(msg, type='') {
  const container = document.getElementById('admin-toast');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `a-toast ${type}`;
  t.innerHTML = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 400); }, 3200);
}
window.adminToast = adminToast;

// ============================================================
// INIT
// ============================================================
function initAdmin() {
  initSidebar();
  navigateTo('dashboard');
}

document.addEventListener('DOMContentLoaded', initLogin);

// ============================================================
// FLETE FIJO POR PROVINCIA
// ============================================================
const PROVINCES = [
  {code:'B',name:'Buenos Aires'},{code:'C',name:'CABA'},{code:'X',name:'Córdoba'},
  {code:'S',name:'Santa Fe'},{code:'M',name:'Mendoza'},{code:'T',name:'Tucumán'},
  {code:'A',name:'Salta'},{code:'Q',name:'Neuquén'},{code:'R',name:'Río Negro'},
  {code:'G',name:'Santiago del Estero'},{code:'E',name:'Entre Ríos'},{code:'H',name:'Chaco'},
  {code:'N',name:'Misiones'},{code:'W',name:'Corrientes'},{code:'J',name:'San Juan'},
  {code:'D',name:'San Luis'},{code:'K',name:'Catamarca'},{code:'F',name:'La Rioja'},
  {code:'L',name:'La Pampa'},{code:'U',name:'Chubut'},{code:'Z',name:'Santa Cruz'},
  {code:'V',name:'Tierra del Fuego'},{code:'P',name:'Formosa'},{code:'Y',name:'Jujuy'},
];

async function loadProvincialShipping() {
  const grid = document.getElementById('provincial-grid');
  if (!grid) return;
  let current = {};
  try {
    const d = await getDoc(doc(db,'config','provincial_shipping'));
    if (d.exists()) current = d.data();
  } catch(e) {}
  grid.innerHTML = PROVINCES.map(p => `
    <div class="field-group">
      <label class="field-label">${p.name} (${p.code})</label>
      <input type="number" class="field-input provincial-input" data-code="${p.code}"
        placeholder="0 = usa API Correo" value="${current[p.code]||''}">
    </div>`).join('');
}

window.saveProvincialShipping = async function() {
  const data = {};
  document.querySelectorAll('.provincial-input').forEach(input => {
    const val = parseFloat(input.value);
    if (val > 0) data[input.dataset.code] = val;
  });
  await setDoc(doc(db,'config','provincial_shipping'), data);
  adminToast('Fletes por provincia guardados ✅','ok');
};



// ============================================================
// MÚLTIPLAS FOTOS POR PRODUTO
// ============================================================
window._productImages = []; // array de URLs do produto atual

window.handleMultipleImgUpload = async function(files) {
  for (const file of Array.from(files)) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY.uploadPreset);
    adminToast('⬆️ Subiendo foto...');
    try {
      const res = await fetch(CLOUDINARY.uploadUrl, { method:'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        window._productImages.push(data.secure_url);
        renderImagesPreview();
        adminToast('✅ Foto subida','ok');
      }
    } catch(e) { adminToast('❌ Error al subir foto','err'); }
  }
};

function renderImagesPreview() {
  const preview = document.getElementById('p-images-preview');
  const json = document.getElementById('p-images-json');
  if (!preview) return;
  preview.innerHTML = window._productImages.map((url, i) => `
    <div class="img-preview-item">
      <img src="${url}">
      <button class="img-preview-remove" onclick="removeProductImg(${i})">✕</button>
    </div>`).join('');
  if (json) json.value = JSON.stringify(window._productImages);
}

window.removeProductImg = function(i) {
  window._productImages.splice(i, 1);
  renderImagesPreview();
};

// ============================================================
// CATÁLOGO PDF — carregar categorias no select
// ============================================================
async function loadCatalogo() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const sel = document.getElementById('cat-pdf-category');
    if (!sel) return;
    const cats = snap.docs.map(d => d.data().name);
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
  } catch(e) { console.error(e); }
}


// ============================================================
// ZOE VEOS — Gerador de Catálogo PDF
// Usa jsPDF (carregado via CDN no admin HTML)
// 3 produtos por linha, retrato A4, organizado por categoria
// ============================================================

// Firebase já importado no admin.js

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

    // Sempre adicionar nova página após a capa
    doc.addPage();

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

// adminToast já definido acima

window.execArticleCmd = function(cmd, value=null) {
  document.getElementById('p-art-content').focus();
  document.execCommand(cmd, false, value);
};

// ============================================================
// LANDPAGES CUSTOMIZADAS
// ============================================================
let editingLandpage = null;
let lpArticles = [];

async function loadLandpages() {
  const container = document.getElementById('landpages-list');
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'landpages'), orderBy('createdAt','desc')));
    const lps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (lps.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No hay landpages. ¡Creá la primera! 🚀</div>`;
      return;
    }
    container.innerHTML = lps.map(lp => `
      <div class="promo-card">
        <div class="promo-card-info">
          <div class="promo-card-name">🌐 ${lp.title}</div>
          <div class="promo-card-detail">
            <a href="https://www.zoeveos.com/lp/${lp.slug}" target="_blank" style="color:var(--rose-dark);">
              zoeveos.com/lp/${lp.slug}
            </a>
            · ${(lp.articles||[]).length} artículo(s)
          </div>
        </div>
        <div class="promo-card-actions">
          <button class="tbl-btn tbl-edit" onclick="editLandpage('${lp.id}')">✏️ Editar</button>
          <button class="tbl-btn tbl-view" onclick="window.open('https://www.zoeveos.com/lp/${lp.slug}','_blank')">👁️ Ver</button>
          <button class="tbl-btn tbl-delete" onclick="deleteLandpage('${lp.id}')">🗑️</button>
        </div>
      </div>`).join('');
  } catch(e) { adminToast('Error al cargar landpages','err'); }
}

window.openLandpageModal = async function(lp = null) {
  editingLandpage = lp;
  lpArticles = lp?.articles ? JSON.parse(JSON.stringify(lp.articles)) : [];

  document.getElementById('lp-modal-title').textContent = lp ? 'Editar Landpage' : 'Nueva Landpage';
  document.getElementById('lp-edit-id').value = lp?.id || '';
  document.getElementById('lp-title').value = lp?.title || '';
  document.getElementById('lp-slug').value = lp?.slug || '';
  document.getElementById('lp-slug-preview').textContent = lp?.slug || 'slug';
  document.getElementById('lp-seo-title').value = lp?.seoTitle || '';
  document.getElementById('lp-seo-desc').value = lp?.seoDesc || '';
  document.getElementById('lp-seo-keywords').value = lp?.seoKeywords || '';
  document.getElementById('lp-slides').value = (lp?.slides || []).join('\n');
  // Mostrar preview dos slides existentes
  const slidesPreview = document.getElementById('lp-slides-preview');
  if (slidesPreview) {
    slidesPreview.innerHTML = (lp?.slides || []).map(url =>
      `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid var(--rose-light);">`
    ).join('');
  }

  // Auto-slug do título
  document.getElementById('lp-title').oninput = function() {
    if (!editingLandpage) {
      const slug = this.value.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').trim();
      document.getElementById('lp-slug').value = slug;
      document.getElementById('lp-slug-preview').textContent = slug || 'slug';
    }
  };
  document.getElementById('lp-slug').oninput = function() {
    document.getElementById('lp-slug-preview').textContent = this.value || 'slug';
  };

  // Carregar produtos para destaque
  const prodSnap = await getDocs(collection(db,'products'));
  const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('lp-featured-product');
  sel.innerHTML = '<option value="">Sin producto destacado</option>' +
    prods.map(p => `<option value="${p.id}" ${lp?.featuredProductId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

  renderLPArticles();
  openModal('landpage-modal');
};

window.editLandpage = async function(id) {
  const d = await getDoc(doc(db,'landpages',id));
  if (d.exists()) window.openLandpageModal({ id: d.id, ...d.data() });
};

window.deleteLandpage = async function(id) {
  if (!confirm('¿Eliminar esta landpage?')) return;
  await deleteDoc(doc(db,'landpages',id));
  loadLandpages();
  adminToast('Landpage eliminada','ok');
};

window.addLPArticle = function() {
  lpArticles.push({ title:'', image:'', content:'' });
  renderLPArticles();
  // Scroll al nuevo artículo
  setTimeout(() => {
    const arts = document.querySelectorAll('.lp-article-item');
    arts[arts.length-1]?.scrollIntoView({ behavior:'smooth' });
  }, 100);
};

window.removeLPArticle = function(i) {
  lpArticles.splice(i, 1);
  renderLPArticles();
};

function renderLPArticles() {
  const container = document.getElementById('lp-articles-container');
  if (!container) return;
  if (lpArticles.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);border:2px dashed var(--border);border-radius:var(--radius-md);">
      Aún no hay artículos. Hacé clic en "Agregar artículo" para comenzar.</div>`;
    return;
  }
  container.innerHTML = lpArticles.map((art, i) => `
    <div class="lp-article-item" style="background:var(--beige);border-radius:var(--radius-md);padding:18px;margin-bottom:14px;border:1.5px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:0.82rem;font-weight:600;color:var(--brown);">📝 Artículo ${i+1}</span>
        <button class="tbl-btn tbl-delete" onclick="removeLPArticle(${i})">✕ Eliminar</button>
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label class="field-label">Título del artículo</label>
        <input type="text" class="field-input lp-art-title" data-i="${i}" value="${art.title||''}" placeholder="Título del artículo">
      </div>
      <div class="field-group" style="margin-bottom:10px;">
        <label class="field-label">Imagen del artículo</label>
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="hidden" class="lp-art-image-url" data-i="${i}" value="${art.image||''}">
          <input type="file" accept="image/*" class="lp-art-img-file" data-i="${i}"
            style="font-size:0.8rem;flex:1;" onchange="uploadLPArticleImg(this, ${i})">
          ${art.image ? `<img src="${art.image}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--border);" class="lp-art-img-preview-${i}">` : `<div class="lp-art-img-preview-${i}" style="width:52px;height:52px;background:var(--beige-dark);border-radius:8px;border:2px dashed var(--border);"></div>`}
        </div>
        <p class="field-hint" id="lp-art-img-status-${i}"></p>
      </div>
      <div class="field-group">
        <label class="field-label">Contenido</label>
        <div class="blog-editor-toolbar">
          <button class="editor-btn" onclick="execLPCmd(${i},'bold')"><i class="fa-solid fa-bold"></i></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'italic')"><i class="fa-solid fa-italic"></i></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'underline')"><i class="fa-solid fa-underline"></i></button>
          <span style="width:1px;background:var(--border);margin:0 4px;"></span>
          <button class="editor-btn" onclick="execLPCmd(${i},'formatBlock','h2')"><b>H2</b></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'formatBlock','h3')"><b>H3</b></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'formatBlock','p')"><i class="fa-solid fa-paragraph"></i></button>
          <span style="width:1px;background:var(--border);margin:0 4px;"></span>
          <button class="editor-btn" onclick="execLPCmd(${i},'insertUnorderedList')"><i class="fa-solid fa-list-ul"></i></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'insertOrderedList')"><i class="fa-solid fa-list-ol"></i></button>
          <button class="editor-btn" onclick="execLPCmd(${i},'removeFormat')"><i class="fa-solid fa-eraser"></i></button>
        </div>
        <div class="blog-editor-content lp-art-content" contenteditable="true" data-i="${i}" style="min-height:140px;">${art.content||''}</div>
      </div>
    </div>`).join('');

  // Sync inputs to lpArticles on change
  container.querySelectorAll('.lp-art-title').forEach(el => {
    el.addEventListener('input', () => { lpArticles[el.dataset.i].title = el.value; });
  });
  container.querySelectorAll('.lp-art-image-url').forEach(el => {
    el.addEventListener('change', () => { lpArticles[el.dataset.i].image = el.value; });
  });
  container.querySelectorAll('.lp-art-content').forEach(el => {
    el.addEventListener('input', () => { lpArticles[el.dataset.i].content = el.innerHTML; });
  });
}

window.execLPCmd = function(i, cmd, value=null) {
  const el = document.querySelector(`.lp-art-content[data-i="${i}"]`);
  if (el) { el.focus(); document.execCommand(cmd, false, value); }
};

window.saveLandpage = async function() {
  const btn = document.querySelector('#landpage-modal .btn-main');
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;

  const title = document.getElementById('lp-title').value.trim();
  const slug  = document.getElementById('lp-slug').value.trim()
    .toLowerCase().replace(/[^a-z0-9-]/g,'');

  if (!title || !slug) { adminToast('Título y slug son obligatorios','err'); if (btn) btn.disabled = false; return; }

  // Sync artículos antes de salvar — usar index correto
  const artItems = document.querySelectorAll('.lp-article-item');
  artItems.forEach((item, realIdx) => {
    if (!lpArticles[realIdx]) lpArticles[realIdx] = {};
    const titleEl   = item.querySelector('.lp-art-title');
    const imageEl   = item.querySelector('.lp-art-image-url');
    const contentEl = item.querySelector('.lp-art-content');
    if (titleEl)   lpArticles[realIdx].title   = titleEl.value;
    if (imageEl)   lpArticles[realIdx].image   = imageEl.value;
    if (contentEl) lpArticles[realIdx].content = contentEl.innerHTML;
  });
  // Filtrar artigos sem conteúdo
  const articlesClean = lpArticles.filter(a => a.title || a.content);

  const featuredId = document.getElementById('lp-featured-product').value;
  let featuredProduct = null;
  if (featuredId) {
    const pd = await getDoc(doc(db,'products',featuredId));
    if (pd.exists()) featuredProduct = { id: pd.id, ...pd.data() };
  }

  const data = {
    title,
    slug,
    seoTitle:    document.getElementById('lp-seo-title').value.trim(),
    seoDesc:     document.getElementById('lp-seo-desc').value.trim(),
    seoKeywords: document.getElementById('lp-seo-keywords').value.trim(),
    slides: document.getElementById('lp-slides').value.split('\n').map(s=>s.trim()).filter(Boolean),
    featuredProductId: featuredId || null,
    featuredProduct,
    articles: articlesClean,
    createdAt: editingLandpage?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const id = document.getElementById('lp-edit-id').value;
    if (id) {
      await updateDoc(doc(db,'landpages',id), data);
      adminToast('Landpage actualizada ✅','ok');
    } else {
      const newDoc = await addDoc(collection(db,'landpages'), data);
      adminToast(`Landpage creada ✅ — zoeveos.com/lp/${slug}`,'ok');
    }
    closeModal('landpage-modal');
    loadLandpages();
  } catch(e) {
    adminToast('Error al guardar','err');
  } finally {
    if (btn) btn.disabled = false;
  }
};



// ============================================================
// LANDPAGE — Upload imagens Cloudinary
// ============================================================
window.uploadLPSlides = async function(input) {
  const status = document.getElementById('lp-slides-status');
  const preview = document.getElementById('lp-slides-preview');
  const textarea = document.getElementById('lp-slides');
  const files = Array.from(input.files);
  if (!files.length) return;

  if (status) status.textContent = `⬆️ Subiendo ${files.length} imagen(es)...`;

  const urls = textarea.value.split('\n').map(s=>s.trim()).filter(Boolean);

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY.uploadPreset);
      const res = await fetch(CLOUDINARY.uploadUrl, { method:'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        urls.push(data.secure_url);
        // Mostrar preview
        if (preview) {
          const img = document.createElement('img');
          img.src = data.secure_url;
          img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid var(--rose-light);';
          preview.appendChild(img);
        }
      }
    } catch(e) { console.error('Upload slide error:', e); }
  }

  textarea.value = urls.join('\n');
  if (status) status.textContent = `✅ ${urls.length} imagen(es) lista(s)`;
  input.value = '';
};

window.uploadLPArticleImg = async function(input, idx) {
  const statusEl = document.getElementById(`lp-art-img-status-${idx}`);
  const urlInput = document.querySelector(`.lp-art-image-url[data-i="${idx}"]`);
  const file = input.files[0];
  if (!file) return;

  if (statusEl) statusEl.textContent = '⬆️ Subiendo imagen...';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY.uploadPreset);
    const res = await fetch(CLOUDINARY.uploadUrl, { method:'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) {
      if (urlInput) urlInput.value = data.secure_url;
      if (lpArticles[idx]) lpArticles[idx].image = data.secure_url;
      // Atualizar preview
      const prevEl = document.querySelector(`.lp-art-img-preview-${idx}`);
      if (prevEl) {
        prevEl.outerHTML = `<img src="${data.secure_url}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid var(--rose);" class="lp-art-img-preview-${idx}">`;
      }
      if (statusEl) statusEl.textContent = '✅ Imagen subida';
    }
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ Error al subir';
    console.error('Upload art img error:', e);
  }
};

window.uploadCatBannerSlides = async function(input) {
  const status  = document.getElementById('cat-banner-upload-status');
  const preview = document.getElementById('cat-banner-slides-preview');
  const textarea = document.getElementById('cat-banner-slides');
  const files = Array.from(input.files);
  if (!files.length) return;
  if (status) status.textContent = `⬆️ Subiendo ${files.length} imagen(es)...`;
  const urls = textarea.value.split('\n').map(s=>s.trim()).filter(Boolean);
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY.uploadPreset);
      const res = await fetch(CLOUDINARY.uploadUrl, { method:'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        urls.push(data.secure_url);
        if (preview) {
          const img = document.createElement('img');
          img.src = data.secure_url;
          img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid var(--rose-light);';
          preview.appendChild(img);
        }
      }
    } catch(e) { console.error('Upload cat banner error:', e); }
  }
  textarea.value = urls.join('\n');
  if (status) status.textContent = `✅ ${urls.length} imagen(es) lista(s)`;
  input.value = '';
};

function syncCategoryFields() {
  const checks = document.querySelectorAll('.p-cat-check:checked');
  const selected = Array.from(checks).map(c => c.value);
  const catField = document.getElementById('p-category');
  const catsJson = document.getElementById('p-categories-json');
  if (catField) catField.value = selected[0] || '';
  if (catsJson) catsJson.value = JSON.stringify(selected);
}
