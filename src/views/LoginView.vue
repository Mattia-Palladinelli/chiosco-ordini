<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase.js'
import { signInWithEmailAndPassword } from 'firebase/auth'

const email = ref('')
const password = ref('')
const errore = ref('')
const router = useRouter()
const inCaricamento = ref(false)

async function eseguiLogin() {
  if (!email.value || !password.value) return

  inCaricamento.value = true
  errore.value = ''

  try {
    // Richiede il token a Google e lo salva in IndexedDB in modo persistente
    await signInWithEmailAndPassword(auth, email.value, password.value)
    // Se ha successo, entra nella Home
    router.push('/')
  } catch (e) {
    // Ora usiamo la 'e' per stamparla nella console per noi sviluppatori
    console.error('Dettaglio errore Firebase:', e)
    // E mostriamo il messaggio generico all'utente per avvertirlo dell'errore
    errore.value = 'Credenziali errate o connessione assente.'
  } finally {
    inCaricamento.value = false
  }
}
</script>

<template>
  <main class="schermo-login">
    <div class="card-login">
      <h1>🔐 Accesso Staff</h1>
      <p>Inserisci le credenziali operative</p>

      <form @submit.prevent="eseguiLogin" class="form-login">
        <input type="email" v-model="email" placeholder="Email" required autocomplete="email" />
        <input
          type="password"
          v-model="password"
          placeholder="Password"
          required
          autocomplete="current-password"
        />

        <p v-if="errore" class="msg-errore">{{ errore }}</p>

        <button type="submit" class="btn-entra" :disabled="inCaricamento">
          {{ inCaricamento ? 'Verifica...' : 'ACCEDI' }}
        </button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.schermo-login {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #2c3e50;
  padding: 20px;
  box-sizing: border-box;
}
.card-login {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  text-align: center;
}
.card-login h1 {
  margin-top: 0;
  color: #333;
}
.card-login p {
  color: #666;
  margin-bottom: 25px;
}
.form-login {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.form-login input {
  padding: 15px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
}
.btn-entra {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 15px;
  font-size: 18px;
  font-weight: bold;
  border-radius: 8px;
  margin-top: 10px;
}
.msg-errore {
  color: #f44336;
  font-weight: bold;
  margin: 0;
}
</style>
