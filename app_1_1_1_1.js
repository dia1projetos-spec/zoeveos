const $ = (s) => document.querySelector(s);
const siteUrl = $('#siteUrl');
const btnExtract = $('#btnExtract');
const statusEl = $('#status');
const catalogContent = $('#catalogContent');
const btnPdf = $('#btnPdf');
const btnSave = $('#btnSave');
const actions = $('#actions');

let currentProducts = [];
let currentMeta = {};

// Firebase init - preencha com seu .env
const firebaseConfig = {
  apiKey: "AIzaSyB_73dStIaL-xXXTEX7ywXYj5HQj2EtaQI",
  authDomain: "catalogo-gerador-pdf.firebaseapp.com",
  projectId: "catalogo-gerador-pdf",
  storageBucket: "catalogo-gerador-pdf.firebasestorage.app",
  messagingSenderId: "925565074883",
  appId: "1:925565074883:web:390b5bc501e6b99de61176"
};
let db;
try {
  const app = window.firebaseInit.initializeApp(firebaseConfig);
  db = window.firebaseInit.getFirestore(app);
} catch(e) { console.log('Firebase não configurado ainda'); }

function cloudinaryUrl(original, cloudName) {
  if(!cloudName || !original) return original;
  const encoded = encodeURIComponent(original);
  return `https://res.cloudinary.com/${cloudName}/image/fetch/q_auto,w_800/${encoded}`;
}

btnExtract.onclick = async () => {
  const url = siteUrl.value.trim();
  const cloudName = $('#cloudName').value.trim();
  const brand = $('#brandName').value.trim() || new URL(url).hostname;
  const logo = $('#logoUrl').value.trim();

  if(!url) return alert('Cole a URL da loja');
  statusEl.textContent = 'Extraindo produtos...';
  catalogContent.innerHTML = '';
  actions.classList.add('hidden');

  try {
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Erro');

    currentProducts = data.products || [];
    currentMeta = { url, brand, logo, cloudName, date: new Date().toLocaleDateString('pt-BR') };

    $('#coverTitle').textContent = brand;
    $('#coverSub').textContent = `${url} • ${currentMeta.date}`;
    const coverLogo = $('#coverLogo');
    if(logo) { coverLogo.src = logo; coverLogo.classList.remove('hidden'); }

    // agrupar por categoria
    const byCat = {};
    currentProducts.forEach(p => {
      const cat = p.category || 'Geral';
      if(!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(p);
    });

    for(const [cat, items] of Object.entries(byCat)) {
      const sec = document.createElement('section');
      sec.className = 'category';
      sec.innerHTML = `<h3>${cat}</h3><div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5"></div>`;
      const grid = sec.querySelector('div');
      items.forEach(p => {
        const img = cloudinaryUrl(p.image, cloudName);
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <img src="${img}" alt="" loading="lazy" onerror="this.src='https://via.placeholder.com/400'"/>
          <div class="info">
            <div class="text-sm text-gray-500">${p.brand || ''}</div>
            <div class="font-medium line-clamp-2">${p.name}</div>
            <div class="price mt-1">${p.price || ''}</div>
          </div>`;
        grid.appendChild(card);
      });
      catalogContent.appendChild(sec);
    }

    statusEl.textContent = `Encontrados ${currentProducts.length} produtos em ${Object.keys(byCat).length} categorias.`;
    actions.classList.remove('hidden');
  } catch(err) {
    console.error(err);
    statusEl.textContent = 'Erro: ' + err.message;
  }
};

btnPdf.onclick = async () => {
  statusEl.textContent = 'Gerando PDF...';
  const { jsPDF } = window.jspdf;
  const catalog = document.getElementById('catalog');
  const canvas = await html2canvas(catalog, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = canvas.height * imgWidth / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  pdf.save(`catalogo-${currentMeta.brand || 'loja'}.pdf`);
  statusEl.textContent = 'PDF pronto!';
};

btnSave.onclick = async () => {
  if(!db) return alert('Configure Firebase primeiro');
  try {
    const { collection, addDoc, serverTimestamp } = window.firebaseInit;
    const docRef = await addDoc(collection(db, 'catalogs'), {
      ...currentMeta,
      products: currentProducts,
      createdAt: serverTimestamp()
    });
    statusEl.textContent = 'Salvo no Firebase: ' + docRef.id;
  } catch(e) {
    statusEl.textContent = 'Erro Firebase: ' + e.message;
  }
};
