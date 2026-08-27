<script setup>
// Aggiungiamo watch (per osservare i cambiamenti) e onMounted (per leggere all'avvio)
import { ref, watch, onMounted } from 'vue'
import { db } from '../firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// Abbiamo separato il 'codice' dal 'nome' pulito.
// Le pizzette e la focaccia non hanno codice, quindi lo lasciamo vuoto.
const menu = ref([
  { id: 1, codice: '1', nome: 'Mortadella' },
  { id: 2, codice: '2', nome: 'Prosciutto Crudo' },
  { id: 3, codice: '3', nome: 'Mortadella e Mozzarella' },
  { id: 4, codice: '4', nome: 'Prosciutto Crudo e Mozzarella' },
  { id: 5, codice: '5', nome: 'Pomodoro e Mozzarella' },
  { id: 6, codice: '6', nome: 'Mortadella e Pecorino' },
  { id: 7, codice: '7', nome: 'Prosciutto Crudo, Pomodoro e Mozzarella' },
  { id: 8, codice: '8', nome: 'Prosciutto Crudo e Pecorino' },
  { id: 9, codice: '', nome: 'Prosciutto Crudo e Pomodoro' },
  { id: 10, codice: '', nome: 'Mortadella e Pomodoro' },
  { id: 11, codice: '', nome: 'SOLO Pecorino' },
  { id: 12, codice: '', nome: 'SOLO Pomodoro' },
  { id: 13, codice: '', nome: 'SOLO Mozzarella' },
  { id: 14, codice: '', nome: 'Pizzetta Rossa' },
  { id: 15, codice: '', nome: 'Pizzetta Patate' },
  { id: 16, codice: '', nome: 'Focaccia Bianca' },
  { id: 17, codice: '', nome: 'Mortadella, Pomodoro e Mozzarella' },
  { id: 18, codice: '', nome: 'Mortadella, Pomodoro e Pecorino' },
  { id: 19, codice: '', nome: 'Prosciutto Crudo, Pomodoro e Pecorino' },
  { id: 20, codice: '', nome: 'Pomodoro e Pecorino' },
])

const ordineAttuale = ref([])
const mostraRiepilogo = ref(false)
const nomeCliente = ref('')
// Nuova variabile per l'asporto (di base impostata su falso = consumazione sul posto)
const daAsporto = ref(false)
const orarioRitiro = ref('')
const daPagare = ref(false)
/**
 * Durante l'uso del gestionale è stato riscontrato un bug di mutua esclusione
 * in fase di invio dell'ordine, isInvioInCorso sarà una variabile di lock per proteggere
 * il pulsante "Invia in Cucina" da eventuali tocchi indesiderati
 */
const isInvioInCorso = ref(false)

// --- SISTEMA DI SALVATAGGIO IN CORSO (LOCALSTORAGE) ---

// 1. Quando l'app si carica, controlliamo se c'era un ordine lasciato a metà
onMounted(() => {
  const ordineSalvato = localStorage.getItem('chiosco_ordine_corrente')
  const nomeSalvato = localStorage.getItem('chiosco_nome_corrente')
  const asportoSalvato = localStorage.getItem('chiosco_asporto_corrente')
  const orarioSalvato = localStorage.getItem('chiosco_orario_corrente')
  const pagamentoSalvato = localStorage.getItem('chiosco_dapagare_corrente')
  if (orarioSalvato) orarioRitiro.value = orarioSalvato

  if (pagamentoSalvato) daPagare.value = JSON.parse(pagamentoSalvato)
  if (ordineSalvato) ordineAttuale.value = JSON.parse(ordineSalvato)
  if (nomeSalvato) nomeCliente.value = nomeSalvato
  if (asportoSalvato) daAsporto.value = JSON.parse(asportoSalvato)
})

// 2. Vue "osserva" queste variabili. Se cambiano, le salva silenziosamente sul telefono.
// { deep: true } serve per guardare anche dentro gli oggetti dell'array (es. le varianti)
watch(
  ordineAttuale,
  (nuovoValore) => {
    localStorage.setItem('chiosco_ordine_corrente', JSON.stringify(nuovoValore))
  },
  { deep: true },
)

