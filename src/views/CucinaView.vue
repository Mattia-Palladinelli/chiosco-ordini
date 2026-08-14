<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../firebase.js'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'

const ordiniAttivi = ref([])
const ordiniCompletati = ref([])
const ordiniProgrammati = ref([])
const schedaAttiva = ref('da_preparare')

// 1. NUOVA VARIABILE PER IL CONTEGGIO
const totalePaniniFatti = ref(0)

onMounted(() => {
  const q = query(collection(db, 'ordini'), orderBy('timestamp', 'asc'))

  onSnapshot(q, (snapshot) => {
    const tempAttivi = []
    const tempCompletati = []
    const tempProgrammati = []
    let conteggio = 0 // Inizializziamo il contatore a zero ad ogni aggiornamento

    snapshot.forEach((documento) => {
      const ordine = { id: documento.id, ...documento.data() }

      if (ordine.stato === 'attivo') {
        tempAttivi.push(ordine)
      } else if (ordine.stato === 'programmato') {
        // Intercettiamo gli ordini futuri
        tempProgrammati.push(ordine)
      } else if (ordine.stato === 'completato') {
        tempCompletati.push(ordine)
        // Se è completato, sommiamo il numero di panini contenuti in questo ordine
        conteggio += ordine.panini.length
      } else if (ordine.stato === 'archiviato') {
        // Se è archiviato (nascosto dallo storico), lo contiamo comunque ma NON lo mettiamo nella lista visiva
        conteggio += ordine.panini.length
      }
    })

    ordiniProgrammati.value = tempProgrammati
    ordiniAttivi.value = tempAttivi
    ordiniCompletati.value = tempCompletati.reverse()

    // Aggiorniamo la variabile reattiva per l'HTML
    totalePaniniFatti.value = conteggio
  })
})

async function chiudiOrdine(idFirebase) {
  try {
    const riferimentoOrdine = doc(db, 'ordini', idFirebase)
    await updateDoc(riferimentoOrdine, { stato: 'completato' })
  } catch (e) {
    console.error("Errore durante la chiusura dell'ordine:", e)
  }
}

async function spostaInCoda(idFirebase) {
  try {
    const riferimentoOrdine = doc(db, 'ordini', idFirebase)
    await updateDoc(riferimentoOrdine, {
      stato: 'attivo',
      timestamp: serverTimestamp(),
    })
  } catch (e) {
    console.error('Errore nello spostamento:', e)
  }
}

async function ripristinaOrdine(idFirebase) {
  try {
    const riferimentoOrdine = doc(db, 'ordini', idFirebase)
    await updateDoc(riferimentoOrdine, { stato: 'attivo' })
  } catch (e) {
    console.error('Errore durante il ripristino:', e)
  }
}

// NUOVA FUNZIONE: Archivia tutti gli ordini completati visibili
async function svuotaStorico() {
  // Chiediamo conferma per evitare misclick
  if (
    !confirm('Vuoi nascondere questi ordini dallo storico? (Il conteggio totale rimarrà intatto)')
  )
    return

  for (const ordine of ordiniCompletati.value) {
    const riferimentoOrdine = doc(db, 'ordini', ordine.id)
    // Cambiamo lo stato in 'archiviato' così non verranno più pescati dalla lista
    updateDoc(riferimentoOrdine, { stato: 'archiviato' }).catch((e) => console.error(e))
  }
}

// NUOVA FUNZIONE: Azzera il contatore di fine giornata
async function azzeraContatore() {
  if (
    !confirm(
      'ATTENZIONE: Vuoi chiudere la giornata e azzerare il contatore? Gli ordini attivi non verranno toccati.',
    )
  )
    return

  try {
    // 1. Peschiamo TUTTI gli ordini presenti nel database
    const querySnapshot = await getDocs(collection(db, 'ordini'))

    // 2. Li passiamo in rassegna uno ad uno
    querySnapshot.forEach((documento) => {
      const dati = documento.data()

      // 3. Se l'ordine faceva parte del conteggio odierno, lo disattiviamo
      if (dati.stato === 'completato' || dati.stato === 'archiviato') {
        const riferimentoOrdine = doc(db, 'ordini', documento.id)
        updateDoc(riferimentoOrdine, { stato: 'azzerato' }).catch((e) => console.error(e))
      }
    })
  } catch (e) {
    console.error("Errore durante l'azzeramento:", e)
    alert("Si è verificato un errore durante l'azzeramento.")
  }
}

