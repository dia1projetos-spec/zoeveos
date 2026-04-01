// ============================================================
// FIREBASE CONFIGURATION - ZOE VEOS
// ⚠️ SUSTITUYE ESTOS VALORES CON TU CONFIGURACIÓN REAL
// Obtén estos datos en: https://console.firebase.google.com
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_AUTH_DOMAIN.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ============================================================
// CLOUDINARY CONFIGURATION
// ⚠️ SUSTITUYE CON TUS DATOS DE CLOUDINARY
// Obtén en: https://cloudinary.com/console
// ============================================================
export const CLOUDINARY_CONFIG = {
  cloudName: "TU_CLOUD_NAME",
  uploadPreset: "TU_UPLOAD_PRESET", // unsigned preset
  uploadUrl: "https://api.cloudinary.com/v1_1/TU_CLOUD_NAME/image/upload"
};

// ============================================================
// CORREO ARGENTINO - MiCorreo API
// ⚠️ SUSTITUYE CON TUS CREDENCIALES
// Solicitar en: https://www.correoargentino.com.ar
// ============================================================
export const CORREO_CONFIG = {
  baseUrl: "https://api.correoargentino.com.ar/micorreo/v1",
  baseUrlTest: "https://apitest.correoargentino.com.ar/micorreo/v1",
  user: "TU_USUARIO_CORREO",
  password: "TU_PASSWORD_CORREO",
  customerId: "TU_CUSTOMER_ID",
  // Datos del remitente (ZOE VEOS)
  sender: {
    name: "Anabella Vanesa Kruger",
    dni: "32193519",
    streetName: "Bernardino Rivadavia",
    streetNumber: "505",
    city: "Córdoba",
    provinceCode: "X",
    postalCode: "2434"
  }
};

// ============================================================
// WHATSAPP
// ============================================================
export const WHATSAPP_NUMBER = "5493576466145";

// ============================================================
// ADMIN CREDENTIALS (cambiar por Firebase Auth en producción)
// ============================================================
export const ADMIN_EMAIL = "admin@zoeveos.com";