watch(nomeCliente, (nuovoValore) => {
  localStorage.setItem('chiosco_nome_corrente', nuovoValore)
})

watch(daAsporto, (nuovoValore) => {
  localStorage.setItem('chiosco_asporto_corrente', JSON.stringify(nuovoValore))
})

watch(orarioRitiro, (nuovoValore) => {
  localStorage.setItem('chiosco_orario_corrente', nuovoValore)
})

watch(daPagare, (nuovoValore) => {
  localStorage.setItem('chiosco_dapagare_corrente', JSON.stringify(nuovoValore))
})

// NOTA: Ricordati, dentro la funzione inviaOrdineInCucina(),
// di svuotare anche il localStorage alla fine del try, dopo aver resettato le variabili:
// localStorage.removeItem('chiosco_ordine_corrente')
// localStorage.removeItem('chiosco_nome_corrente')
// localStorage.removeItem('chiosco_asporto_corrente')

function aggiungiAllOrdine(panino) {
  ordineAttuale.value.push({
    id_univoco: Date.now() + Math.random(),
    nome: panino.nome,
    senza_olio: false,
    origano: false,
    note: '',
  })
}

function rimuoviPanino(indice) {
  ordineAttuale.value.splice(indice, 1)
  if (ordineAttuale.value.length === 0) {
    mostraRiepilogo.value = false
  }
}

// Aggiungiamo 'async' davanti alla funzione
async function inviaOrdineInCucina() {
  // La condizione "isInvioInCorso.value" nell'or serve come blocco.
  // Se l'invio è già in corso, ignora i tap successivi
  if (isInvioInCorso.value || ordineAttuale.value.length === 0) return

  if (nomeCliente.value.trim() === '') {
    alert("Attenzione: Inserisci il nome del cliente prima di inviare l'ordine!")
    return
  }

  try {
    // CHIUSURA DEL LOCK
    isInvioInCorso.value = true
    //  CLONAZIONE PROFONDA (Il fix per le sovrapposizioni)
    // Trasformiamo il Proxy di Vue in una stringa e poi di nuovo in un oggetto base.
    // Questo crea una fotografia statica dei panini in questo esatto millisecondo.
    const paniniStatici = JSON.parse(JSON.stringify(ordineAttuale.value))
    const statoAssegnato = orarioRitiro.value ? 'programmato' : 'attivo'
    // 1. Assembliamo il documento JSON perfetto
    const pacchettoOrdine = {
      cliente: nomeCliente.value.toUpperCase(),
      asporto: daAsporto.value,
      stato: statoAssegnato, // Questo ci servirà per le due code in cucina
      timestamp: serverTimestamp(), // Usa l'ora esatta del server Google, non quella del telefono
      panini: paniniStatici, // L'intero array con panini e varianti
      orario_ritiro: orarioRitiro.value,
      da_pagare: daPagare.value,
    }

    // 2. Scriviamo su Firestore
    // addDoc genera un ID alfanumerico univoco in automatico e salva il documento
    await addDoc(collection(db, 'ordini'), pacchettoOrdine)

    // 3. Feedback per il cameriere
    alert(`Ordine inviato con successo per ${nomeCliente.value.toUpperCase()}!`)

    // 4. Svuotiamo l'interfaccia
    ordineAttuale.value = []
    nomeCliente.value = ''
    daAsporto.value = false
    mostraRiepilogo.value = false
    orarioRitiro.value = ''
    daPagare.value = false

    // 5. PULIZIA MEMORIA DI EMERGENZA (Svuota il localStorage)
    localStorage.removeItem('chiosco_dapagare-corrente')
    localStorage.removeItem('chiosco_ordine_corrente')
    localStorage.removeItem('chiosco_nome_corrente')
    localStorage.removeItem('chiosco_asporto_corrente')
    localStorage.removeItem('chiosco_orario_corrente')
  } catch (errore) {
    // Se salta il Wi-Fi e Firebase fallisce la cache locale, catturiamo l'errore
    console.error('Errore irreversibile di connessione: ', errore)
    alert("Errore critico: impossibile salvare l'ordine.")
  } finally {
    // RIAPERTURA DEL LOCK
    isInvioInCorso.value = false
  }
}
</script>

