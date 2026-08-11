# chiosco-ordini

# 🍔 Chiosco Ordini - Real-Time Kiosk Management System

Una Web App Single-Page (SPA) progettata per gestire il flusso di ordinazioni in tempo reale tra la postazione di presa comande e la cucina in un ambiente di ristorazione frenetico (chiosco/street food).

Sviluppata con un approccio **Mobile-First** e **Offline-First**, l'applicazione garantisce che nessun dato venga perso a causa di cali di rete e che l'interfaccia prevenga errori operativi tipici dell'alta pressione lavorativa nel settore della ristorazione come ad esempio chiusura accidentale della web-app, refresh accidentale della pagina.

## 🛠 Tech Stack

- **Frontend:** Vue.js 3 (Composition API)
- **Build Tool:** Vite
- **Backend & Database:** Firebase Cloud Firestore (NoSQL)
- **PWA:** vite-plugin-pwa (Service Worker per supporto offline)
- **Routing:** Vue Router 4
- **Autenticazione:** Firebase Authentication (JWT persistente su IndexedDB)

## ✨ Core Features

- **Architettura a Ruoli Segregati:** Schermata Home che smista l'utente verso la vista `Cameriere` (composizione ordine) o `Cucina` (ricezione e gestione).
- **Sincronizzazione Real-Time (Push-based):** La cucina riceve i nuovi ordini istantaneamente tramite WebSocket (`onSnapshot`), eliminando la necessità di polling o aggiornamenti manuali.
- **Gestione Varianti e Asporto:** Tagging visivo immediato per ordini "Da Asporto" (codice colore rosso) e gestione granulare delle varianti per singolo prodotto (es. "Senza Olio", "+ Origano").
- **Statistiche di Giornata:** Contatore dinamico dei prodotti preparati, con sistema di "soft-delete" (stati `archiviato` e `azzerato`) per ripulire lo schermo senza perdere i dati storici sul database.
- **Sicurezza Backend-First:** Sistema di autenticazione tramite Service Account interno. La protezione non si limita a nascondere le pagine web (tramite Router Guards protetti da Promise asincrone), ma blinda le API lato server tramite Firestore Security Rules, prevenendo l'iniezione di dati malevoli.

## 🧠 Scelte Progettuali (Domain-Driven Design)

Durante lo sviluppo, le decisioni architetturali sono state guidate dalle reali esigenze del dominio operativo (il lavoro in un chiosco):

### 1. Resilienza Offline a Tre Livelli

In un chiosco, il Wi-Fi può essere instabile. L'app implementa tre strati di sicurezza per i dati:

- **Memoria di Stato (In-flight):** Utilizzo di `watch` reattivi accoppiati al `localStorage` del browser. Se l'operatore ricarica la pagina per sbaglio a metà di un ordine, il carrello viene ripristinato istantaneamente.
- **Database Cache:** Inizializzazione di Firestore con `persistentLocalCache`. Se la rete cade al momento dell'invio, Firebase salva il payload localmente e lo sincronizza non appena torna la connessione.
- **Service Worker (PWA):** L'infrastruttura di base viene servita dalla cache del telefono, permettendo l'apertura dell'app anche in totale assenza di rete (evitando l'errore DNS del browser).

### 2. Algoritmo di Raggruppamento Dinamico (Cucina)

Inviare dati grezzi in cucina (es. una lista di 5 panini identici su 5 righe separate) genera confusione visiva.
È stato implementato un algoritmo di raggruppamento sul client della Cucina che calcola una "firma univoca" (`Signature`) per ogni panino basata su Nome + Varianti.

- Se un cliente ordina 3 panini identici, la cucina visualizza sinteticamente `3x Prosciutto Crudo`.
- Se uno dei tre ha una variante, l'algoritmo separa le firme mostrando `2x Prosciutto Crudo` e `1x Prosciutto Crudo (- Senza Olio)`, azzerando il tasso di errore in preparazione.

### 3. Normalizzazione dei Dati vs. UX

Per velocizzare la presa dell'ordine, i bottoni del cameriere mostrano un ID numerico (es. "4 - Prosciutto e Mozzarella"). Tuttavia, questo ID numerico viene disaccoppiato prima dell'invio al database (Data Normalization). Il payload JSON viaggia pulito (`nome: "Prosciutto e Mozzarella"`), permettendo all'algoritmo della cucina di accorpare i prodotti senza conflitti tra ID di menu e quantità da preparare.

### 4. Gestione Ciclo di Vita dei Dati (No Hard Deletes)

In un DB NoSQL, cancellare massivamente i documenti dal client è inefficiente e insicuro. Per pulire la "Coda Storico" o chiudere la giornata, l'app non lancia comandi di `DELETE`. Utilizza un sistema a stati (`attivo` -> `completato` -> `archiviato` -> `azzerato`), aggiornando solo il flag del documento. L'interfaccia reattiva filtra gli stati, mantenendo i dati intatti nel backend per future implementazioni analitiche.

### 5. Sicurezza: Il Falso Mito del Frontend (Backend-First Security)

Un errore comune nello sviluppo di SPA è affidare la sicurezza esclusivamente al framework frontend (es. nascondendo i bottoni o bloccando gli URL in Vue). Tuttavia, il frontend è un ambiente _untrusted_.
Per questo progetto, l'architettura di sicurezza è stata ribaltata:

1.  **Autorizzazione Server-Side (Zero Trust):** Non basta controllare genericamente se un utente è autenticato (`request.auth != null`), poiché le API di Firebase Auth consentirebbero la registrazione pubblica di account non autorizzati scavalcando il frontend. Per evitare la creazione di account fantasma e la successiva iniezione di dati, le regole di Firestore impongono il Principio del Minimo Privilegio verificando l'identità esatta dell'operatore (`request.auth.token.email == "staff@chiosco.it"`). Qualsiasi altra richiesta viene crittograficamente scartata.
2.  **Autenticazione Client-Side (UX & Flow):** La schermata di Login e le Router Guards di Vue agiscono unicamente come orchestratori dell'esperienza utente. Per evitare falsi logout causati dal tempo di lettura del token JWT dalla memoria locale (Race Condition durante il refresh di pagina), il Router implementa un costrutto a Promise (`attendiAuth()`) che congela la navigazione finché l'SDK di Firebase non ha terminato il ripristino sicuro della sessione.

### 6. State Management: YAGNI & KISS

Per la gestione dello stato globale si è scelto deliberatamente di NON utilizzare librerie esterne come Pinia. Dato il dominio estremamente circoscritto (flusso unidirezionale Cameriere -> DB -> Cucina), l'uso di Vue Reactivity (ref, watch) accoppiato al localStorage è sufficiente per garantire la persistenza in-flight, mantenendo il bundle dell'app leggero ed evitando over-engineering.

## 🚀 Setup e Installazione (Sviluppo Locale)

Per eseguire questo progetto localmente o prepararlo per il deployment, segui questi passaggi:

**1. Clona il repository:**

```bash
git clone [https://github.com/tuousername/chiosco-ordini.git](https://github.com/tuousername/chiosco-ordini.git)
cd chiosco-ordini
```
