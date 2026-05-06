# Catálogo Pro - Gerador de Catálogo com Vercel + Firebase + Cloudinary

Ferramenta onde você cola a URL de uma loja, extrai produtos (nome, foto, preço, categoria) e gera PDF profissional.

## Stack
- Frontend: HTML/CSS/JS (Tailwind) - hospedado na Vercel
- API: /api/scrape.js (Vercel Serverless + Cheerio)
- DB: Firebase Firestore
- Imagens: Cloudinary (modo fetch)

## Deploy
1. Crie repo no GitHub e suba esses arquivos
2. Importe no Vercel
3. Configure env (opcional para Firebase)
4. No Cloudinary, pegue seu cloud name e cole no campo da interface

## Como funciona
- API busca a página, lê JSON-LD schema.org/Product (Shopify, Nuvemshop, WooCommerce já têm)
- Frontend agrupa por categoria e renderiza
- PDF é gerado no navegador com html2canvas + jsPDF
- Imagens são servidas via Cloudinary fetch: `https://res.cloudinary.com/SEU_CLOUD/image/fetch/...`

## Próximos passos
- Adicionar paginação automática
- Login para salvar catálogos por usuário
- Template PDF com mais designs