<template>
  <main class="schermo-mobile">
    <header class="testata">
      <!-- Importa RouterLink nello script setup se non c'è, ma possiamo usare costrutti di base come $router.push('/') per semplicità -->
      <button @click="$router.push('/')" class="btn-ritorno">🏠</button>
      <h1>{{ mostraRiepilogo ? 'Riepilogo' : 'Nuovo Ordine' }}</h1>
      <div class="contatore">Panini: {{ ordineAttuale.length }}</div>
    </header>

    <div v-if="!mostraRiepilogo" class="area-centrale griglia-menu">
      <button
        v-for="panino in menu"
        :key="panino.id"
        @click="aggiungiAllOrdine(panino)"
        class="btn-panino"
      >
        <!-- Mostriamo il codice (es. "1 - ") solo se esiste, seguito dal nome pulito -->
        {{ panino.codice ? panino.codice + ' - ' : '' }}{{ panino.nome }}
      </button>
    </div>

    <div v-else class="area-centrale lista-riepilogo">
      <!-- Sezione Dati Cliente e Asporto -->
      <div class="card-metadati">
        <div class="campo-input">
          <label for="input-nome">Nome Cliente:</label>
          <input
            id="input-nome"
            type="text"
            v-model="nomeCliente"
            placeholder="Es. Mario..."
            autocomplete="off"
          />
        </div>

        <div class="campo-input">
          <label for="input-orario">🕒 Orario di Ritiro (Opzionale):</label>
          <input id="input-orario" type="time" v-model="orarioRitiro" />
        </div>

        <div class="selettore-asporto">
          <!-- Bottone Al Chiosco -->
          <button
            @click="daAsporto = false"
            :class="['btn-asporto', { 'selezionato-chiosco': !daAsporto }]"
          >
            🍽️ Al Chiosco
          </button>

          <!-- Bottone Da Asporto -->
          <button
            @click="daAsporto = true"
            :class="['btn-asporto', { 'selezionato-asporto': daAsporto }]"
          >
            🛍️ Da Asporto
          </button>
        </div>

        <div class="selettore-asporto">
          <!-- Ricicliamo la classe contenitore per coerenza -->
          <button
            @click="daPagare = false"
            :class="['btn-asporto', { 'selezionato-pagato': !daPagare }]"
          >
            ✅ Pagato Subito
          </button>

          <button
            @click="daPagare = true"
            :class="['btn-asporto', { 'selezionato-debito': daPagare }]"
          >
            ⚠️ DA PAGARE
          </button>
        </div>
      </div>

      <!-- Lista Panini -->
      <div v-for="(item, indice) in ordineAttuale" :key="item.id_univoco" class="card-ordine">
        <div class="riga-principale">
          <span class="nome-panino">{{ item.nome }}</span>
          <button @click="rimuoviPanino(indice)" class="btn-rimuovi">X</button>
        </div>

        <div class="riga-varianti">
          <button
            @click="item.senza_olio = !item.senza_olio"
            :class="['btn-variante', { attivo: item.senza_olio }]"
          >
            Senza Olio
          </button>

          <button
            v-if="item.nome === 'Pomodoro e Mozzarella'"
            @click="item.origano = !item.origano"
            :class="['btn-variante', { attivo: item.origano }]"
          >
            + Origano
          </button>
        </div>
        <div class="riga-note">
          <input
            type="text"
            v-model="item.note"
            placeholder="Note (es. ben cotto, diviso a metà...)"
            maxlength="40"
            class="input-note-panino"
          />
        </div>
      </div>
    </div>

    <footer class="barra-inferiore">
      <button
        v-if="!mostraRiepilogo && ordineAttuale.length > 0"
        @click="mostraRiepilogo = true"
        class="btn-azione btn-avanti"
      >
        Vedi Riepilogo ({{ ordineAttuale.length }})
      </button>

      <div v-if="mostraRiepilogo" class="pulsanti-riepilogo">
        <button @click="mostraRiepilogo = false" class="btn-azione btn-indietro">← Aggiungi</button>
        <button
          @click="inviaOrdineInCucina()"
          :disabled="isInvioInCorso"
          :class="['btn-azione', 'btn-invia', { 'bottone-bloccato': isInvioInCorso }]"
        >
          {{ isInvioInCorso ? '⏳ INVIO...' : 'INVIA IN CUCINA' }}
        </button>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.schermo-mobile {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding-bottom: 80px;
  box-sizing: border-box;
}

