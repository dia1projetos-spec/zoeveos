// ============================================================
// ZOE VEOS — JavaScript Principal
// ============================================================

// ============================================================
// CONFIG (se llena desde firebase-config.js en producción)
// ============================================================
const WHATSAPP_NUMBER = "5493576466145";
const CORREO_POSTAL_ORIGIN = "2434";

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
// LOADER
// ============================================================
function initLoader() {
  const loader = document.getElementById('loader');
  const video = document.getElementById('loader-video');
  const bar = document.querySelector('.loader-bar');

  if (!loader) return;

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 3 + 1;
    if (progress >= 100) { progress = 100; clearInterval(interval); }
    bar.style.width = progress + '%';
  }, 80);

  function finishLoader() {
    clearInterval(interval);
    bar.style.width = '100%';
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => { loader.style.display = 'none'; }, 800);
    }, 400);
  }

  if (video) {
    video.addEventListener('ended', finishLoader);
    video.addEventListener('error', finishLoader);
    setTimeout(finishLoader, 8000); // max 8s
  } else {
    setTimeout(finishLoader, 3000);
  }
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

  // Hamburger
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

  // Render slides
  container.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';

  if (!slides || slides.length === 0) {
    container.innerHTML = `
      <div class="hero-slide active">
        <div class="hero-slide-placeholder">
          <span>🌸 Añade slides desde el Panel Administrativo</span>
        </div>
      </div>`;
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
      dot.setAttribute('aria-label', `Slide ${i+1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    }
  });

  startSlideShow();

  document.getElementById('hero-prev')?.addEventListener('click', () => {
    goToSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length);
  });
  document.getElementById('hero-next')?.addEventListener('click', () => {
    goToSlide((currentSlide + 1) % heroSlides.length);
  });
}

function goToSlide(n) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  slides[currentSlide]?.classList.remove('active');
  dots[currentSlide]?.classList.remove('active');
  currentSlide = n;
  slides[currentSlide]?.classList.add('active');
  dots[currentSlide]?.classList.add('active');
  resetSlideShow();
}

function startSlideShow() {
  if (heroSlides.length <= 1) return;
  slideInterval = setInterval(() => {
    goToSlide((currentSlide + 1) % heroSlides.length);
  }, 5000);
}

function resetSlideShow() {
  clearInterval(slideInterval);
  startSlideShow();
}

// ============================================================
// CATEGORÍAS
// ============================================================
function renderCategories(categories) {
  const container = document.getElementById('categories-grid');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0;">
      Añade categorías desde el Panel Administrativo</p>`;
    return;
  }

  container.innerHTML = categories.map(cat => `
    <div class="cat-card reveal" data-filter="${cat.name}" onclick="filterByCategory('${cat.name}')">
      <div class="cat-icon">${cat.icon || '🎀'}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-count">${cat.count || 0} productos</div>
    </div>
  `).join('');

  initReveal();
}

function filterByCategory(cat) {
  const productsSection = document.getElementById('products');
  if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
  setActiveFilter(cat);
}

