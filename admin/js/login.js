// admin/js/login.js
import { auth, signInWithEmailAndPassword, onAuthStateChanged } from "/js/firebase-config.js";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = document.getElementById("loginBtn");

onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "/admin/dashboard.html";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Ingresando...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "/admin/dashboard.html";
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Email o contraseña incorrectos.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Ingresar";
  }
});
