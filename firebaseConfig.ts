// Cole aqui a configuração do seu projeto Firebase.
// 1. Vá para a consola do Firebase: https://console.firebase.google.com/
// 2. Abra as Configurações do Projeto (ícone de engrenagem).
// 3. Na aba "Geral", role para baixo e encontre as configurações do seu app da Web.
// 4. Copie o objeto `firebaseConfig` e cole abaixo, substituindo este exemplo.

import { initializeApp, getApps } from 'firebase/app';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyAwQ8TfUKczGcpIxjkrd2g9HCzjQfH0QfY",
  authDomain: "gestao-ppais.firebaseapp.com",
  databaseURL: "https://gestao-ppais-default-rtdb.firebaseio.com",
  projectId: "gestao-ppais",
  storageBucket: "gestao-ppais.appspot.com",
  messagingSenderId: "87829401992",
  appId: "1:87829401992:web:76d699089eb42b86c9aa3d", 
  measurementId: "G-FM306DHMNC"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const storage = getStorage(app);

