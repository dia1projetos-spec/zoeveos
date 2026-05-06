# Catálogo Pro - Vercel + Firebase + Cloudinary

## Configuração
1. Suba para GitHub
2. Vercel → Import → adicione Environment Variables:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY = 967988277885785
   - CLOUDINARY_API_SECRET = (cole o secret completo da imagem)
3. Deploy

## Como funciona
- /api/scrape busca produtos via JSON-LD
- Faz upload automático das imagens para Cloudinary pasta `catalogos/`
- Frontend salva no Firestore e gera PDF

## Limites
- Vercel free: 50 produtos por extração para não estourar 20s
- Aumente em `products.slice(0, 50)`
