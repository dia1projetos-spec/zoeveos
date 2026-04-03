// ============================================================
// ZOE VEOS — main.js (Firebase + Cloudinary conectados)
// ============================================================
import {
  db, auth, CLOUDINARY, WHATSAPP_NUMBER, CORREO_ORIGIN_POSTAL,
  collection, getDocs, doc, getDoc, query, orderBy,
  onAuthStateChanged
} from './firebase-config.js';

// ============================================================
// ESTADO GLOBAL
// ============================================================
let cart = JSON.parse(localStorage.getItem('zoeveos_cart') || '[]');
let appliedCoupon = null;
let heroSlides = [];
let currentSlide = 0;
let slideInterval = null;
let allProducts = [];
let filteredProducts = [];
let currentPage = 0;
const PRODUCTS_PER_PAGE = 12;

// ============================================================
// LOADER — vídeo responsivo (desktop / mobile)
// ============================================================
function initLoader() {
  // Loader controlado pelo script inline no HTML — nada a fazer aqui
}

// ============================================================
// HEADER SCROLL
// ============================================================
function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileClose = document.getElementById('mobile-nav-close');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileClose?.addEventListener('click', () => mobileNav.classList.remove('open'));
    mobileNav.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => mobileNav.classList.remove('open'))
    );
  }
}

// ============================================================
// HERO SLIDER
// ============================================================
function initHeroSlider(slides) {
  heroSlides = slides;
  const container = document.getElementById('hero-slides');
  const dotsContainer = document.getElementById('hero-dots');
  if (!container) return;
  container.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';

  if (!slides || slides.length === 0) {
    container.innerHTML = `<div class="hero-slide active"><div class="hero-slide-placeholder"><span>🌸 Añade slides desde el Panel Administrativo</span></div></div>`;
    return;
  }

  slides.forEach((slide, i) => {
    const el = document.createElement('div');
    el.className = `hero-slide${i === 0 ? ' active' : ''}`;
    if (slide.image) el.style.backgroundImage = `url(${slide.image})`;
    container.appendChild(el);
    if (dotsContainer) {
      const dot = document.createElement('button');
      dot.className = `hero-dot${i === 0 ? ' active' : ''}`;
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    }
  });

  startSlideShow();
  document.getElementById('hero-prev')?.addEventListener('click', () => goToSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length));
  document.getElementById('hero-next')?.addEventListener('click', () => goToSlide((currentSlide + 1) % heroSlides.length));
}

function goToSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  slides[currentSlide]?.classList.remove('active');
  dots[currentSlide]?.classList.remove('active');
  currentSlide = n;
  slides[currentSlide]?.classList.add('active');
  dots[currentSlide]?.classList.add('active');
  clearInterval(slideInterval);
  startSlideShow();
}

function startSlideShow() {
  if (heroSlides.length <= 1) return;
  slideInterval = setInterval(() => goToSlide((currentSlide + 1) % heroSlides.length), 5000);
}

// ============================================================
// CATEGORÍAS
// ============================================================
function renderCategories(categories) {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  if (!categories || categories.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0;">Añade categorías desde el Panel Administrativo</p>`;
    return;
  }
  container.innerHTML = categories.map(cat => `
    <div class="cat-card reveal" onclick="filterByCategory('${cat.name}')">
      <div class="cat-icon">${cat.icon || '🎀'}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-count">${cat.count || 0} productos</div>
    </div>
  `).join('');
  initReveal();
}

window.filterByCategory = function(cat) {
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  setActiveFilter(cat);
};