// ============================================================
// PRODUCTOS
// ============================================================
function renderProducts(products, append = false) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (!append) {
    grid.innerHTML = '';
    if (!products || products.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px 0;font-family:var(--font-display);font-size:1.2rem;">
        Aún no hay productos. Añáde los desde el Panel Administrativo.</p>`;
      return;
    }
  }

  const start = append ? currentPage * PRODUCTS_PER_PAGE : 0;
  const items = products.slice(start, start + PRODUCTS_PER_PAGE);

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card reveal';
    card.innerHTML = buildProductCard(p);
    card.querySelector('.product-add-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(p);
    });
    card.querySelector('.product-quick-add')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(p);
    });
    card.addEventListener('click', () => openProductModal(p));
    grid.appendChild(card);
  });

  initReveal();

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    const totalShown = (currentPage + 1) * PRODUCTS_PER_PAGE;
    loadMoreBtn.style.display = totalShown >= products.length ? 'none' : 'block';
  }
}

function buildProductCard(p) {
  const priceFormatted = formatPrice(p.price);
  const oldPriceHTML = p.oldPrice ? `<span class="product-price-old">$${formatPrice(p.oldPrice)}</span>` : '';
  const badgeHTML = p.badge ? `<div class="product-badge badge-${p.badge}">${getBadgeLabel(p.badge)}</div>` : '';

  return `
    <div class="product-img-wrap">
      ${p.image ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` : '<div style="width:100%;height:100%;background:var(--cream-dark);"></div>'}
      ${badgeHTML}
      <button class="product-quick-add" title="Agregar al carrito">🛒</button>
    </div>
    <div class="product-info">
      <div class="product-category-tag">${p.category || ''}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price-wrap">
        <span class="product-price">$${priceFormatted}</span>
        ${oldPriceHTML}
      </div>
      <button class="product-add-btn">Agregar al carrito</button>
    </div>
  `;
}

function getBadgeLabel(badge) {
  const labels = { promo: '🔥 Promo', destaque: '⭐ Destaque', nuevo: 'Nuevo' };
  return labels[badge] || badge;
}

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR');
}

function setActiveFilter(cat) {
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === cat);
  });
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = '';
  currentPage = 0;
  filteredProducts = cat === 'todos'
    ? allProducts
    : allProducts.filter(p => p.category === cat);
  renderProducts(filteredProducts);
}

function initProductFilters(categories) {
  const container = document.getElementById('filter-tabs');
  if (!container) return;

  const tabs = [{ name: 'Todos', value: 'todos' }, ...(categories || []).map(c => ({ name: c.name, value: c.name }))];
  container.innerHTML = tabs.map((t, i) => `
    <button class="filter-tab${i === 0 ? ' active' : ''}" data-filter="${t.value}">${t.name}</button>
  `).join('');

  container.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter));
  });
}

// ============================================================
// DESTAQUE & PROMO SECTIONS
// ============================================================
function renderDestaqueSection(product) {
  const section = document.getElementById('destaque-section');
  if (!section) return;

  if (!product) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  document.getElementById('destaque-img').src = product.image || '';
  document.getElementById('destaque-name').textContent = product.name;
  document.getElementById('destaque-desc').textContent = product.description || '';
  document.getElementById('destaque-price').textContent = `$${formatPrice(product.price)}`;
  document.getElementById('destaque-btn').onclick = () => addToCart(product);
}

function renderPromoSection(product) {
  const section = document.getElementById('promo-section');
  if (!section) return;

  if (!product) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  document.getElementById('promo-product-name').textContent = product.name;
  document.getElementById('promo-product-price').textContent = `$${formatPrice(product.price)}`;
  if (document.getElementById('promo-product-img'))
    document.getElementById('promo-product-img').src = product.image || '';
  document.getElementById('promo-add-btn').onclick = () => addToCart(product);
}

// ============================================================
// BLOG
// ============================================================
function renderBlogSection(articles) {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;

  const latest = (articles || []).sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 10);

  if (latest.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px 0;font-family:var(--font-display);font-size:1.2rem;">
      Próximamente: artículos sobre maternidad</p>`;
    return;
  }

  grid.innerHTML = latest.map(a => `
    <div class="blog-card reveal" onclick="openBlogPost('${a.id}')">
      <div class="blog-img">
        ${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : ''}
      </div>
      <div class="blog-body">
        <div class="blog-date">${formatDate(a.createdAt)}</div>
        <div class="blog-title">${a.title}</div>
        <div class="blog-excerpt">${(a.excerpt || stripHtml(a.content || '')).slice(0, 120)}...</div>
        <div class="blog-read-more">Leer más <span>→</span></div>
      </div>
    </div>
  `).join('');

  initReveal();
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
}

function openBlogPost(id) {
  window.location.href = `blog.html?id=${id}`;
}

// ============================================================
// CARRITO
// ============================================================
function saveCart() {
  localStorage.setItem('zoeveos_cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart();
  showToast(`✅ ${product.name} agregado al carrito`);
  openCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    countEl.textContent = count;
    countEl.classList.toggle('visible', count > 0);
  }

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
    <div class="cart-item" data-id="${item.id}">
      <img class="cart-item-img" src="${item.image || ''}" alt="${item.name}" 
           onerror="this.style.background='var(--cream-dark)'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${formatPrice(item.price * item.qty)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Eliminar">✕</button>
    </div>
  `).join('');
}

function getSubtotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function getDiscount() {
  if (!appliedCoupon) return 0;
  return Math.round(getSubtotal() * appliedCoupon.discount / 100);
}

function updateCartTotals() {
  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = subtotal - discount;

  document.getElementById('cart-subtotal')?.setContent?.call(document.getElementById('cart-subtotal'), `$${formatPrice(subtotal)}`);
  const sub = document.getElementById('cart-subtotal');
  if (sub) sub.textContent = `$${formatPrice(subtotal)}`;
  const disc = document.getElementById('cart-discount');
  if (disc) { disc.textContent = `-$${formatPrice(discount)}`; disc.parentElement.style.display = discount > 0 ? 'flex' : 'none'; }
  const tot = document.getElementById('cart-total');
  if (tot) tot.textContent = `$${formatPrice(total)}`;
}

function openCart() {
  document.getElementById('cart-overlay')?.classList.add('open');
  document.getElementById('cart-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
}

function applyCoupon(code) {
  // En producción: consultar Firebase
  const coupons = JSON.parse(localStorage.getItem('zoeveos_cupones') || '[]');
  const now = Date.now();
  const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.expiry > now);

  const msgEl = document.getElementById('coupon-msg');
  if (coupon) {
    appliedCoupon = coupon;
    msgEl.className = 'cart-coupon-msg success';
    msgEl.textContent = `✅ Cupón aplicado: ${coupon.discount}% de descuento`;
  } else {
    appliedCoupon = null;
    msgEl.className = 'cart-coupon-msg error';
    msgEl.textContent = `❌ Cupón inválido o expirado`;
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

function closeCheckout() {
  document.getElementById('checkout-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function updateCheckoutSummary() {
  const subtotal = getSubtotal();
  const discount = getDiscount();
  const el = document.getElementById('checkout-subtotal');
  if (el) el.textContent = `$${formatPrice(subtotal - discount)}`;
}

async function calculateShipping(postalCode) {
  const container = document.getElementById('shipping-options');
  if (!container) return;
  if (!postalCode || postalCode.length < 4) {
    container.innerHTML = '<div class="shipping-loading">Ingresa un código postal válido</div>';
    return;
  }

  container.innerHTML = '<div class="shipping-loading">🔄 Calculando flete...</div>';

  // CORREO ARGENTINO API - MiCorreo /rates
  // En producción necesitas autenticarte primero con /token
  // Aquí simulamos la respuesta para poder probar el flujo
  // ⚠️ REEMPLAZAR con llamada real cuando tengas credenciales

  try {
    // Simulación de cotización (reemplazar con llamada real)
    await new Promise(r => setTimeout(r, 1200));

    const fakeRates = [
      {
        productName: 'Correo Argentino Clásico',
        deliveredType: 'D',
        price: calcFakeShipping(postalCode, 'clasico'),
        deliveryTimeMin: '3',
        deliveryTimeMax: '7'
      },
      {
        productName: 'Correo Argentino Express',
        deliveredType: 'D',
        price: calcFakeShipping(postalCode, 'express'),
        deliveryTimeMin: '1',
        deliveryTimeMax: '3'
      }
    ];

    // Verificar frete grátis
    const freeShipping = checkFreeShipping();

    container.innerHTML = fakeRates.map((r, i) => `
      <label class="shipping-option${i===0?' selected':''}">
        <input type="radio" name="shipping" value="${r.price}" data-name="${r.productName}" ${i===0?'checked':''}>
        <div class="shipping-option-info">
          <div class="shipping-option-name">${r.productName}</div>
          <div class="shipping-option-time">Entrega en ${r.deliveryTimeMin}-${r.deliveryTimeMax} días hábiles</div>
        </div>
        <div class="shipping-option-price">${freeShipping ? '<span style="color:#2e7d32;font-size:0.85rem;">¡GRATIS!</span>' : '$'+formatPrice(r.price)}</div>
      </label>
    `).join('');

    container.querySelectorAll('.shipping-option').forEach(opt => {
      opt.querySelector('input')?.addEventListener('change', () => {
        container.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        updateCheckoutTotal();
      });
    });

    updateCheckoutTotal();
  } catch (e) {
    container.innerHTML = `<div class="shipping-loading" style="color:var(--terra)">
      No se pudo calcular el flete. Intenta de nuevo.</div>`;
  }
}

function calcFakeShipping(postalCode, tipo) {
  // Estimación básica por código postal (reemplazar con API real)
  const base = tipo === 'express' ? 2800 : 1800;
  const extra = parseInt(postalCode.substring(0,1)) * 200;
  return base + extra;
}

function checkFreeShipping() {
  const promotions = JSON.parse(localStorage.getItem('zoeveos_promotions') || '[]');
  const subtotal = getSubtotal() - getDiscount();
  return promotions.some(p => p.type === 'frete_gratis' && p.active && subtotal >= p.minValue);
}

function updateCheckoutTotal() {
  const selectedInput = document.querySelector('input[name="shipping"]:checked');
  const shippingCost = selectedInput && !checkFreeShipping() ? parseFloat(selectedInput.value) : 0;
  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = subtotal - discount + shippingCost;

  document.getElementById('checkout-shipping-cost')?.let?.((el) => el.textContent = `$${formatPrice(shippingCost)}`);
  const sc = document.getElementById('checkout-shipping-cost');
  if (sc) sc.textContent = shippingCost === 0 ? '¡GRATIS!' : `$${formatPrice(shippingCost)}`;
  const tot = document.getElementById('checkout-total');
  if (tot) tot.textContent = `$${formatPrice(total)}`;
}

function submitCheckout() {
  const name = document.getElementById('co-name')?.value?.trim();
  const whatsapp = document.getElementById('co-whatsapp')?.value?.trim();
  const street = document.getElementById('co-street')?.value?.trim();
  const number = document.getElementById('co-number')?.value?.trim();
  const barrio = document.getElementById('co-barrio')?.value?.trim();
  const city = document.getElementById('co-city')?.value?.trim();
  const postal = document.getElementById('co-postal')?.value?.trim();

  if (!name || !whatsapp || !street || !number || !city || !postal) {
    showToast('❌ Por favor completa todos los campos obligatorios', 'error');
    return;
  }

  const selectedShipping = document.querySelector('input[name="shipping"]:checked');
  const shippingName = selectedShipping?.dataset?.name || 'Correo Argentino';
  const shippingCost = selectedShipping && !checkFreeShipping() ? parseFloat(selectedShipping.value) : 0;

  const subtotal = getSubtotal();
  const discount = getDiscount();
  const total = subtotal - discount + shippingCost;

  const items = cart.map(i => `• ${i.name} x${i.qty} = $${formatPrice(i.price * i.qty)}`).join('\n');
  const discountLine = discount > 0 ? `\n🎟 Descuento cupón: -$${formatPrice(discount)}` : '';
  const freeShipLine = shippingCost === 0 ? '\n🎁 ¡Envío GRATIS!' : `\n🚚 Envío (${shippingName}): $${formatPrice(shippingCost)}`;
  const couponLine = appliedCoupon ? `\n🎟 Cupón: ${appliedCoupon.code}` : '';

  const message = `¡Hola! Vengo a finalizar una compra del sitio ZOE VEOS 🛍️

👤 *Nombre:* ${name}
📱 *WhatsApp:* ${whatsapp}
📍 *Dirección:* ${street} ${number}, ${barrio ? barrio + ', ' : ''}${city} (CP: ${postal})

🛒 *Productos:*
${items}
${discountLine}${freeShipLine}${couponLine}
💰 *TOTAL: $${formatPrice(total)}*`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  closeCheckout();
  cart = [];
  appliedCoupon = null;
  saveCart();
  showToast('✅ ¡Gracias por tu compra! Redirigiendo a WhatsApp...');
}

// ============================================================
// MODAL PRODUCTO
// ============================================================
function openProductModal(product) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;

  modal.querySelector('#pm-img').src = product.image || '';
  modal.querySelector('#pm-img').alt = product.name;
  modal.querySelector('#pm-cat').textContent = product.category || '';
  modal.querySelector('#pm-name').textContent = product.name;
  modal.querySelector('#pm-price').textContent = `$${formatPrice(product.price)}`;
  modal.querySelector('#pm-desc').textContent = product.description || '';
  modal.querySelector('#pm-add').onclick = () => { addToCart(product); closeProductModal(); };

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ============================================================
// APLICAR PROMOS (descuentos en cantidad, descuentos por valor)
// ============================================================
function applyPromotions(product, qty) {
  const promotions = JSON.parse(localStorage.getItem('zoeveos_promotions') || '[]');
  let price = product.price;

  promotions.filter(p => p.active).forEach(promo => {
    if (promo.type === 'leve_n') {
      // Leve N productos
      const catMatch = !promo.limitCategory || promo.limitCategory === product.category;
      if (catMatch && qty >= promo.minQty) {
        if (promo.discountType === 'percent') price *= (1 - promo.discountValue / 100);
        else price = Math.max(0, price - promo.discountValue);
      }
    } else if (promo.type === 'valor_minimo') {
      // Por valor mínimo del carrito se aplica al checkout, no aquí
    }
  });

  return Math.round(price);
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger-children').forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

// ============================================================
// FIREBASE DATA LOADER (se conecta cuando tienes credenciales)
// ============================================================
async function loadDataFromFirebase() {
  // ⚠️ CONECTAR FIREBASE AQUÍ
  // import { db } from './firebase-config.js';
  // import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";

  // Por ahora cargamos datos demo
  loadDemoData();
}

function loadDemoData() {
  const demoSlides = [
    { image: '', title: 'Bienvenida a ZOE VEOS', subtitle: 'Artículos de maternidad con amor' },
    { image: '', title: 'Nueva Colección', subtitle: 'Para mamás y bebés' }
  ];
  initHeroSlider(demoSlides);

  const demoCategories = [
    { name: 'Ropa Bebé', icon: '👶', count: 0 },
    { name: 'Lactancia', icon: '🤱', count: 0 },
    { name: 'Maternidad', icon: '🤰', count: 0 },
    { name: 'Accesorios', icon: '🎀', count: 0 },
    { name: 'Higiene', icon: '🧴', count: 0 },
  ];
  renderCategories(demoCategories);
  initProductFilters(demoCategories);

  allProducts = [];
  filteredProducts = [];
  renderProducts(allProducts);
  renderDestaqueSection(null);
  renderPromoSection(null);
  renderBlogSection([]);
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initHeader();
  initReveal();
  updateCartUI();
  loadDataFromFirebase();

  // Cart buttons
  document.getElementById('cart-btn')?.addEventListener('click', openCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);

  // Coupon
  document.getElementById('coupon-apply-btn')?.addEventListener('click', () => {
    const code = document.getElementById('coupon-input')?.value?.trim();
    if (code) applyCoupon(code);
  });
  document.getElementById('coupon-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) applyCoupon(code);
    }
  });

  // Checkout
  document.getElementById('checkout-btn')?.addEventListener('click', openCheckout);
  document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
  document.getElementById('checkout-submit')?.addEventListener('click', submitCheckout);
  document.getElementById('co-postal')?.addEventListener('blur', (e) => {
    calculateShipping(e.target.value);
  });

  // Product modal
  document.getElementById('product-modal-close')?.addEventListener('click', closeProductModal);
  document.getElementById('product-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  // Load more
  document.getElementById('load-more-btn')?.addEventListener('click', () => {
    currentPage++;
    renderProducts(filteredProducts, true);
  });

  // Scroll reveal
  window.addEventListener('scroll', initReveal, { passive: true });
});
