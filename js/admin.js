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
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch(err) {
      errEl.classList.add('show');
      errEl.textContent = '❌ Email o contraseña incorrectos';
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
    destaque: loadDestaque, promo_section: loadPromoSection
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
  document.getElementById('p-badge').value = product?.badge||'';
  document.getElementById('p-image-url').value = product?.image||'';
  document.getElementById('p-weight').value = product?.weight||'';
  document.getElementById('p-height').value = product?.height||'';
  document.getElementById('p-width').value = product?.width||'';
  document.getElementById('p-depth').value = product?.depth||'';
  document.getElementById('p-image-preview').innerHTML = product?.image?`<div class="img-preview-item"><img src="${product.image}"></div>`:'';

  // Load categories
  const snap = await getDocs(collection(db,'categories'));
  const cats = snap.docs.map(d => d.data());
  document.getElementById('p-category').innerHTML = '<option value="">Sin categoría</option>' +
    cats.map(c => `<option value="${c.name}" ${product?.category===c.name?'selected':''}>${c.name}</option>`).join('');

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
    price,
    oldPrice: parseFloat(document.getElementById('p-old-price').value)||null,
    description: document.getElementById('p-description').value.trim(),
    stock: parseInt(document.getElementById('p-stock').value)||-1,
    badge: document.getElementById('p-badge').value,
    image: document.getElementById('p-image-url').value.trim(),
    weight: parseInt(document.getElementById('p-weight').value)||null,
    height: parseInt(document.getElementById('p-height').value)||null,
    width: parseInt(document.getElementById('p-width').value)||null,
    depth: parseInt(document.getElementById('p-depth').value)||null,
    createdAt: editingProduct?.createdAt||Date.now()
  };
  try {
    if (editingProduct) { await updateDoc(doc(db,'products',editingProduct.id), data); adminToast('Producto actualizado ✅','ok'); }
    else { await addDoc(collection(db,'products'), data); adminToast('Producto creado ✅','ok'); }
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
  const data = { name, icon: document.getElementById('cat-icon').value.trim(), description: document.getElementById('cat-description').value.trim() };
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
  const code = document.getElementById('cupon-code').value.trim().toUpperCase();
  const discount = parseFloat(document.getElementById('cupon-discount').value);
  const expiryStr = document.getElementById('cupon-expiry').value;
  if (!code||!discount||!expiryStr) { adminToast('Todos los campos son obligatorios','err'); return; }
  const expiry = new Date(expiryStr).getTime();
  if (expiry <= Date.now()) { adminToast('La fecha debe ser futura','err'); return; }
  await addDoc(collection(db,'cupones'), { code, discount, expiry, createdAt: Date.now() });
  closeModal('cupon-modal'); loadCupones(); adminToast(`Cupón ${code} creado ✅`,'ok');
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
  document.getElementById('promo-type').value = type;
  document.getElementById('promo-modal-title').textContent = getPromoLabel({type});
  document.getElementById('promo-fields-valor').style.display = type==='valor_minimo'?'block':'none';
  document.getElementById('promo-fields-leve').style.display = type==='leve_n'?'block':'none';
  document.getElementById('promo-fields-frete').style.display = type==='frete_gratis'?'block':'none';
  const snap = await getDocs(collection(db,'categories'));
  const sel = document.getElementById('promo-category');
  if (sel) sel.innerHTML = '<option value="">Todas las categorías</option>'+snap.docs.map(d=>`<option value="${d.data().name}">${d.data().name}</option>`).join('');
  openModal('promo-modal');
};

window.savePromo = async function() {
  const type = document.getElementById('promo-type').value;
  let data = { type, active: true, createdAt: Date.now() };
  if (type==='valor_minimo') {
    data.minValue = parseFloat(document.getElementById('promo-min-value').value);
    data.discountType = document.getElementById('promo-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-discount-value').value);
    if (!data.minValue||!data.discountValue) { adminToast('Completa todos los campos','err'); return; }
  } else if (type==='leve_n') {
    data.minQty = parseInt(document.getElementById('promo-min-qty').value);
    data.limitCategory = document.getElementById('promo-category').value;
    data.discountType = document.getElementById('promo-leve-discount-type').value;
    data.discountValue = parseFloat(document.getElementById('promo-leve-discount-value').value);
    if (!data.minQty||!data.discountValue) { adminToast('Completa todos los campos','err'); return; }
  } else if (type==='frete_gratis') {
    data.minValue = parseFloat(document.getElementById('promo-frete-min').value);
    if (!data.minValue) { adminToast('Ingresa el monto mínimo','err'); return; }
  }
  await addDoc(collection(db,'promotions'), data);
  closeModal('promo-modal'); loadPromotions(); adminToast('Promoción creada ✅','ok');
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
  }
}

window.saveShippingConfig = async function() {
  const data = {
    correoUser: document.getElementById('sh-correo-user').value,
    correoPass: document.getElementById('sh-correo-pass').value,
    correoCustomerId: document.getElementById('sh-customer-id').value,
    originPostal: document.getElementById('sh-origin-postal').value,
    originCity: document.getElementById('sh-origin-city').value,
    defaultShipping: parseFloat(document.getElementById('sh-default').value)||0
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
