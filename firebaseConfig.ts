import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ATENÇÃO: Substitua o objeto abaixo pela configuração do seu próprio projeto do Firebase.
// 1. Acesse https://console.firebase.google.com/ e crie um novo projeto (ou use um existente).
// 2. Vá para as "Configurações do Projeto" (ícone de engrenagem).
// 3. Na aba "Geral", role para baixo e clique no ícone da Web (</>) para registrar seu aplicativo.
// 4. Copie o objeto de configuração (firebaseConfig) que será exibido e cole-o aqui.
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAwQ8TfUKczGcpIxjkrd2g9HCzjQfH0QfY",
  authDomain: "gestao-ppais.firebaseapp.com",
  projectId: "gestao-ppais",
  storageBucket: "gestao-ppais.firebasestorage.app",
  messagingSenderId: "87829401992",
  appId: "1:87829401992:web:76d699089eb42b86c9aa3d",
  measurementId: "G-FM306DHMNC"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias dos serviços para serem usadas em outras partes do aplicativo
export const db = getFirestore(app);
export const storage = getStorage(app);