.testata {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: white;
  border-bottom: 2px solid #eee;
}

.btn-ritorno {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0 10px 0 0;
}

.testata h1 {
  margin: 0;
  font-size: 20px;
}

.contatore {
  font-weight: bold;
  background-color: #ff9800;
  color: white;
  padding: 5px 10px;
  border-radius: 20px;
}

.area-centrale {
  padding: 15px;
  overflow-y: auto;
  touch-action: manipulation;
}

.griglia-menu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.btn-panino {
  background-color: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 20px 10px;
  font-size: 15px;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}
.btn-panino:active {
  background-color: #e0e0e0;
}

.lista-riepilogo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Stili per Metadati Ordine (Nome e Asporto) */
.card-metadati {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 15px;
  border-left: 5px solid #ff9800;
}

.campo-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.campo-input label {
  font-weight: bold;
  font-size: 16px;
}

.campo-input input {
  padding: 12px;
  font-size: 18px;
  border: 2px solid #ddd;
  border-radius: 8px;
}

.campo-input input:focus {
  border-color: #2196f3;
  outline: none;
}

/* Stili Selettore Asporto */
.selettore-asporto {
  display: flex;
  gap: 10px;
  background-color: #f4f4f4;
  padding: 5px;
  border-radius: 8px;
}

.btn-asporto {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: bold;
  background-color: transparent;
  color: #666;
  transition: all 0.2s;
}

/* Colori quando selezionati */
.selezionato-chiosco {
  background-color: white;
  color: #2196f3; /* Blu per il chiosco */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.selezionato-asporto {
  background-color: white;
  color: #e91e63; /* Rosa/Rosso per asporto, risalta bene in cucina */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.card-ordine {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  border-left: 5px solid #2196f3;
}

.riga-principale {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.nome-panino {
  font-size: 18px;
  font-weight: bold;
}

.btn-rimuovi {
  background-color: #ff4c4c;
  color: white;
  border: none;
  border-radius: 4px;
  width: 40px;
  height: 40px;
  font-size: 18px;
  font-weight: bold;
}

.riga-varianti {
  display: flex;
  gap: 10px;
}

.btn-variante {
  padding: 8px 12px;
  border: 1px solid #ccc;
  background: #f4f4f4;
  border-radius: 20px;
  font-size: 14px;
}

.btn-variante.attivo {
  background: #ff9800;
  color: white;
  border-color: #ff9800;
}

.riga-note {
  margin-top: 10px;
}

.input-note-panino {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
  background-color: #fafafa;
}

.input-note-panino:focus {
  border-color: #ff9800;
  outline: none;
  background-color: white;
}

.barra-inferiore {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 15px;
  background-color: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
}

.pulsanti-riepilogo {
  display: flex;
  gap: 10px;
}

.btn-azione {
  padding: 18px;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
}

.btn-avanti {
  width: 100%;
  background-color: #2196f3;
  color: white;
}
.btn-indietro {
  flex: 1;
  background-color: #ddd;
  color: #333;
}
.btn-invia {
  flex: 2;
  background-color: #4caf50;
  color: white;
}

.bottone-bloccato {
  background-color: #9e9e9e !important; /* Grigio spento */
  cursor: not-allowed;
  opacity: 0.8;
  transform: none !important; /* Disabilita eventuali effetti di pressione */
}

/* Aggiunti questi colori per i nuovi bottoni */
.selezionato-pagato {
  background-color: white;
  color: #4caf50;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.selezionato-debito {
  background-color: white;
  color: #f44336;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
