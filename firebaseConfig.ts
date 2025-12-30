import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ATENÇÃO: Substitua o objeto abaixo pela configuração do seu próprio projeto do Firebase.
// Você pode encontrar essas informações nas configurações do seu projeto no console do Firebase.
// https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_AUTH_DOMAIN_AQUI",
  projectId: "SEU_PROJECT_ID_AQUI",
  storageBucket: "SEU_STORAGE_BUCKET_AQUI",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID_AQUI",
  appId: "SUA_APP_ID_AQUI"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta a instância do Firestore para ser usada em outras partes do aplicativo
export const db = getFirestore(app);
