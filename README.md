# Zoë νέος — Tienda online

Sitio construido en HTML + CSS + JavaScript puro (sin frameworks/bundlers), con Firebase (Firestore + Auth) como base de datos y panel administrativo, Cloudinary para imágenes/videos, y pensado para desplegar en Vercel.

## Estructura del proyecto

```
/index.html            Página de inicio (banners de categorías)
/categoria.html         Lista de subcategorías de una categoría
/subcategoria.html      Banner de la subcategoría + grid de productos
/producto.html          Detalle del producto (carrusel propio)
/checkout.html           Formulario de compra + WhatsApp
/blog.html               Listado del blog
/blog-post.html          Landing page individual de cada artículo
/css/style.css           Estilos de la tienda
/js/                     Lógica de la tienda (un archivo por página) + firebase-config.js y cloudinary.js
/admin/                  Panel de administración
  /index.html             Login
  /dashboard.html         Panel con pestañas (Configuración, Categorías, Subcategorías, Productos, Pedidos, Blog)
  /css/admin.css
  /js/                    Un módulo por sección
```

Todo el CSS vive en `/css` y `/admin/css`; todo el JS vive en `/js` y `/admin/js` — nunca dentro del HTML.

## 1. Configurar Firebase

### 1.1 Firestore Database
En la consola de Firebase (proyecto `monkeyzoeveos`), creá una base de datos Firestore (modo producción) si todavía no existe.

Colecciones que la aplicación usa (se crean solas al guardar datos desde el panel, no hace falta crearlas a mano):
- `config/site` → `{ logoUrl, whatsappNumber, siteName }`
- `categorias` → `{ nombre, descripcion, orden, activo, slides:[{type,url,publicId}] }`
- `subcategorias` → `{ nombre, categoriaId, orden, activo, slides:[...] }`
- `productos` → `{ nombre, subcategoriaId, precio, stock, descripcion, activo, images:[url,...] }`
- `pedidos` → `{ cliente:{nombre,whatsapp,calle,ciudad,region}, items:[...], total, estado, fecha }`
- `blog` → `{ titulo, slug, metaDescription, contenido, imagenPortada, productoDestacadoId, fecha }`

### 1.2 Reglas de seguridad de Firestore
Andá a **Firestore Database > Reglas** y pegá esto (lectura pública para la tienda, escritura solo para vos logueado en el panel):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /categorias/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /subcategorias/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /productos/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /blog/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /config/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /pedidos/{id} {
      allow create: if true;               // cualquiera puede crear un pedido desde el checkout
      allow read, update, delete: if request.auth != null;  // solo vos en el panel
    }
  }
}
```

### 1.3 Crear tu usuario administrador
1. Consola de Firebase > **Authentication** > pestaña **Sign-in method** > habilitá **Email/Password**.
2. Pestaña **Users** > **Add user** > ingresá tu email y una contraseña.
3. Con ese email/contraseña vas a entrar en `/admin/index.html`.

No hay registro público de administradores: los usuarios se crean a mano en la consola, así nadie más puede entrar al panel.

## 2. Configurar Cloudinary

Cloud name usado en el código: `aaydc7pr`.

El **API Secret nunca se usa en el navegador** (por seguridad — cualquiera podría robarlo viendo el código fuente). En su lugar, el sitio sube archivos con un **upload preset "unsigned"**:

1. Entrá a [cloudinary.com/console](https://cloudinary.com/console) > ⚙️ **Settings** > pestaña **Upload**.
2. En "Upload presets" > **Add upload preset**.
3. **Signing Mode**: `Unsigned`.
4. **Preset name**: `zoeveos_unsigned` (si le ponés otro nombre, actualizalo en `js/cloudinary.js`, constante `UPLOAD_PRESET`).
5. Guardar.

Con esto, el panel administrativo ya puede subir imágenes y videos para los banners y los productos.

## 3. Desplegar en Vercel

1. Subí esta carpeta a un repositorio de GitHub (o conectá la carpeta directo con la CLI de Vercel: `npx vercel`).
2. En [vercel.com](https://vercel.com), **Add New > Project**, importá el repo.
3. Es un sitio estático: no hace falta configurar "Build Command" ni "Output Directory" (dejalos en blanco/default).
4. Deploy.

No hace falta ninguna variable de entorno: las claves de Firebase usadas acá son claves públicas de cliente (están pensadas para ir en el navegador; la seguridad real la dan las reglas de Firestore del paso 1.2).

## 4. Cómo funciona el flujo de compra (por ahora, sin Correo Argentino)

1. El cliente agrega productos al carrito (persistido en su navegador).
2. En el checkout completa nombre, WhatsApp y dirección (calle, ciudad, provincia).
3. Al confirmar, el pedido se guarda en Firestore (pestaña **Pedidos** del panel) y se genera un link de WhatsApp hacia el número que configuraste en **Configuración**, con el resumen del pedido ya armado.
4. Vos coordinás el medio de pago y el costo de envío por WhatsApp directamente con el cliente.

Cuando integres el Correo Argentino, el paso 3-4 se puede reemplazar por el cálculo automático de tarifas sin tocar el resto del sitio.

## 5. Sobre el blog y el SEO

Cada artículo tiene su propia URL (`/blog-post.html?slug=tu-articulo`) y actualiza el `<title>` y la meta descripción dinámicamente. Es un buen punto de partida, pero como el contenido se carga con JavaScript después de que carga la página, algunos rastreadores older pueden no ver el contenido de inmediato. Si más adelante el SEO es prioritario, se puede migrar el blog a páginas pre-generadas (SSG) sin cambiar el diseño ni el panel administrativo.

## 6. Cómo se usan las categorías, subcategorías y productos

- **Categoría principal** → se muestra como un banner de ancho completo en el `index.html` (como "Home" y "Maternidad" en tu diseño). Cada categoría tiene su propio slide de imágenes/videos.
- **Subcategoría** → pertenece a una categoría. Se ve como tarjeta dentro de `categoria.html` y tiene su propio banner slide, que se muestra arriba de sus productos en `subcategoria.html`.
- **Producto** → pertenece a una subcategoría. Tiene su propio carrusel de imágenes (no se mezcla con otros productos), precio y descripción.
- **Artículo de blog** → puede destacar un producto puntual; debajo se arma automáticamente un carrusel con los demás productos de la misma subcategoría de ese producto destacado.

Todo esto se administra 100% desde `/admin/dashboard.html`, sin tocar código.
