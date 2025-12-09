# Setup Admin Panel

Questa guida spiega come configurare e usare il pannello amministratore di RevenueSentry.

## Creare un Utente Admin

Per creare un utente amministratore, devi aggiungere il campo `role: 'admin'` al documento dell'utente in Firestore.

### Metodo 1: Da Firebase Console

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Seleziona il tuo progetto
3. Vai su Firestore Database
4. Trova il documento dell'utente nella collezione `users`
5. Aggiungi/modifica il campo `role` con valore `"admin"`

### Metodo 2: Da Codice (Temporaneo)

Puoi temporaneamente aggiungere questo codice in una pagina per promuovere un utente ad admin:

```typescript
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

// Promuove l'utente corrente ad admin
async function makeCurrentUserAdmin() {
  const user = auth.currentUser;
  if (!user) return;
  
  await updateDoc(doc(db, 'users', user.uid), {
    role: 'admin'
  });
  
  console.log('Utente promosso ad admin!');
}
```

⚠️ **IMPORTANTE**: Rimuovi questo codice dopo aver promosso l'utente!

## Accesso al Pannello Admin

1. Assicurati che il tuo utente abbia `role: 'admin'` nel documento Firestore
2. Accedi normalmente al sistema
3. Vai su `/admin` nel browser

## Funzionalità del Pannello Admin

Il pannello admin mostra:

### Statistiche Generali
- **Utenti Totali**: Numero totale di utenti registrati
- **Utenti Attivi**: Utenti che hanno inserito dati (ricavi o costi)
- **Ricavi Totali**: Somma di tutti i ricavi di tutti gli hotel
- **Costi Totali**: Somma di tutti i costi di tutti gli hotel
- **Media Ricavi/Costi**: Media per hotel attivo

### Utilizzo del Sistema
- Hotel con dati ricavi
- Hotel con consigli AI generati
- Camere medie per hotel

### Registrazioni per Mese
- Grafico delle nuove registrazioni nel tempo

### Lista Utenti Completa
Tabella con:
- Nome hotel
- Email
- Tipo hotel (stagionale/annuale)
- Numero camere
- Ricavi e costi totali
- Indicatori di dati presenti (💰 ricavi, 📊 costi, 🤖 consigli)
- Data registrazione

## Sicurezza

⚠️ **IMPORTANTE**: Per sicurezza:

1. Le regole Firestore permettono agli admin di leggere tutti i documenti `users`
2. Solo gli utenti con `role: 'admin'` possono accedere al pannello admin (controllo lato client - da migliorare)
3. In produzione, considera di:
   - Aggiungere verifica admin lato server nelle API
   - Usare middleware per proteggere le route admin
   - Implementare autenticazione a due fattori per admin

## Limitazioni Attuali

- Il controllo admin è solo lato client (TODO: aggiungere verifica server-side)
- Le regole Firestore permettono agli admin di leggere tutti i documenti, ma non di modificarli (tranne per il campo `role`)
- Non c'è ancora un sistema di log per le azioni admin

## Configurazione Firebase Admin SDK

Per permettere alle API routes di accedere a tutti i dati degli utenti (bypassando le regole Firestore), devi configurare Firebase Admin SDK con un service account.

### Passo 1: Ottenere il Service Account Key

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Seleziona il tuo progetto "revenuesentry"
3. Clicca sull'icona ⚙️ **Project Settings** (in alto a sinistra)
4. Vai alla tab **Service Accounts**
5. Clicca su **Generate New Private Key**
6. Conferma e scarica il file JSON

### Passo 2: Configurare la Variabile d'Ambiente

Crea un file `.env.local` nella root del progetto (se non esiste già) e aggiungi:

```env
# Firebase Service Account Key (JSON come stringa)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"revenuesentry","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@revenuesentry.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'
```

**Nota importante**: 
- Il JSON deve essere su una singola riga
- Usa virgolette singole all'esterno e mantieni le virgolette doppie all'interno del JSON
- Alternativamente, puoi usare il formato multi-linea con backticks (vedi esempio sotto)

**Formato alternativo (con backticks per leggibilità)**:
```env
FIREBASE_SERVICE_ACCOUNT_KEY=`{
  "type": "service_account",
  "project_id": "revenuesentry",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@revenuesentry.iam.gserviceaccount.com",
  ...
}`
```

### Passo 3: Riavvia il Server di Sviluppo

Dopo aver aggiunto la variabile d'ambiente:
```bash
# Ferma il server (Ctrl+C) e riavvia
npm run dev
```

### Verifica

Se la configurazione è corretta, quando accedi a `/admin`, nei log del server dovresti vedere:
```
[API Admin Stats] Usa Firebase Admin SDK
[API Admin Stats] Documenti trovati (admin): X
```

Se invece vedi:
```
[API Admin Stats] Usa Firebase Client SDK (fallback)
```
significa che Firebase Admin non è configurato e sta usando il fallback (che potrebbe ancora avere problemi con le regole Firestore).

### Produzione

Per la produzione (Vercel, Netlify, ecc.), aggiungi la stessa variabile d'ambiente nelle impostazioni del tuo servizio di hosting, nella sezione "Environment Variables".

## Miglioramenti Futuri

- [x] Verifica admin lato server
- [x] Middleware per proteggere route admin
- [x] Log delle azioni admin
- [x] Export dati in CSV/Excel
- [x] Filtri e ricerca nella lista utenti
- [x] Statistiche più dettagliate (KPI aggregati, trend, ecc.)
- [x] Dashboard con grafici interattivi

