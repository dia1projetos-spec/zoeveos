// ============================================================
// ZOE VEOS — Panel Administrativo JS
// ============================================================

// ============================================================
// ESTADO
// ============================================================
let currentSection = 'dashboard';
let editingProduct = null;
let editingSlide = null;
let editingArticle = null;
let editingCoupon = null;

// Storage helpers (reemplazar con Firebase en producción)
const DB = {
  get: (key, def = []) => JSON.parse(localStorage.getItem(`zoeveos_${key}`) || JSON.stringify(def)),
  set: (key, val) => localStorage.setItem(`zoeveos_${key}`, JSON.stringify(val)),
  push: (key, item) => {
    const arr = DB.get(key);
    const newItem = { ...item, id: item.id || Date.now().toString(), createdAt: item.createdAt || Date.now() };
    arr.push(newItem);
    DB.set(key, arr);
    return newItem;
  },
  update: (key, id, data) => {
    const arr = DB.get(key);
    const idx = arr.findIndex(i => i.id === id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...data };
    DB.set(key, arr);
  },
  delete: (key, id) => {
    const arr = DB.get(key).filter(i => i.id !== id);
    DB.set(key, arr);
  }
};

// ============================================================
// LOGIN
// ============================================================
const ADMIN_CREDS = { email: 'admin@zoeveos.com', password: 'ZoeVeos2024!' };

function initLogin() {
  const loginScreen = document.getElementById('login-screen');
  const adminApp = document.getElementById('admin-app');

  if (localStorage.getItem('zoeveos_admin_auth') === 'true') {
    loginScreen.style.display = 'none';
    adminApp.classList.add('show');
    initAdmin();
    return;
  }

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');

    if (email === ADMIN_CREDS.email && pass === ADMIN_CREDS.password) {
      localStorage.setItem('zoeveos_admin_auth', 'true');
      loginScreen.style.display = 'none';
      adminApp.classList.add('show');
      initAdmin();
    } else {
      errEl.classList.add('show');
      errEl.textContent = '❌ Credenciales incorrectas';
    }
  });
}