function formattaOra(timestamp) {
  if (!timestamp) return '...'
  const data = timestamp.toDate()
  return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Algoritmo di raggruppamento dinamico
function raggruppaPanini(panini) {
  if (!panini) return []

  const raggruppati = {}

  panini.forEach((panino) => {
    // Creiamo una stringa unica che identifica questo esatto tipo di panino
    const notaPulita = panino.note || ''
    const firma = `${panino.nome}|${panino.senza_olio}|${panino.origano}|${notaPulita}`

    if (!raggruppati[firma]) {
      // Se è la prima volta che incontriamo questa configurazione, la creiamo
      raggruppati[firma] = {
        id_firma: firma,
        nome: panino.nome,
        senza_olio: panino.senza_olio,
        origano: panino.origano,
        note: notaPulita,
        quantita: 1,
      }
    } else {
      // Se esiste già un panino identico, aumentiamo solo la quantità
      raggruppati[firma].quantita++
    }
  })

  // Trasformiamo l'oggetto in un normale array per poterlo ciclare nell'HTML
  return Object.values(raggruppati)
}
</script>

<template>
  <main class="schermo-mobile-cucina">
    <!-- BARRA DI NAVIGAZIONE SUPERIORE (I Tabs) -->
    <nav class="selettore-schede">
      <button @click="$router.push('/')" class="btn-ritorno-cucina">🏠</button>
      <button
        @click="schedaAttiva = 'da_preparare'"
        :class="['btn-scheda', { 'scheda-attiva': schedaAttiva === 'da_preparare' }]"
      >
        <!-- resto del codice... -->
        Da Preparare ({{ ordiniAttivi.length }})
      </button>
      <button
        @click="schedaAttiva = 'programmati'"
        :class="['btn-scheda', { 'scheda-attiva': schedaAttiva === 'programmati' }]"
      >
        In Attesa ({{ ordiniProgrammati.length }})
      </button>

      <button
        @click="schedaAttiva = 'storico'"
        :class="['btn-scheda', { 'scheda-attiva': schedaAttiva === 'storico' }]"
      >
        Storico
      </button>
    </nav>

    <!-- AREA 1: CODA ATTIVA (Visibile solo se la scheda è 'da_preparare') -->
    <section v-if="schedaAttiva === 'da_preparare'" class="area-scorrimento">
      <!-- Messaggio se non ci sono ordini -->
      <div v-if="ordiniAttivi.length === 0" class="coda-vuota">Nessun ordine in attesa.</div>

      <article
        v-for="ordine in ordiniAttivi"
        :key="ordine.id"
        :class="['comanda', { 'card-asporto': ordine.asporto }]"
      >
        <div class="comanda-header">
          <div class="info-cliente">
            <h2>{{ ordine.cliente }}</h2>
            <span class="orario">{{ formattaOra(ordine.timestamp) }}</span>
          </div>
          <span v-if="ordine.asporto" class="badge-asporto">🛍️ ASPORTO</span>
          <span v-else class="badge-chiosco">🍽️ CHIOSCO</span>
        </div>

        <ul class="lista-panini">
          <!-- Invece di ciclare su ordine.panini, cicliamo sul risultato del raggruppamento -->
          <li v-for="gruppo in raggruppaPanini(ordine.panini)" :key="gruppo.id_firma">
            <!-- Mostriamo la quantità dinamica (es. 2x) calcolata dall'algoritmo -->
            <strong>{{ gruppo.quantita }}x {{ gruppo.nome }}</strong>

            <div class="note-varianti">
              <span v-if="gruppo.senza_olio" class="variante-rimossa">- Senza Olio</span>
              <span v-if="gruppo.origano" class="variante-aggiunta">+ Origano</span>
              <!-- NUOVA RIGA: Mostriamo la nota solo se c'è testo -->
              <span v-if="gruppo.note !== ''" class="nota-testo">📝 {{ gruppo.note }}</span>
            </div>
          </li>
        </ul>

        <button @click="chiudiOrdine(ordine.id)" class="btn-fatto">✓ COMPLETA ORDINE</button>
      </article>
    </section>

    <!-- AREA 2: STORICO RECENTI -->
    <section v-if="schedaAttiva === 'storico'" class="area-scorrimento">
      <!-- NUOVO BLOCCO: Contatore e Svuotamento -->
      <!-- BLOCCO CONTROLLI: Contatore, Azzeramento e Svuotamento -->
      <div class="controlli-storico">
        <div class="sezione-conteggio">
          <span class="totale-panini"
            >Oggi: <strong>{{ totalePaniniFatti }}</strong></span
          >
          <!-- Questo bottone appare solo se ci sono panini contati -->
          <button
            v-if="totalePaniniFatti > 0"
            @click="azzeraContatore()"
            class="btn-azzera"
            title="Chiudi Giornata"
          >
            🔄 Azzera
          </button>
        </div>

        <button v-if="ordiniCompletati.length > 0" @click="svuotaStorico()" class="btn-svuota">
          🗑️ Svuota Lista
        </button>
      </div>

      <div v-for="ordine in ordiniCompletati" :key="ordine.id" class="comanda-chiusa">
        <!-- ... (il resto della comanda-chiusa rimane identico) ... -->
        <div class="info-storico">
          <strong class="nome-storico">{{ ordine.cliente }}</strong>
          <span class="ora-chiusa">({{ formattaOra(ordine.timestamp) }})</span>
        </div>
        <button @click="ripristinaOrdine(ordine.id)" class="btn-ripristina">↺ Ripristina</button>
      </div>
    </section>

    <!-- AREA 3: PROGRAMMATI -->
    <section v-if="schedaAttiva === 'programmati'" class="area-scorrimento">
      <div v-if="ordiniProgrammati.length === 0" class="coda-vuota">
        Nessuna prenotazione futura.
      </div>

      <article
        v-for="ordine in ordiniProgrammati"
        :key="ordine.id"
        class="comanda comanda-programmata"
      >
        <div class="comanda-header">
          <div class="info-cliente">
            <h2>{{ ordine.cliente }}</h2>
            <span class="orario">Creato alle: {{ formattaOra(ordine.timestamp) }}</span>
          </div>
          <!-- Badge gigante per l'orario -->
          <span class="badge-orario">RITIRO ALLE: {{ ordine.orario_ritiro }}</span>
        </div>

        <ul class="lista-panini">
          <li v-for="gruppo in raggruppaPanini(ordine.panini)" :key="gruppo.id_firma">
            <strong>{{ gruppo.quantita }}x {{ gruppo.nome }}</strong>
            <div class="note-varianti">
              <span v-if="gruppo.senza_olio" class="variante-rimossa">- Senza Olio</span>
              <span v-if="gruppo.origano" class="variante-aggiunta">+ Origano</span>
              <span v-if="gruppo.note !== ''" class="nota-testo">📝 {{ gruppo.note }}</span>
            </div>
          </li>
        </ul>

        <button @click="spostaInCoda(ordine.id)" class="btn-attiva">
          ► INIZIA A PREPARARE ORA
        </button>
      </article>
    </section>
  </main>
</template>

<style scoped>
.schermo-mobile-cucina {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f2f5;
  box-sizing: border-box;
}

/* Stile dei pulsanti in alto (Tabs) */
.selettore-schede {
  display: flex;
  background-color: #212121;
  padding: 10px;
  gap: 10px;
}

.btn-scheda {
  flex: 1;
  padding: 15px;
  background-color: #424242;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
}

/* Evidenzia la scheda selezionata */
.btn-scheda.scheda-attiva {
  background-color: #4caf50;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.btn-ritorno-cucina {
  background: #333;
  border: none;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  padding: 0 15px;
}

/* Area che scorre contenente le liste */
.area-scorrimento {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.coda-vuota {
  text-align: center;
  color: #777;
  font-size: 18px;
  margin-top: 50px;
}

/* Stile Comanda */
.comanda {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  border-left: 8px solid #2196f3;
}

.nota-testo {
  color: #555;
  font-weight: bold;
  font-style: italic;
  font-size: 14px;
  background-color: #fff8e1;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 5px;
  border: 1px solid #ffe082;
}

.comanda.card-asporto {
  background-color: #fff8cc; /* Giallo paglierino che contrasta bene col bianco */
  border-left-color: #e91e63;
}

.comanda-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px dashed #ccc;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.info-cliente h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 900;
  text-transform: uppercase;
}
.orario {
  color: #666;
  font-size: 14px;
  font-weight: bold;
}

.badge-asporto {
  background: #e91e63;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}
.badge-chiosco {
  background: #2196f3;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}

.lista-panini {
  list-style-type: none;
  padding: 0;
  margin: 0 0 15px 0;
  flex-grow: 1;
}

.lista-panini li {
  font-size: 18px;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.note-varianti {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.variante-rimossa {
  color: #d32f2f;
  font-weight: bold;
  font-size: 14px;
}
.variante-aggiunta {
  color: #388e3c;
  font-weight: bold;
  font-size: 14px;
}

.btn-fatto {
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 18px;
  font-size: 18px;
  font-weight: bold;
}

/* Stile Comanda Nello Storico */
.comanda-chiusa {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border-left: 5px solid #9e9e9e;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.info-storico {
  display: flex;
  flex-direction: column;
}

.nome-storico {
  font-size: 18px;
}
.ora-chiusa {
  color: #777;
  font-size: 14px;
}

.btn-ripristina {
  background: #ff9800;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 16px;
}

.controlli-storico {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-left: 5px solid #4caf50; /* Verde per indicare il successo/totale */
}

.totale-panini {
  font-size: 16px;
  color: #333;
}
.totale-panini strong {
  font-size: 20px;
  color: #4caf50;
}

.btn-svuota {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}

.sezione-conteggio {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-azzera {
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-azzera:active {
  background-color: #e68a00;
}

.comanda-programmata {
  background-color: #f3e5f5;
  border-left: 8px solid #9c27b0;
}

.badge-orario {
  background: #9c27b0;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 900;
  font-size: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-attiva {
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 18px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
}
</style>
