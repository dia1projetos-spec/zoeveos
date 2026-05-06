let products=[];
document.getElementById('extract').onclick=async()=>{
  const url=document.getElementById('url').value;
  const s=document.getElementById('status');
  s.textContent='Extraindo...';
  const r=await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
  const d=await r.json();
  products=d.products||[];
  s.textContent=`Encontrados ${products.length} produtos`;
  document.getElementById('preview').innerHTML=products.map(p=>`<div class="border p-2"><img src="${p.image||''}" class="w-full"><div class="text-sm mt-1">${p.name}</div><div class="text-xs text-gray-600">${p.price||''}</div></div>`).join('');
  if(products.length) document.getElementById('pdf').classList.remove('hidden');
};
document.getElementById('pdf').onclick=async()=>{
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  const cat=document.getElementById('catalog');
  cat.innerHTML=`<div style="padding:40px;text-align:center"><h1 style="font-size:32px">Catálogo</h1><p>${new Date().toLocaleDateString('pt-BR')}</p></div>`+products.map(p=>`<div style="page-break-inside:avoid;margin:20px;border-bottom:1px solid #eee;padding-bottom:20px"><img src="${p.image}" style="width:200px;height:200px;object-fit:cover;float:left;margin-right:20px"><h2>${p.name}</h2><p>${p.price||''}</p><div style="clear:both"></div></div>`).join('');
  const canvas=await html2canvas(cat,{scale:2,useCORS:true});
  const img=canvas.toDataURL('image/png');
  const w=210,h=canvas.height*210/canvas.width;
  pdf.addImage(img,'PNG',0,0,w,h);
  pdf.save('catalogo.pdf');
};
