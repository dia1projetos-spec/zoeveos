// ============================================================
// FIREBASE CONFIGURATION — ZOE VEOS
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClydiw5NBkPu2yE4VPxbNw6raQW8sqXsg",
  authDomain: "zoeveos.firebaseapp.com",
  projectId: "zoeveos",
  storageBucket: "zoeveos.firebasestorage.app",
  messagingSenderId: "440531916711",
  appId: "1:440531916711:web:572ec2dfd022ffe54a4882"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, setDoc, getDoc,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};

// ============================================================
// CLOUDINARY — dbjwnfjcn
// ============================================================
export const CLOUDINARY = {
  cloudName: "dbjwnfjcn",
  uploadPreset: "zoeveos-upload",
  uploadUrl: "https://api.cloudinary.com/v1_1/dbjwnfjcn/image/upload"
};

// ============================================================
// WHATSAPP
// ============================================================
export const WHATSAPP_NUMBER = "5493576466145";

// ============================================================
// CORREO ARGENTINO
// ============================================================
export const CORREO_ORIGIN_POSTAL = "2434";
