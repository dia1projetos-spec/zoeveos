# 🌸 ZOE VEOS — Sitio Web de Maternidad

## Estructura del proyecto

```
zoe-veos/
├── index.html          → Página principal
├── blog.html           → Blog completo
├── vercel.json         → Configuración Vercel
├── css/
│   ├── style.css       → Estilos del sitio
│   └── admin.css       → Estilos del panel admin
├── js/
│   ├── main.js         → Lógica del sitio
│   ├── admin.js        → Lógica del panel admin
│   └── firebase-config.js → ⚠️ CONFIGURAR ANTES DE USAR
├── admin/
│   └── index.html      → Panel administrativo
└── assets/
    └── video/
        └── intro.mp4   → Video de carga
```

---

## ⚙️ CONFIGURACIÓN INICIAL

### 1. Firebase

1. Ve a https://console.firebase.google.com
2. Crea un nuevo proyecto llamado "zoeveos"
3. Activa **Firestore Database** (modo producción)
4. Activa **Authentication** → Email/Password
5. Ve a Configuración del proyecto → Tus apps → Agrega app web
6. Copia la configuración y pégala en `js/firebase-config.js`

### 2. Cloudinary

1. Ve a https://cloudinary.com y crea cuenta gratuita
2. En el dashboard copia tu **Cloud Name**
3. Ve a Settings → Upload → Add upload preset → **Unsigned**
4. Copia el nombre del preset
5. Pega ambos en `js/firebase-config.js`

### 3. Correo Argentino (MiCorreo API)

1. Solicita acceso en https://www.correoargentino.com.ar
2. Obtén usuario, contraseña y Customer ID
3. Configura en el Panel Admin → Configuración → Frete & Correo

---

## 🚀 DESPLIEGUE EN VERCEL + GITHUB

1. Sube el proyecto a un repositorio en GitHub
2. Ve a https://vercel.com → New Project
3. Importa tu repo de GitHub
4. Vercel detectará automáticamente el sitio estático
5. ¡Deploy listo! Tu sitio estará en `tu-proyecto.vercel.app`

---

## 🔐 ACCESO AL PANEL ADMIN

URL: `tu-dominio.com/admin`

**Credenciales por defecto:**
- Email: admin@zoeveos.com
- Password: ZoeVeos2024!

⚠️ **CAMBIA ESTAS CREDENCIALES** antes de publicar el sitio.
Para cambiarlas, edita la línea en `js/admin.js`:
```js
const ADMIN_CREDS = { email: 'TU_EMAIL', password: 'TU_PASSWORD_SEGURO' };
```

---

## 📱 FUNCIONALIDADES

### Panel Administrativo
- ✅ Dashboard con estadísticas
- ✅ Gestión de Productos (crear, editar, eliminar)
  - Con dimensiones y peso para cálculo de flete
  - Etiquetas: Nuevo, Destaque, Promo
- ✅ Categorías
- ✅ Slides del Hero (subir, reemplazar, eliminar)
- ✅ Blog con editor enriquecido + SEO completo
- ✅ Cupones de descuento con fecha de vencimiento automática
- ✅ Promociones:
  - Descuento por monto mínimo
  - Llevá N productos
  - Envío Gratis
- ✅ Actualización de precios en masa
- ✅ Configuración de Correo Argentino
- ✅ Sección Destaque y Sección Promo
- ✅ Menús dropdown (expandibles en el código)

### Sitio Principal
- ✅ Loader con video + barra de progreso
- ✅ Slider Hero (gestión desde admin)
- ✅ Categorías con filtros
- ✅ Grilla de productos con filtros y ordenamiento
- ✅ Secciones Destaque y Promoción
- ✅ Blog con 10+ artículos en homepage
- ✅ Carrito completo con suma/resta
- ✅ Cupones aplicables en carrito
- ✅ Checkout con cálculo de frete (Correo Argentino)
- ✅ Envío a WhatsApp con mensaje completo
- ✅ Animaciones y scroll reveal
- ✅ 100% Responsivo
- ✅ WhatsApp flotante

---

## 📦 INTEGRACIÓN CORREO ARGENTINO

El sitio usa la **API MiCorreo** para cotizar envíos:
- Endpoint: `POST /rates`
- Requiere: CP origen (2434), CP destino, dimensiones del paquete
- El flujo de autenticación obtiene un JWT con usuario/contraseña

Cuando tengas credenciales, en `js/main.js` busca la función
`calculateShipping()` y reemplaza la simulación por la llamada real.

---

## 🎨 PERSONALIZACIÓN

### Colores
En `css/style.css` modifica las variables CSS:
```css
:root {
  --rose: #E8A4A4;        /* Rosa principal */
  --terra: #C4856A;       /* Terracota */
  --gold: #C9A96E;        /* Dorado */
  --brown: #6B4C3B;       /* Marrón oscuro */
}
```

### WhatsApp
En `js/main.js` busca:
```js
const WHATSAPP_NUMBER = "5493576466145";
```

---

Hecho con 🌸 para ZOE VEOS — Argentina 2025
