import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// COLE AQUI O OBJETO firebaseConfig DO SEU PROJETO
const firebaseConfig = {
  apiKey: "AIzaSyAACODu6AKk0mcZMcdMc1uHHBTIaTBht70",
  authDomain: "carario-esporte-club.firebaseapp.com",
  projectId: "carario-esporte-club",
  storageBucket: "carario-esporte-club.firebasestorage.app",
  messagingSenderId: "715539000775",
  appId: "1:715539000775:web:db104c0905e75eaa9c7de2",
  measurementId: "G-MX5CQF91FS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);