// ============================================================
// PRODUCTOS
// ============================================================
window.renderProducts = function(products) {
  const container = document.getElementById('products-grid');
  if (!container) return;
  container.innerHTML = '';

  if (!products || products.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:60px 0;font-family:var(--font-display);font-size:1.2rem;width:100%;">Aún no hay productos. Añáde los desde el Panel Administrativo.</p>`;
    return;
  }

  // Agrupar por categoria, mantendo orden de último produto adicionado
  const catOrder = [];
  const byCat = {};
  [...products].sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).forEach(p => {
    const cat = p.category || 'Sin categoría';
    if (!byCat[cat]) { byCat[cat] = []; catOrder.push(cat); }
    byCat[cat].push(p);
  });

  // Reordenar categorias: a do produto mais recente vai primeiro
  const orderedCats = catOrder.filter((c,i) => catOrder.indexOf(c) === i);

  orderedCats.forEach(cat => {
    const items = byCat[cat];
    const section = document.createElement('div');
    section.className = 'product-category-section';

    section.innerHTML = `
      <div class="product-cat-header">
        <h3 class="product-cat-title">${cat}</h3>
        <div class="carousel-arrows">
          <button class="car-arr car-prev" aria-label="Anterior">‹</button>
          <button class="car-arr car-next" aria-label="Siguiente">›</button>
        </div>
      </div>
      <div class="product-carousel">
        <div class="product-carousel-track"></div>
      </div>
      <div class="carousel-swipe-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        <span>Deslizá para ver más</span>
      </div>`;

    const track = section.querySelector('.product-carousel-track');
    items.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = buildProductCard(p);
      card.querySelector('.product-add-btn')?.addEventListener('click', e => { e.stopPropagation(); addToCart(p); });
      card.querySelector('.product-quick-add')?.addEventListener('click', e => { e.stopPropagation(); addToCart(p); });
      card.addEventListener('click', () => openProductModal(p));
      track.appendChild(card);
    });

    // Arrows carrossel
    const prev = section.querySelector('.car-prev');
    const next = section.querySelector('.car-next');
    const carousel = section.querySelector('.product-carousel');
    const scrollAmount = () => carousel.clientWidth * 0.8;
    prev.addEventListener('click', () => carousel.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
    next.addEventListener('click', () => carousel.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));

    // Swipe touch
    let startX = 0;
    carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', e => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        carousel.scrollBy({ left: diff > 0 ? scrollAmount() : -scrollAmount(), behavior: 'smooth' });
        carousel.classList.add('scrolled'); // esconde fade após primeiro swipe
      }
    }, { passive: true });

    // Esconder hint após scroll
    carousel.addEventListener('scroll', () => {
      carousel.classList.add('scrolled');
    }, { passive: true, once: true });

    container.appendChild(section);
  });

  // Esconder load-more (não precisamos mais de paginação)
  const btn = document.getElementById('load-more-btn');
  if (btn) btn.style.display = 'none';
};

function buildProductCard(p) {
  const badgeHTML = p.badge ? `<div class="product-badge badge-${p.badge}">${{promo:'🔥 Promo',destaque:'⭐ Destaque',nuevo:'Nuevo'}[p.badge]||p.badge}</div>` : '';
  const oldPriceHTML = p.oldPrice ? `<span class="product-price-old">$${fmt(p.oldPrice)}</span>` : '';
  return `
    <div class="product-img-wrap">
      ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div style="width:100%;height:100%;background:var(--cream-dark)"></div>'}
      ${badgeHTML}
      <button class="product-quick-add" title="Agregar">🛒</button>
    </div>
    <div class="product-info">
      <div class="product-category-tag">${p.category||''}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price-wrap">
        <span class="product-price">$${fmt(p.price)}</span>${oldPriceHTML}
      </div>
      <button class="product-add-btn">Agregar al carrito</button>
    </div>`;
}

function fmt(n) { return Number(n).toLocaleString('es-AR'); }

function setActiveFilter(cat) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === cat));
  currentPage = 0;
  filteredProducts = cat === 'todos' ? allProducts : allProducts.filter(p => p.category === cat);
  window.filteredProducts = filteredProducts;
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = '';
  window.renderProducts(filteredProducts);
}

function initProductFilters(categories) {
  const container = document.getElementById('filter-tabs');
  if (!container) return;
  const tabs = [{ name: 'Todos', value: 'todos' }, ...(categories||[]).map(c => ({ name: c.name, value: c.name }))];
  container.innerHTML = tabs.map((t, i) => `<button class="filter-tab${i===0?' active':''}" data-filter="${t.value}">${t.name}</button>`).join('');
  container.querySelectorAll('.filter-tab').forEach(btn => btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter)));
}

