// js/cloudinary.js
// Upload de imagens e vídeos para o Cloudinary direto do navegador (unsigned upload).
//
// IMPORTANTE SOBRE SEGURANÇA:
// O API Secret do Cloudinary NUNCA deve aparecer em código que roda no navegador
// (qualquer pessoa pode abrir o "Ver código-fonte" e roubar a chave).
// Por isso este arquivo usa um "unsigned upload preset", que é a forma seguindo
// as boas práticas do próprio Cloudinary para upload direto do front-end.
//
// Você precisa criar esse preset uma única vez:
// 1. Entre em cloudinary.com/console > Settings (ícone de engrenagem) > Upload
// 2. Em "Upload presets", clique em "Add upload preset"
// 3. Signing Mode: "Unsigned"
// 4. Preset name: zoeveos_unsigned  (se usar outro nome, mude a constante abaixo)
// 5. Salvar
//
// O API Secret que você me passou fica guardado só nesta conversa e não é
// usado em nenhum arquivo do site.

const CLOUD_NAME = "aaydc7pr";
const UPLOAD_PRESET = "zoeveos_unsigned";

/**
 * Faz upload de um arquivo (imagem ou vídeo) para o Cloudinary.
 * @param {File} file
 * @param {(percent:number)=>void} [onProgress]
 * @returns {Promise<{url:string, publicId:string, type:'image'|'video', width:number, height:number}>}
 */
export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", "zoeveos");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          type: isVideo ? "video" : "image",
          width: data.width,
          height: data.height,
        });
      } else {
        reject(new Error("Falha no upload para o Cloudinary: " + xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede no upload para o Cloudinary."));
    xhr.send(formData);
  });
}

/**
 * Gera uma URL do Cloudinary com transformação de tamanho/qualidade automática,
 * útil para não carregar imagens gigantes na loja.
 */
export function optimizedUrl(url, width = 800) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
