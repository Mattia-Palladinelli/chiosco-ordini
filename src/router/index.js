import { createRouter, createWebHistory } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
// IMPORTANTE: Importiamo 'auth' direttamente dalla nostra configurazione
import { auth } from '../firebase.js'

import HomeView from '../views/HomeView.vue'
import CameriereView from '../views/CameriereView.vue'
import CucinaView from '../views/CucinaView.vue'
import LoginView from '../views/LoginView.vue'

// Promessa per aspettare il verdetto di Firebase prima di caricare la pagina
const attendiAuth = () => {
  return new Promise((resolve) => {
    const cancellaAscolto = onAuthStateChanged(auth, (user) => {
      cancellaAscolto()
      resolve(user)
    })
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { richiedeAuth: true }, // Cartellino di sicurezza
    },
    {
      path: '/cameriere',
      name: 'cameriere',
      component: CameriereView,
      meta: { richiedeAuth: true }, // Cartellino di sicurezza
    },
    {
      path: '/cucina',
      name: 'cucina',
      component: CucinaView,
      meta: { richiedeAuth: true }, // Cartellino di sicurezza
    },
  ],
})

// IL LUCCHETTO BLINDATO
router.beforeEach(async (to, from, next) => {
  // 1. Aspettiamo rigorosamente che Firebase ci dica chi è l'utente
  const utente = await attendiAuth()

  // 2. Usiamo matched.some() per verificare se la rotta (o le sue sotto-rotte) richiedono l'accesso
  const rottaProtetta = to.matched.some((record) => record.meta.richiedeAuth)

  if (rottaProtetta) {
    if (utente) {
      next() // È loggato, passa.
    } else {
      next('/login') // Non è loggato, lo rispediamo al login.
    }
  } else {
    // 3. Cosa succede se va su una pagina pubblica come il /login?
    // Se è GIA' loggato, non ha senso fargli vedere il login, lo mandiamo alla Home.
    if (utente && to.name === 'login') {
      next('/')
    } else {
      next() // Passa al login
    }
  }
})

export default router
