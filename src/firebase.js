// Importiamo i moduli di base di Firebase
import { initializeApp } from 'firebase/app'
// Importiamo i moduli per la cache offline
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
// Importiamo il modulo Auth
import { getAuth } from 'firebase/auth'

// CONFIGURAZIONE ESATTA che si trova in env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Inizializziamo l'app
const app = initializeApp(firebaseConfig)

// Invece di getFirestore(), usiamo initializeFirestore attivando il disco locale del telefono
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// Inizializziamo l'Auth
const auth = getAuth(app)

// Esportiamo 'db' per poterlo usare negli altri file (Cameriere, Cucina) e anche auth
export { db, auth }