// ============================================================
// DESTAQUE & PROMO
// ============================================================
function renderDestaqueSection(product) {
  const section = document.getElementById('destaque-section');
  if (!section) return;
  if (!product) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('destaque-img').src = product.image || '';
  document.getElementById('destaque-name').textContent = product.name;
  document.getElementById('destaque-desc').textContent = product.description || '';
  document.getElementById('destaque-price').textContent = `$${fmt(product.price)}`;
  document.getElementById('destaque-btn').onclick = () => addToCart(product);
}

function renderPromoSection(product) {
  const section = document.getElementById('promo-section');
  if (!section) return;
  if (!product) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('promo-product-name').textContent = product.name;
  document.getElementById('promo-product-price').textContent = `$${fmt(product.price)}`;
  const img = document.getElementById('promo-product-img');
  if (img) img.src = product.image || '';
  document.getElementById('promo-add-btn').onclick = () => addToCart(product);
}

// ============================================================
// BLOG
// ============================================================
function renderBlogSection(articles) {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  const latest = (articles||[]).filter(a => a.published !== false).sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 10);
  if (latest.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px 0;font-family:var(--font-display);font-size:1.2rem;">Próximamente: artículos sobre maternidad</p>`;
    return;
  }
  grid.innerHTML = latest.map(a => `
    <div class="blog-card reveal" onclick="window.location.href='blog.html?id=${a.id}'">
      <div class="blog-img">${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : ''}</div>
      <div class="blog-body">
        <div class="blog-date">${fmtDate(a.createdAt)}</div>
        <div class="blog-title">${a.title}</div>
        <div class="blog-excerpt">${(a.excerpt||'').slice(0,120)}...</div>
        <div class="blog-read-more">Leer más <span>→</span></div>
      </div>
    </div>
  `).join('');
  initReveal();
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
}

// ============================================================
// CARRITO
// ============================================================
function saveCart() {
  localStorage.setItem('zoeveos_cart', JSON.stringify(cart));
  validateAppliedBenefits(); // verifica se ainda cumpre requisitos
  updateCartUI();
  if (typeof refreshCartBenefits === 'function') refreshCartBenefits();
}

function validateAppliedBenefits() {
  if (cart.length === 0) {
    // Carrinho vazio — remove tudo
    appliedCoupon = null;
    appliedPromo = null;
    return;
  }

  // Valida promoção aplicada
  if (appliedPromo) {
    const sub = cart.reduce((s,i) => s + i.price * i.qty, 0);
    let stillValid = false;

    if (appliedPromo.type === 'valor_minimo') {
      stillValid = sub >= appliedPromo.minValue;
    } else if (appliedPromo.type === 'leve_n') {
      const relevant = appliedPromo.limitCategory
        ? cart.filter(i => i.category === appliedPromo.limitCategory)
        : cart;
      const qty = relevant.reduce((s,i) => s + i.qty, 0);
      stillValid = qty >= appliedPromo.minQty;
    } else if (appliedPromo.type === 'frete_gratis') {
      stillValid = sub >= appliedPromo.minValue;
    }

    if (!stillValid) {
      appliedPromo = null;
      showToast('⚠️ Promoción removida: ya no cumple los requisitos');
    }
  }
}

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) existing.qty++;
  else cart.push({ ...product, qty: 1 });
  saveCart();
  showToast(`✅ ${product.name} agregado`);
  openCart();
}

window.updateCartQty = function(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
};