function logout() {
  localStorage.removeItem('zoeveos_admin_auth');
  location.reload();
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================
function initSidebar() {
  // Dropdown nav items
  document.querySelectorAll('.nav-item[data-dropdown]').forEach(item => {
    const link = item.querySelector('.nav-link');
    link.addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });

  // Section links
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const section = el.dataset.section;
      navigateTo(section);
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Logout
  document.getElementById('sidebar-logout')?.addEventListener('click', logout);

  // Mobile hamburger
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function navigateTo(section) {
  currentSection = section;

  // Update active states
  document.querySelectorAll('[data-section]').forEach(el => {
    el.classList.toggle('active-sub', el.dataset.section === section);
  });

  // Show section
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`section-${section}`);
  if (target) {
    target.classList.add('active');
    // Update topbar title
    const titles = {
      dashboard: 'Dashboard', products: 'Productos', categories: 'Categorías',
      slides: 'Slides del Hero', blog: 'Blog & Artículos',
      cupones: 'Cupones', promotions: 'Promociones', pricing: 'Precios en Masa',
      shipping: 'Configuración de Frete', orders: 'Pedidos', destaque: 'Sección Destaque',
      promo_section: 'Sección Promoción', config: 'Configuración'
    };
    const topbar = document.getElementById('topbar-title');
    if (topbar) topbar.textContent = titles[section] || section;
  }

  loadSection(section);
}

// ============================================================
// LOAD SECTION DATA
// ============================================================
function loadSection(section) {
  const loaders = {
    dashboard: loadDashboard,
    products: loadProducts,
    categories: loadCategories,
    slides: loadSlides,
    blog: loadBlog,
    cupones: loadCupones,
    promotions: loadPromotions,
    pricing: loadPricing,
    shipping: loadShipping,
    orders: loadOrders,
    destaque: loadDestaque,
    promo_section: loadPromoSection,
  };
  loaders[section]?.();
}

// ============================================================
// DASHBOARD
// ============================================================
function loadDashboard() {
  const products = DB.get('products');
  const articles = DB.get('articles');
  const cupones = DB.get('cupones').filter(c => c.expiry > Date.now());
  const slides = DB.get('slides');

  document.getElementById('stat-products').textContent = products.length;
  document.getElementById('stat-articles').textContent = articles.length;
  document.getElementById('stat-cupones').textContent = cupones.length;
  document.getElementById('stat-slides').textContent = slides.length;
}

// ============================================================
// SLIDES
// ============================================================
function loadSlides() {
  const slides = DB.get('slides');
  const container = document.getElementById('slides-list');
  if (!container) return;

  if (slides.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">
      No hay slides. Agrega el primero 👆</div>`;
    return;
  }

  container.innerHTML = slides.map((s, i) => `
    <div class="slide-item">
      <div class="slide-img-wrap">
        ${s.image ? `<img src="${s.image}" alt="${s.title}">` : '<div style="width:100%;height:100%;background:var(--cream-dark);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Sin imagen</div>'}
        <div class="slide-order-badge">${i+1}</div>
      </div>
      <div class="slide-info">
        <div class="slide-title">${s.title || '(Sin título)'}</div>
        <div class="slide-subtitle">${s.subtitle || ''}</div>
        <div class="slide-actions">
          <button class="tbl-btn tbl-edit" onclick="editSlide('${s.id}')">✏️ Editar</button>
          <button class="tbl-btn tbl-delete" onclick="deleteSlide('${s.id}')">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openSlideModal(slide = null) {
  editingSlide = slide;
  document.getElementById('slide-modal-title').textContent = slide ? 'Editar Slide' : 'Nuevo Slide';
  document.getElementById('slide-title').value = slide?.title || '';
  document.getElementById('slide-subtitle').value = slide?.subtitle || '';
  document.getElementById('slide-cta').value = slide?.cta || 'Ver Productos';
  document.getElementById('slide-image-preview').innerHTML = slide?.image
    ? `<img src="${slide.image}" style="max-height:120px;border-radius:8px;">` : '';
  document.getElementById('slide-image-url').value = slide?.image || '';
  openModal('slide-modal');
}

function editSlide(id) {
  const slide = DB.get('slides').find(s => s.id === id);
  if (slide) openSlideModal(slide);
}

function deleteSlide(id) {
  if (!confirm('¿Eliminar este slide?')) return;
  DB.delete('slides', id);
  loadSlides();
  adminToast('Slide eliminado', 'ok');
}

function saveSlide() {
  const title = document.getElementById('slide-title').value.trim();
  const subtitle = document.getElementById('slide-subtitle').value.trim();
  const cta = document.getElementById('slide-cta').value.trim();
  const image = document.getElementById('slide-image-url').value.trim();

  if (!title) { adminToast('El título es obligatorio', 'err'); return; }

  const data = { title, subtitle, cta, image };
  if (editingSlide) {
    DB.update('slides', editingSlide.id, data);
    adminToast('Slide actualizado', 'ok');
  } else {
    DB.push('slides', data);
    adminToast('Slide creado', 'ok');
  }
  closeModal('slide-modal');
  loadSlides();
}

// ============================================================
// PRODUCTOS
// ============================================================
function loadProducts() {
  const products = DB.get('products');
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No hay productos. Agrega el primero 👆</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image || ''}" onerror="this.style.background='var(--cream-dark)'"></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category || '-'}</td>
      <td><strong>$${Number(p.price).toLocaleString('es-AR')}</strong></td>
      <td>${buildBadgeHtml(p.badge)}</td>
      <td>${p.stock >= 0 ? p.stock : '∞'}</td>
      <td class="table-actions">
        <button class="tbl-btn tbl-edit" onclick="editProduct('${p.id}')">Editar</button>
        <button class="tbl-btn tbl-delete" onclick="deleteProduct('${p.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');

  // Search
  document.getElementById('products-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

function buildBadgeHtml(badge) {
  if (!badge) return '<span class="badge badge-gray">Normal</span>';
  const map = {
    destaque: ['badge-gold', '⭐ Destaque'],
    promo: ['badge-terra', '🔥 Promo'],
    nuevo: ['badge-rose', '✨ Nuevo']
  };
  const [cls, label] = map[badge] || ['badge-gray', badge];
  return `<span class="badge ${cls}">${label}</span>`;
}

function openProductModal(product = null) {
  editingProduct = product;
  document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';

  // Fill form
  document.getElementById('p-name').value = product?.name || '';
  document.getElementById('p-category').value = product?.category || '';
  document.getElementById('p-price').value = product?.price || '';
  document.getElementById('p-old-price').value = product?.oldPrice || '';
  document.getElementById('p-description').value = product?.description || '';
  document.getElementById('p-stock').value = product?.stock ?? '';
  document.getElementById('p-badge').value = product?.badge || '';
  document.getElementById('p-image-url').value = product?.image || '';
  document.getElementById('p-weight').value = product?.weight || '';
  document.getElementById('p-height').value = product?.height || '';
  document.getElementById('p-width').value = product?.width || '';
  document.getElementById('p-depth').value = product?.depth || '';

  // Image preview
  const preview = document.getElementById('p-image-preview');
  preview.innerHTML = product?.image
    ? `<div class="img-preview-item"><img src="${product.image}"></div>` : '';

  // Populate categories
  const cats = DB.get('categories');
  const catSelect = document.getElementById('p-category');
  catSelect.innerHTML = '<option value="">Sin categoría</option>' +
    cats.map(c => `<option value="${c.name}" ${product?.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

  openModal('product-modal');
}

function editProduct(id) {
  const p = DB.get('products').find(p => p.id === id);
  if (p) openProductModal(p);
}

function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  DB.delete('products', id);
  loadProducts();
  adminToast('Producto eliminado', 'ok');
}

function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value;
  const price = parseFloat(document.getElementById('p-price').value);
  const oldPrice = parseFloat(document.getElementById('p-old-price').value) || null;
  const description = document.getElementById('p-description').value.trim();
  const stock = parseInt(document.getElementById('p-stock').value) || -1;
  const badge = document.getElementById('p-badge').value;
  const image = document.getElementById('p-image-url').value.trim();
  const weight = parseInt(document.getElementById('p-weight').value) || null;
  const height = parseInt(document.getElementById('p-height').value) || null;
  const width = parseInt(document.getElementById('p-width').value) || null;
  const depth = parseInt(document.getElementById('p-depth').value) || null;

  if (!name || !price) { adminToast('Nombre y precio son obligatorios', 'err'); return; }

  const data = { name, category, price, oldPrice, description, stock, badge, image, weight, height, width, depth };

  if (editingProduct) {
    DB.update('products', editingProduct.id, data);
    adminToast('Producto actualizado ✅', 'ok');
  } else {
    DB.push('products', data);
    adminToast('Producto creado ✅', 'ok');
  }
  closeModal('product-modal');
  loadProducts();
}

// ============================================================
// CLOUDINARY UPLOAD
// ============================================================
async function uploadToCloudinary(file, targetInput, previewEl) {
  const config = { cloudName: 'TU_CLOUD_NAME', uploadPreset: 'TU_UPLOAD_PRESET' };
  if (config.cloudName === 'TU_CLOUD_NAME') {
    // Modo demo: convertir a base64
    const reader = new FileReader();
    reader.onload = (e) => {
      if (targetInput) targetInput.value = e.target.result;
      if (previewEl) previewEl.innerHTML = `<div class="img-preview-item"><img src="${e.target.result}"></div>`;
    };
    reader.readAsDataURL(file);
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', config.uploadPreset);

  try {
    adminToast('⬆️ Subiendo imagen...');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
      method: 'POST', body: formData
    });
    const data = await res.json();
    if (data.secure_url) {
      if (targetInput) targetInput.value = data.secure_url;
      if (previewEl) previewEl.innerHTML = `<div class="img-preview-item"><img src="${data.secure_url}"></div>`;
      adminToast('✅ Imagen subida', 'ok');
    }
  } catch (e) {
    adminToast('❌ Error al subir imagen', 'err');
  }
}

// ============================================================
// CATEGORÍAS
// ============================================================
function loadCategories() {
  const cats = DB.get('categories');
  const tbody = document.getElementById('categories-tbody');
  if (!tbody) return;

  tbody.innerHTML = cats.map(c => `
    <tr>
      <td>${c.icon || '🎀'}</td>
      <td><strong>${c.name}</strong></td>
      <td>${c.description || '-'}</td>
      <td class="table-actions">
        <button class="tbl-btn tbl-edit" onclick="editCategory('${c.id}')">Editar</button>
        <button class="tbl-btn tbl-delete" onclick="deleteCategory('${c.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">Sin categorías</td></tr>`;
}

function openCategoryModal(cat = null) {
  document.getElementById('cat-id').value = cat?.id || '';
  document.getElementById('cat-name').value = cat?.name || '';
  document.getElementById('cat-icon').value = cat?.icon || '';
  document.getElementById('cat-description').value = cat?.description || '';
  document.getElementById('category-modal-title').textContent = cat ? 'Editar Categoría' : 'Nueva Categoría';
  openModal('category-modal');
}

function editCategory(id) {
  const cat = DB.get('categories').find(c => c.id === id);
  if (cat) openCategoryModal(cat);
}

function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  DB.delete('categories', id);
  loadCategories();
  adminToast('Categoría eliminada', 'ok');
}

function saveCategory() {
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-name').value.trim();
  const icon = document.getElementById('cat-icon').value.trim();
  const description = document.getElementById('cat-description').value.trim();

  if (!name) { adminToast('El nombre es obligatorio', 'err'); return; }

  const data = { name, icon, description };
  if (id) {
    DB.update('categories', id, data);
    adminToast('Categoría actualizada ✅', 'ok');
  } else {
    DB.push('categories', data);
    adminToast('Categoría creada ✅', 'ok');
  }
  closeModal('category-modal');
  loadCategories();
}

// ============================================================
// CUPONES
// ============================================================
function loadCupones() {
  const now = Date.now();
  const cupones = DB.get('cupones');
  // Auto-remove expired
  const active = cupones.filter(c => c.expiry > now);
  if (active.length !== cupones.length) DB.set('cupones', active);

  const container = document.getElementById('cupones-list');
  if (!container) return;

  if (active.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No hay cupones activos</div>`;
    return;
  }

  container.innerHTML = active.map(c => `
    <div class="cupon-card">
      <div class="cupon-card-info">
        <div class="cupon-card-name">🎟️ ${c.code}</div>
        <div class="cupon-card-detail">${c.discount}% de descuento · Vence: ${new Date(c.expiry).toLocaleDateString('es-AR')}</div>
      </div>
      <div class="promo-card-actions">
        <span class="badge badge-green">Activo</span>
        <button class="tbl-btn tbl-delete" onclick="deleteCupon('${c.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openCuponModal() {
  document.getElementById('cupon-code').value = '';
  document.getElementById('cupon-discount').value = '';
  document.getElementById('cupon-expiry').value = '';
  openModal('cupon-modal');
}

function deleteCupon(id) {
  if (!confirm('¿Eliminar este cupón?')) return;
  DB.delete('cupones', id);
  loadCupones();
  adminToast('Cupón eliminado', 'ok');
}

function saveCupon() {
  const code = document.getElementById('cupon-code').value.trim().toUpperCase();
  const discount = parseFloat(document.getElementById('cupon-discount').value);
  const expiryStr = document.getElementById('cupon-expiry').value;

  if (!code || !discount || !expiryStr) { adminToast('Todos los campos son obligatorios', 'err'); return; }
  if (discount <= 0 || discount > 100) { adminToast('El descuento debe ser entre 1 y 100', 'err'); return; }

  const expiry = new Date(expiryStr).getTime();
  if (expiry <= Date.now()) { adminToast('La fecha debe ser futura', 'err'); return; }

  DB.push('cupones', { code, discount, expiry });
  closeModal('cupon-modal');
  loadCupones();
  adminToast(`Cupón ${code} creado ✅`, 'ok');
}

// ============================================================
// PROMOCIONES
// ============================================================
function loadPromotions() {
  const promos = DB.get('promotions');
  const container = document.getElementById('promos-list');
  if (!container) return;

  if (promos.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No hay promociones activas</div>`;
    return;
  }

  container.innerHTML = promos.map(p => `
    <div class="promo-card">
      <div class="promo-card-info">
        <div class="promo-card-name">${getPromoLabel(p)}</div>
        <div class="promo-card-detail">${getPromoDetail(p)}</div>
      </div>
      <div class="promo-card-actions">
        <label class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" ${p.active ? 'checked' : ''} onchange="togglePromo('${p.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </label>
        <button class="tbl-btn tbl-delete" onclick="deletePromo('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function getPromoLabel(p) {
  const labels = {
    valor_minimo: '💰 Descuento por monto mínimo',
    leve_n: '🛍️ Llevá N productos',
    frete_gratis: '🚚 Envío Gratis'
  };
  return labels[p.type] || p.type;
}

function getPromoDetail(p) {
  if (p.type === 'valor_minimo') {
    const disc = p.discountType === 'percent' ? `${p.discountValue}%` : `$${p.discountValue}`;
    return `A partir de $${p.minValue} → ${disc} de descuento`;
  }
  if (p.type === 'leve_n') {
    const disc = p.discountType === 'percent' ? `${p.discountValue}%` : `$${p.discountValue}`;
    const cat = p.limitCategory || 'todas las categorías';
    return `Llevá ${p.minQty}+ productos de ${cat} → ${disc} de descuento`;
  }
  if (p.type === 'frete_gratis') {
    return `Envío gratis a partir de $${p.minValue}`;
  }
  return '';
}

function togglePromo(id, active) {
  DB.update('promotions', id, { active });
  adminToast(active ? 'Promoción activada' : 'Promoción desactivada', 'ok');
}

function deletePromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  DB.delete('promotions', id);
  loadPromotions();
  adminToast('Promoción eliminada', 'ok');
}

function openPromoModal(type) {
  const modal = document.getElementById('promo-modal');
  if (!modal) return;

  document.getElementById('promo-type').value = type;
  document.getElementById('promo-modal-title').textContent = getPromoLabel({ type });

  // Show/hide fields based on type
  document.getElementById('promo-fields-valor').style.display = type === 'valor_minimo' ? 'block' : 'none';
  document.getElementById('promo-fields-leve').style.display = type === 'leve_n' ? 'block' : 'none';
  document.getElementById('promo-fields-frete').style.display = type === 'frete_gratis' ? 'block' : 'none';

  // Populate category select
  const cats = DB.get('categories');
  const catSel = document.getElementById('promo-category');
  if (catSel) catSel.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

  openModal('promo-modal');
}

function savePromo() {
  const type = document.getElementById('promo-type').value;
  let data = { type, active: true };

  if (type === 'valor_minimo') {
    data.minValue = parseFloat(document.getElementById('promo-min-value').value);
    data.discountType = document.getElementById('promo-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-discount-value').value);
    if (!data.minValue || !data.discountValue) { adminToast('Completa todos los campos', 'err'); return; }
  } else if (type === 'leve_n') {
    data.minQty = parseInt(document.getElementById('promo-min-qty').value);
    data.limitCategory = document.getElementById('promo-category').value;
    data.discountType = document.getElementById('promo-leve-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-leve-discount-value').value);
    if (!data.minQty || !data.discountValue) { adminToast('Completa todos los campos', 'err'); return; }
  } else if (type === 'frete_gratis') {
    data.minValue = parseFloat(document.getElementById('promo-frete-min').value);
    if (!data.minValue) { adminToast('Ingresa el monto mínimo', 'err'); return; }
  }

  DB.push('promotions', data);
  closeModal('promo-modal');
  loadPromotions();
  adminToast('Promoción creada ✅', 'ok');
}

// ============================================================
// PRECIO EN MASA
// ============================================================
function loadPricing() {
  const products = DB.get('products');
  document.getElementById('pricing-count').textContent = `${products.length} productos`;
}

function applyMassPrice() {
  const type = document.getElementById('mass-type').value;
  const value = parseFloat(document.getElementById('mass-value').value);
  const category = document.getElementById('mass-category').value;

  if (!value) { adminToast('Ingresa un valor', 'err'); return; }

  const products = DB.get('products');
  const updated = products.map(p => {
    if (category && p.category !== category) return p;

    let newPrice = p.price;
    if (type === 'add') newPrice = p.price + value;
    else if (type === 'subtract') newPrice = Math.max(0, p.price - value);
    else if (type === 'percent_add') newPrice = p.price * (1 + value/100);
    else if (type === 'percent_sub') newPrice = p.price * (1 - value/100);
    else if (type === 'set') newPrice = value;

    return { ...p, price: Math.round(newPrice) };
  });

  DB.set('products', updated);
  adminToast(`✅ Precios actualizados (${updated.filter(p => !category || p.category === category).length} productos)`, 'ok');
}

// ============================================================
// SHIPPING CONFIG
// ============================================================
function loadShipping() {
  const config = DB.get('shipping_config', {
    correoUser: '',
    correoPass: '',
    correoCustomerId: '',
    originPostal: '2434',
    originCity: 'Córdoba',
    defaultShipping: 1500,
  });

  document.getElementById('sh-correo-user').value = config.correoUser || '';
  document.getElementById('sh-correo-pass').value = config.correoPass || '';
  document.getElementById('sh-customer-id').value = config.correoCustomerId || '';
  document.getElementById('sh-origin-postal').value = config.originPostal || '2434';
  document.getElementById('sh-origin-city').value = config.originCity || 'Córdoba';
  document.getElementById('sh-default').value = config.defaultShipping || '';
}

function saveShippingConfig() {
  DB.set('shipping_config', {
    correoUser: document.getElementById('sh-correo-user').value,
    correoPass: document.getElementById('sh-correo-pass').value,
    correoCustomerId: document.getElementById('sh-customer-id').value,
    originPostal: document.getElementById('sh-origin-postal').value,
    originCity: document.getElementById('sh-origin-city').value,
    defaultShipping: parseFloat(document.getElementById('sh-default').value) || 0,
  });
  adminToast('Configuración de frete guardada ✅', 'ok');
}

// ============================================================
// BLOG
// ============================================================
function loadBlog() {
  const articles = DB.get('articles');
  const tbody = document.getElementById('blog-tbody');
  if (!tbody) return;

  if (articles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No hay artículos. Crea el primero 👆</td></tr>`;
    return;
  }

  const sorted = [...articles].sort((a,b) => b.createdAt - a.createdAt);
  tbody.innerHTML = sorted.map(a => `
    <tr>
      <td>${a.image ? `<img src="${a.image}" style="width:60px;height:40px;object-fit:cover;border-radius:6px;">` : '-'}</td>
      <td><strong>${a.title}</strong></td>
      <td>${new Date(a.createdAt).toLocaleDateString('es-AR')}</td>
      <td><span class="badge ${a.published ? 'badge-green' : 'badge-gray'}">${a.published ? 'Publicado' : 'Borrador'}</span></td>
      <td class="table-actions">
        <button class="tbl-btn tbl-edit" onclick="editArticle('${a.id}')">Editar</button>
        <button class="tbl-btn tbl-delete" onclick="deleteArticle('${a.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function openArticleModal(article = null) {
  editingArticle = article;
  document.getElementById('article-modal-title').textContent = article ? 'Editar Artículo' : 'Nuevo Artículo';
  document.getElementById('art-title').value = article?.title || '';
  document.getElementById('art-excerpt').value = article?.excerpt || '';
  document.getElementById('art-image-url').value = article?.image || '';
  document.getElementById('art-seo-title').value = article?.seoTitle || '';
  document.getElementById('art-seo-desc').value = article?.seoDesc || '';
  document.getElementById('art-seo-keywords').value = article?.seoKeywords || '';
  document.getElementById('art-published').checked = article?.published ?? true;

  // Rich text content
  const editor = document.getElementById('art-content');
  if (editor) editor.innerHTML = article?.content || '';

  document.getElementById('art-image-preview').innerHTML = article?.image
    ? `<div class="img-preview-item"><img src="${article.image}"></div>` : '';

  openModal('article-modal');
}

function editArticle(id) {
  const a = DB.get('articles').find(a => a.id === id);
  if (a) openArticleModal(a);
}

function deleteArticle(id) {
  if (!confirm('¿Eliminar este artículo?')) return;
  DB.delete('articles', id);
  loadBlog();
  adminToast('Artículo eliminado', 'ok');
}

function saveArticle() {
  const title = document.getElementById('art-title').value.trim();
  const excerpt = document.getElementById('art-excerpt').value.trim();
  const content = document.getElementById('art-content').innerHTML;
  const image = document.getElementById('art-image-url').value.trim();
  const seoTitle = document.getElementById('art-seo-title').value.trim();
  const seoDesc = document.getElementById('art-seo-desc').value.trim();
  const seoKeywords = document.getElementById('art-seo-keywords').value.trim();
  const published = document.getElementById('art-published').checked;

  if (!title) { adminToast('El título es obligatorio', 'err'); return; }

  const data = { title, excerpt, content, image, seoTitle, seoDesc, seoKeywords, published };

  if (editingArticle) {
    DB.update('articles', editingArticle.id, data);
    adminToast('Artículo actualizado ✅', 'ok');
  } else {
    DB.push('articles', data);
    adminToast('Artículo creado ✅', 'ok');
  }
  closeModal('article-modal');
  loadBlog();
}

// Toolbar de editor
function execCmd(cmd, value = null) {
  document.getElementById('art-content').focus();
  document.execCommand(cmd, false, value);
}

// ============================================================
// DESTAQUE / PROMO SECTION
// ============================================================
function loadDestaque() {
  const products = DB.get('products');
  const sel = document.getElementById('destaque-product-select');
  if (!sel) return;

  const current = DB.get('destaque_product', null);
  sel.innerHTML = '<option value="">Sin producto destacado</option>' +
    products.map(p => `<option value="${p.id}" ${current?.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
}

function saveDestaque() {
  const id = document.getElementById('destaque-product-select').value;
  if (!id) { DB.set('destaque_product', null); adminToast('Destaque removido', 'ok'); return; }
  const product = DB.get('products').find(p => p.id === id);
  DB.set('destaque_product', product);
  adminToast('Producto destacado guardado ✅', 'ok');
}

function loadPromoSection() {
  const products = DB.get('products');
  const sel = document.getElementById('promo-section-select');
  if (!sel) return;

  const current = DB.get('promo_product', null);
  sel.innerHTML = '<option value="">Sin producto en promoción</option>' +
    products.map(p => `<option value="${p.id}" ${current?.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

  document.getElementById('promo-section-text').value = DB.get('promo_section_text', '¡Oferta especial!');
}

function savePromoSection() {
  const id = document.getElementById('promo-section-select').value;
  const text = document.getElementById('promo-section-text').value;
  DB.set('promo_section_text', text);
  if (!id) { DB.set('promo_product', null); adminToast('Promo removida', 'ok'); return; }
  const product = DB.get('products').find(p => p.id === id);
  DB.set('promo_product', product);
  adminToast('Sección promo guardada ✅', 'ok');
}

// ============================================================
// ORDERS (placeholder)
// ============================================================
function loadOrders() {
  document.getElementById('orders-tbody').innerHTML =
    `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
      Los pedidos llegarán aquí cuando los clientes finalicen sus compras por WhatsApp.</td></tr>`;
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================================
// TOAST
// ============================================================
function adminToast(msg, type = '') {
  const container = document.getElementById('admin-toast');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `a-toast ${type}`;
  t.innerHTML = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3200);
}

// ============================================================
// INIT
// ============================================================
function initAdmin() {
  initSidebar();
  navigateTo('dashboard');

  // Load mass pricing categories
  const massCatSel = document.getElementById('mass-category');
  if (massCatSel) {
    const cats = DB.get('categories');
    massCatSel.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  }
}

document.addEventListener('DOMContentLoaded', initLogin);
