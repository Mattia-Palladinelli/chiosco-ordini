<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { auth } from '../firebase.js'
import { signOut } from 'firebase/auth'

const router = useRouter()

async function chiudiTurno() {
  if (confirm('Chiudere il turno? Dovrai reinserire la password per accedere.')) {
    await signOut(auth)
    router.push('/login')
  }
}
</script>

<template>
  <main class="schermo-home">
    <div class="intestazione">
      <h1>LA CHIOSCHERIA</h1>
    </div>

    <div class="pulsantiera">
      <!-- RouterLink si comporta come un pulsante, ma dice a Vue di cambiare pagina istantaneamente -->
      <RouterLink to="/cameriere" class="btn-home btn-cameriere"> 📝 ORDINAZIONI </RouterLink>

      <RouterLink to="/cucina" class="btn-home btn-cucina"> 👨‍🍳 CUCINA </RouterLink>
    </div>

    <button @click="chiudiTurno" class="btn-home btn-logout">🚪 CHIUDI TURNO</button>
  </main>
</template>

<style scoped>
.schermo-home {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #2c3e50; /* Sfondo scuro elegante per la home */
  color: white;
  padding: 20px;
  box-sizing: border-box;
}

.intestazione {
  text-align: center;
  margin-top: 10vh;
  margin-bottom: 50px;
}

.intestazione h1 {
  font-size: 32px;
  margin: 0 0 10px 0;
  color: #4caf50;
}

.intestazione p {
  font-size: 18px;
  color: #bbb;
  margin: 0;
}

.pulsantiera {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.btn-home {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
  border-radius: 12px;
  font-size: 24px;
  font-weight: bold;
  text-decoration: none;
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: transform 0.1s;
}

.btn-home:active {
  transform: scale(0.98);
}

.btn-cameriere {
  background-color: #2196f3;
}

.btn-cucina {
  background-color: #e91e63;
}

.btn-logout {
  background-color: transparent;
  color: #f44336;
  border: 2px solid #f44336;
  margin-top: 20px;
}
</style>