function updateCartUI() {
  const count = cart.reduce((s,i) => s + i.qty, 0);
  const countEl = document.getElementById('cart-count');
  if (countEl) { countEl.textContent = count; countEl.classList.toggle('visible', count > 0); }
  renderCartItems();
  updateCartTotals();
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image||''}" alt="${item.name}" onerror="this.style.background='var(--cream-dark)'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${fmt(item.price * item.qty)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateCartQty('${item.id}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">✕</button>
    </div>
  `).join('');
}

function getSubtotal() { return cart.reduce((s,i) => s + i.price * i.qty, 0); }
function getDiscount() {
  const sub = getSubtotal();
  let disc = 0;

  // Desconto do cupom
  if (appliedCoupon) {
    disc += Math.round(sub * appliedCoupon.discount / 100);
  }

  // Desconto da promoção
  if (appliedPromo) {
    if (appliedPromo.type === 'valor_minimo' || appliedPromo.type === 'leve_n') {
      if (appliedPromo.discountType === 'percent') {
        disc += Math.round(sub * appliedPromo.discountValue / 100);
      } else {
        disc += Number(appliedPromo.discountValue);
      }
    }
    // frete_gratis é tratado separadamente no cálculo de frete
  }

  return Math.min(disc, sub); // nunca desconta mais que o subtotal
}

function updateCartTotals() {
  const sub = getSubtotal(), disc = getDiscount(), total = sub - disc;
  const subEl = document.getElementById('cart-subtotal'); if (subEl) subEl.textContent = `$${fmt(sub)}`;
  const discEl = document.getElementById('cart-discount'); if (discEl) { discEl.textContent = `-$${fmt(disc)}`; discEl.parentElement.style.display = disc > 0 ? 'flex' : 'none'; }
  const totEl = document.getElementById('cart-total'); if (totEl) totEl.textContent = `$${fmt(total)}`;
}

function openCart() { document.getElementById('cart-overlay')?.classList.add('open'); document.getElementById('cart-drawer')?.classList.add('open'); document.body.style.overflow = 'hidden'; if (typeof refreshCartBenefits === 'function') refreshCartBenefits(); }
function closeCart() { document.getElementById('cart-overlay')?.classList.remove('open'); document.getElementById('cart-drawer')?.classList.remove('open'); document.body.style.overflow = ''; }

async function applyCoupon(code) {
  const msgEl = document.getElementById('coupon-msg');
  try {
    const snap = await getDocs(collection(db, 'cupones'));
    const now = Date.now();
    const coupon = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .find(c => c.code?.toUpperCase() === code.toUpperCase() && c.expiry > now);
    if (coupon) {
      appliedCoupon = coupon;
      msgEl.className = 'cart-coupon-msg success';
      msgEl.textContent = `✅ Cupón aplicado: ${coupon.discount}% de descuento`;
    } else {
      appliedCoupon = null;
      msgEl.className = 'cart-coupon-msg error';
      msgEl.textContent = '❌ Cupón inválido o expirado';
    }
  } catch(e) {
    appliedCoupon = null;
    msgEl.className = 'cart-coupon-msg error';
    msgEl.textContent = '❌ Error al verificar cupón';
  }
  updateCartTotals();
}

// ============================================================
// CHECKOUT
// ============================================================
function openCheckout() {
  closeCart();
  document.getElementById('checkout-modal')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  updateCheckoutSummary();
}
function closeCheckout() { document.getElementById('checkout-modal')?.classList.remove('open'); document.body.style.overflow = ''; }

function updateCheckoutSummary() {
  const sub = getSubtotal();
  const disc = getDiscount();
  const el = document.getElementById('checkout-subtotal');
  if (el) el.textContent = `$${fmt(sub - disc)}`;
  // Atualiza total também
  updateCheckoutTotal();
}

async function calculateShipping(postalCode) {
  const container = document.getElementById('shipping-options');
  if (!container || !postalCode || postalCode.length < 3) return;
  container.innerHTML = '<div class="shipping-loading">🔄 Calculando flete con Correo Argentino...</div>';

  // Credenciales desde config admin en Firestore
  try {
    const configDoc = await getDoc(doc(db, 'config', 'shipping'));
    const cfg = configDoc.exists() ? configDoc.data() : {};
    const user = cfg.correoUser || '';
    const pass = cfg.correoPass || '';
    const customerId = cfg.correoCustomerId || '';
    const defaultShipping = cfg.defaultShipping || 1500;

    if (!user || !pass || !customerId) {
      showFallbackShipping(container, defaultShipping, postalCode);
      return;
    }

    // 1) Obtener JWT token
    const tokenRes = await fetch('https://api.correoargentino.com.ar/micorreo/v1/token', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(user + ':' + pass) }
    });

    if (!tokenRes.ok) { showFallbackShipping(container, defaultShipping, postalCode); return; }
    const tokenData = await tokenRes.json();
    const token = tokenData.token;

    // 2) Cotizar envío
    const ratesRes = await fetch('https://api.correoargentino.com.ar/micorreo/v1/rates', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        postalCodeOrigin: CORREO_ORIGIN_POSTAL,
        postalCodeDestination: postalCode,
        dimensions: { weight: 500, height: 15, width: 20, length: 25 }
      })
    });

    if (!ratesRes.ok) { showFallbackShipping(container, defaultShipping, postalCode); return; }
    const ratesData = await ratesRes.json();
    const rates = ratesData.rates || [];

    if (rates.length === 0) { showFallbackShipping(container, defaultShipping, postalCode); return; }

    const freeShipping = await checkFreeShipping();
    container.innerHTML = rates.map((r, i) => `
      <label class="shipping-option${i===0?' selected':''}">
        <input type="radio" name="shipping" value="${r.price}" data-name="${r.productName}" ${i===0?'checked':''}>
        <div class="shipping-option-info">
          <div class="shipping-option-name">${r.productName}</div>
          <div class="shipping-option-time">Entrega en ${r.deliveryTimeMin}-${r.deliveryTimeMax} días hábiles</div>
        </div>
        <div class="shipping-option-price">${freeShipping ? '<span style="color:#2e7d32">¡GRATIS!</span>' : '$'+fmt(r.price)}</div>
      </label>
    `).join('');

    addShippingListeners(container);
    updateCheckoutTotal();
  } catch(e) {
    const configDoc = await getDoc(doc(db, 'config', 'shipping')).catch(() => null);
    const defaultShipping = configDoc?.exists() ? (configDoc.data().defaultShipping || 1500) : 1500;
    showFallbackShipping(container, defaultShipping, postalCode);
  }
}

function showFallbackShipping(container, price, postalCode) {
  checkFreeShipping().then(free => {
    container.innerHTML = `
      <label class="shipping-option selected">
        <input type="radio" name="shipping" value="${price}" data-name="Correo Argentino" checked>
        <div class="shipping-option-info">
          <div class="shipping-option-name">Correo Argentino</div>
          <div class="shipping-option-time">3-7 días hábiles</div>
        </div>
        <div class="shipping-option-price">${free ? '<span style="color:#2e7d32">¡GRATIS!</span>' : '$'+fmt(price)}</div>
      </label>`;
    addShippingListeners(container);
    updateCheckoutTotal();
  });
}

function addShippingListeners(container) {
  container.querySelectorAll('.shipping-option').forEach(opt => {
    opt.querySelector('input')?.addEventListener('change', () => {
      container.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      updateCheckoutTotal();
    });
  });
}

async function checkFreeShipping() {
  try {
    const snap = await getDocs(collection(db, 'promotions'));
    const subtotal = getSubtotal() - getDiscount();
    return snap.docs.some(d => {
      const p = d.data();
      return p.type === 'frete_gratis' && p.active && subtotal >= p.minValue;
    });
  } catch { return false; }
}

function updateCheckoutTotal() {
  const sel = document.querySelector('input[name="shipping"]:checked');
  const ship = sel ? parseFloat(sel.value) || 0 : 0;
  const sub = getSubtotal();
  const disc = getDiscount();

  // Mostrar total imediatamente sem esperar frete
  const totEl = document.getElementById('checkout-total');
  if (totEl) totEl.textContent = `$${fmt(sub - disc + ship)}`;

  // Depois verifica frete grátis
  checkFreeShipping().then(free => {
    const shippingCost = free ? 0 : ship;
    const total = sub - disc + shippingCost;
    const sc = document.getElementById('checkout-shipping-cost');
    if (sc) sc.textContent = shippingCost === 0 ? '¡GRATIS!' : `$${fmt(shippingCost)}`;
    if (totEl) totEl.textContent = `$${fmt(total)}`;
  });
}

async function submitCheckout() {
  const name = document.getElementById('co-name')?.value?.trim();
  const whatsapp = document.getElementById('co-whatsapp')?.value?.trim();
  const street = document.getElementById('co-street')?.value?.trim();
  const number = document.getElementById('co-number')?.value?.trim();
  const barrio = document.getElementById('co-barrio')?.value?.trim();
  const city = document.getElementById('co-city')?.value?.trim();
  const postal = document.getElementById('co-postal')?.value?.trim();

  if (!name || !whatsapp || !street || !number || !city || !postal) {
    showToast('❌ Por favor completa todos los campos obligatorios', 'error'); return;
  }

  const sel = document.querySelector('input[name="shipping"]:checked');
  const shipName = sel?.dataset?.name || 'Correo Argentino';
  const free = await checkFreeShipping();
  const shipCost = free ? 0 : (sel ? parseFloat(sel.value) : 0);
  const subtotal = getSubtotal();
  const disc = getDiscount(); // já inclui cupom + promoção
  const total = Math.max(0, subtotal - disc + shipCost);

  const items = cart.map(i => `• ${i.name} x${i.qty} = $${fmt(i.price * i.qty)}`).join('\n');
  const discLine = disc > 0 ? `\n🎟 Descuento: -$${fmt(disc)}` : '';
  const shipLine = shipCost === 0 ? '\n🎁 ¡Envío GRATIS!' : `\n🚚 Envío (${shipName}): $${fmt(shipCost)}`;
  const couponLine = appliedCoupon ? `\n🎟 Cupón: ${appliedCoupon.code}` : '';

  const message = `¡Hola! ¡Vengo a finalizar una compra del sitio ZOE VEOS! 🛍️

👤 *Nombre:* ${name}
📱 *WhatsApp:* ${whatsapp}
📍 *Dirección:* ${street} ${number}${barrio?', '+barrio:''}, ${city} (CP: ${postal})

🛒 *Productos:*
${items}${discLine}${shipLine}${couponLine}

💰 *TOTAL: $${fmt(total)}*`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  closeCheckout();
  cart = []; appliedCoupon = null; saveCart();
  showToast('✅ ¡Gracias! Redirigiendo a WhatsApp...');
}

// ============================================================
// MODAL PRODUCTO
// ============================================================
function openProductModal(product) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  // Suporte a múltiplas fotos
  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image ? [product.image] : [];
  let currentImg = 0;

  function renderGallery() {
    const mainImg = modal.querySelector('#pm-img');
    const thumbsWrap = modal.querySelector('#pm-thumbs');
    const prevBtn = modal.querySelector('#pm-prev');
    const nextBtn = modal.querySelector('#pm-next');
    if (mainImg) { mainImg.src = images[currentImg] || ''; mainImg.style.display = images.length ? 'block' : 'none'; }
    if (thumbsWrap) {
      thumbsWrap.innerHTML = images.length > 1 ? images.map((img, i) => `
        <div class="pm-thumb${i === currentImg ? ' active' : ''}" data-i="${i}">
          <img src="${img}" alt="Foto ${i+1}">
        </div>`).join('') : '';
      thumbsWrap.style.display = images.length > 1 ? 'flex' : 'none';
      thumbsWrap.querySelectorAll('.pm-thumb').forEach(t => {
        t.addEventListener('click', () => { currentImg = parseInt(t.dataset.i); renderGallery(); });
      });
    }
    if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
  }

  const prevBtn = modal.querySelector('#pm-prev');
  const nextBtn = modal.querySelector('#pm-next');
  if (prevBtn) prevBtn.onclick = () => { currentImg = (currentImg - 1 + images.length) % images.length; renderGallery(); };
  if (nextBtn) nextBtn.onclick = () => { currentImg = (currentImg + 1) % images.length; renderGallery(); };

  modal.querySelector('#pm-cat').textContent = product.category || '';
  modal.querySelector('#pm-name').textContent = product.name;
  modal.querySelector('#pm-price').textContent = `$${fmt(product.price)}`;
  modal.querySelector('#pm-desc').textContent = product.description || '';
  modal.querySelector('#pm-add').onclick = () => { addToCart(product); closeProductModal(); };

  renderGallery();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProductModal() { document.getElementById('product-modal')?.classList.remove('open'); document.body.style.overflow = ''; }

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3500);
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.stagger-children').forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

// ============================================================
// FIREBASE DATA LOADER
// ============================================================
async function loadFromFirebase() {
  try {
    // Slides
    const slidesSnap = await getDocs(query(collection(db, 'slides'), orderBy('createdAt', 'asc')));
    const slides = slidesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    initHeroSlider(slides);

    // Products — carrega ANTES das categorias pra calcular count correto
    const prodsSnap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
    allProducts = prodsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    window.allProducts = allProducts;
    filteredProducts = allProducts;
    window.filteredProducts = filteredProducts;
    window.currentPage = 0;
    window.renderProducts(allProducts);

    // Categories — agora conta produtos reais por categoria
    const catsSnap = await getDocs(collection(db, 'categories'));
    const categories = catsSnap.docs.map(d => {
      const cat = { id: d.id, ...d.data() };
      // Contar quantos produtos existem nessa categoria
      cat.count = allProducts.filter(p => p.category === cat.name).length;
      return cat;
    });
    renderCategories(categories);
    initProductFilters(categories);

    // Destaque
    const destDoc = await getDoc(doc(db, 'config', 'destaque'));
    renderDestaqueSection(destDoc.exists() ? destDoc.data() : null);

    // Promo section
    const promoDoc = await getDoc(doc(db, 'config', 'promo_section'));
    renderPromoSection(promoDoc.exists() ? promoDoc.data()?.product : null);
    if (promoDoc.exists() && promoDoc.data()?.text) {
      const el = document.getElementById('promo-section-text');
      if (el) el.textContent = promoDoc.data().text;
    }

    // Blog
    const artSnap = await getDocs(query(collection(db, 'articles'), orderBy('createdAt', 'desc')));
    const articles = artSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBlogSection(articles);

  } catch(e) {
    console.error('Firebase load error:', e);
    initHeroSlider([]);
    renderCategories([]);
    initProductFilters([]);
    window.renderProducts([]);
  }
}

// ============================================================
// SORT
// ============================================================
window.handleSort = function(value) {
  let sorted = [...(window.filteredProducts || window.allProducts || [])];
  if (value === 'price-asc') sorted.sort((a,b) => a.price - b.price);
  else if (value === 'price-desc') sorted.sort((a,b) => b.price - a.price);
  else if (value === 'newest') sorted.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = '';
  window.currentPage = 0;
  window.filteredProducts = sorted;
  window.renderProducts(sorted);
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initLoader();
  initHeader();
  initReveal();
  updateCartUI();
  await loadFromFirebase();

  // Cart
  document.getElementById('cart-btn')?.addEventListener('click', openCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);

  // Coupon
  document.getElementById('coupon-apply-btn')?.addEventListener('click', () => {
    const code = document.getElementById('coupon-input')?.value?.trim();
    if (code) applyCoupon(code);
  });
  document.getElementById('coupon-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const code = e.target.value.trim(); if (code) applyCoupon(code); }
  });

  // Checkout
  document.getElementById('checkout-btn')?.addEventListener('click', openCheckout);
  document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
  document.getElementById('checkout-submit')?.addEventListener('click', submitCheckout);
  document.getElementById('co-postal')?.addEventListener('blur', e => calculateShipping(e.target.value));

  // Product modal
  document.getElementById('product-modal-close')?.addEventListener('click', closeProductModal);
  document.getElementById('product-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeProductModal(); });

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    window.currentPage = (window.currentPage || 0) + 1;
    currentPage = window.currentPage;
    window.renderProducts(window.filteredProducts || allProducts, true);
  });

  window.addEventListener('scroll', initReveal, { passive: true });
});

// ============================================================
// CARRINHO — Cupons e Promos automáticos
// ============================================================
let appliedPromo = null;

async function refreshCartBenefits() {
  const promoSection = document.getElementById('cart-promos-section');
  const cuponSection = document.getElementById('cart-cupones-section');
  if (cart.length === 0) {
    if (promoSection) promoSection.style.display = 'none';
    if (cuponSection) cuponSection.style.display = 'none';
    return;
  }
  // Rodar em paralelo sem bloquear a UI
  loadAvailablePromos();
  loadAvailableCupones();
}

async function loadAvailableCupones() {
  const section = document.getElementById('cart-cupones-section');
  const list = document.getElementById('cart-cupones-list');
  if (!section || !list) return;
  try {
    const snap = await getDocs(collection(db, 'cupones'));
    const now = Date.now();
    const active = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.expiry > now);
    if (active.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    list.innerHTML = active.map(c => {
      const isApplied = appliedCoupon?.id === c.id;
      return `<div class="cart-benefit-item cart-cupon-item">
        <div class="cart-benefit-info">
          <div class="cart-benefit-name">🎟 ${c.code}</div>
          <div class="cart-benefit-desc">${c.discount}% de descuento</div>
        </div>
        ${isApplied
          ? '<span class="benefit-applied">✅ Aplicado</span>'
          : `<button class="cart-benefit-apply apply-cupon" onclick="applyCuponDirect('${c.id}','${c.code}',${c.discount})">Aplicar</button>`}
      </div>`;
    }).join('');

    // toggle
    const toggle = document.getElementById('cart-cupones-toggle');
    const listEl = document.getElementById('cart-cupones-list');
    if (toggle && !toggle._bound) {
      toggle._bound = true;
      toggle.addEventListener('click', () => {
        listEl.classList.toggle('open');
        document.getElementById('cupones-arrow').textContent = listEl.classList.contains('open') ? '▴' : '▾';
      });
    }
  } catch(e) {}
}

async function loadAvailablePromos() {
  const section = document.getElementById('cart-promos-section');
  const list = document.getElementById('cart-promos-list');
  if (!section || !list) return;
  const subtotal = getSubtotal();
  try {
    const snap = await getDocs(collection(db, 'promotions'));
    const eligible = [];
    snap.docs.forEach(d => {
      const p = { id: d.id, ...d.data() };
      if (!p.active) return;
      if (p.type === 'valor_minimo' && subtotal >= p.minValue) {
        const disc = p.discountType === 'percent' ? p.discountValue+'%' : '$'+fmt(p.discountValue);
        eligible.push({ ...p, label: `💰 Compraste $${fmt(subtotal)}`, desc: `Obtené ${disc} de descuento` });
      }
      if (p.type === 'leve_n') {
        const relevant = p.limitCategory ? cart.filter(i => i.category === p.limitCategory) : cart;
        const qty = relevant.reduce((s,i) => s + i.qty, 0);
        if (qty >= p.minQty) {
          const disc = p.discountType === 'percent' ? p.discountValue+'%' : '$'+fmt(p.discountValue);
          const cat = p.limitCategory ? ` en ${p.limitCategory}` : '';
          eligible.push({ ...p, label: `🛍️ ${qty} productos${cat}`, desc: `Obtené ${disc} de descuento` });
        }
      }
      if (p.type === 'frete_gratis' && subtotal >= p.minValue) {
        eligible.push({ ...p, label: '🚚 Envío GRATIS', desc: `Por compras mayores a $${fmt(p.minValue)}` });
      }
    });
    if (eligible.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = eligible.map(p => {
      const isApplied = appliedPromo?.id === p.id;
      return `<div class="cart-benefit-item cart-promo-item">
        <div class="cart-benefit-info">
          <div class="cart-benefit-name">${p.label}</div>
          <div class="cart-benefit-desc">${p.desc}</div>
        </div>
        ${isApplied
          ? '<span class="benefit-applied">✅ Aplicado</span>'
          : `<button class="cart-benefit-apply apply-promo" onclick="applyPromoDirect('${p.id}')">Aplicar</button>`}
      </div>`;
    }).join('');
  } catch(e) {}
}

window.applyCuponDirect = function(id, code, discount) {
  appliedCoupon = { id, code, discount };
  updateCartTotals();
  updateCheckoutTotal();
  loadAvailableCupones();
  const msg = document.getElementById('coupon-msg');
  if (msg) { msg.className = 'cart-coupon-msg success'; msg.textContent = `✅ Cupón ${code} aplicado: ${discount}% de descuento`; }
  showToast(`✅ Cupón ${code} aplicado`);
};

window.applyPromoDirect = async function(promoId) {
  try {
    const snap = await getDocs(collection(db, 'promotions'));
    const promo = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(p => p.id === promoId);
    if (!promo) return;
    appliedPromo = promo;
    updateCartTotals();
    updateCheckoutTotal();
    loadAvailablePromos();
    showToast('✅ ¡Promoción aplicada!');
  } catch(e) { console.error('applyPromoDirect error:', e); }
};
