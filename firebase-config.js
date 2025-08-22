// Importe as funções dos SDKs que você precisa
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// COLE AQUI O MESMO OBJETO firebaseConfig que você usou no painel de admin
const firebaseConfig = {
  apiKey: "AIzaSyAACODu6AKk0mcZMcdMc1uHHBTIaTBht70",
  authDomain: "carario-esporte-club.firebaseapp.com",
  projectId: "carario-esporte-club",
  storageBucket: "carario-esporte-club.firebasestorage.app",
  messagingSenderId: "715539000775",
  appId: "1:715539000775:web:db104c0905e75eaa9c7de2",
  measurementId: "G-MX5CQF91FS"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o serviço do Firestore para ser usado no script.js
export const db = getFirestore(app);