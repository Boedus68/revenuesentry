# Configurazione Firebase Admin SDK

Questa guida spiega come configurare Firebase Admin SDK per permettere alle API routes di accedere a tutti i dati degli utenti (bypassando le regole Firestore).

## Perché è necessario?

Le API routes server-side di Next.js usano il client SDK di Firebase, che rispetta le regole Firestore. Senza autenticazione nel contesto server, queste regole possono bloccare l'accesso ai dati.

Firebase Admin SDK bypassa le regole Firestore perché viene eseguito con privilegi amministrativi, permettendo alle API admin di leggere tutti i dati degli utenti.

## Passo 1: Ottenere il Service Account Key

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Seleziona il tuo progetto **revenuesentry**
3. Clicca sull'icona ⚙️ **Project Settings** (in alto a sinistra, accanto a "Project Overview")
4. Vai alla tab **Service Accounts** (in alto)
5. Clicca sul pulsante **Generate New Private Key**
6. Leggi e accetta l'avviso di sicurezza
7. Clicca **Generate Key**
8. Il file JSON verrà scaricato automaticamente (tienilo al sicuro!)

## Passo 2: Configurare la Variabile d'Ambiente

### Per Sviluppo Locale

Crea un file `.env.local` nella root del progetto (stessa cartella di `package.json`) se non esiste già.

Aggiungi questa riga:

```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"revenuesentry",...}'
```

**Come ottenere la stringa JSON**:
1. Apri il file JSON scaricato
2. Copia tutto il contenuto
3. Incollalo tra virgolette singole `'...'` nel file `.env.local`

**Esempio completo**:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"revenuesentry","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@revenuesentry.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40revenuesentry.iam.gserviceaccount.com"}'
```

**Nota importante**:
- Il JSON deve essere su una **singola riga** quando usi le virgolette singole
- Mantieni tutte le virgolette doppie all'interno del JSON
- Mantieni i `\n` per i newline nella private key

### Formato Alternativo (Multi-linea)

Se preferisci, puoi usare backticks per formattare il JSON su più righe:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=`{
  "type": "service_account",
  "project_id": "revenuesentry",
  "private_key_id": "abc123",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@revenuesentry.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}`
```

## Passo 3: Riavvia il Server di Sviluppo

Dopo aver aggiunto la variabile d'ambiente:

1. Ferma il server di sviluppo (Ctrl+C nel terminale)
2. Riavvia con `npm run dev`

## Verifica della Configurazione

### Verifica 1: Log del Server

Quando accedi a `/admin` e il pannello carica le statistiche, controlla i log del server nel terminale.

**Se configurato correttamente**, vedrai:
```
[API Admin Stats] Usa Firebase Admin SDK
[API Admin Stats] Documenti trovati (admin): X
```

**Se NON configurato**, vedrai:
```
[Firebase Admin] Inizializzazione fallita. Le API admin potrebbero non funzionare.
[Firebase Admin] Configura FIREBASE_SERVICE_ACCOUNT_KEY o usa Application Default Credentials.
[API Admin Stats] Usa Firebase Client SDK (fallback)
```

### Verifica 2: Funzionamento del Pannello Admin

1. Accedi a `/admin` con un utente admin
2. Se le statistiche vengono caricate correttamente, la configurazione è riuscita
3. Se vedi "Errore nel caricamento delle statistiche", controlla i log del server per maggiori dettagli

## Produzione

Per la produzione (Vercel, Netlify, Railway, ecc.), devi aggiungere la stessa variabile d'ambiente nelle impostazioni del tuo servizio di hosting.

### Vercel

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Settings** > **Environment Variables**
4. Aggiungi:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: Incolla il JSON completo (come stringa)
   - **Environments**: Seleziona tutte (Production, Preview, Development)
5. Clicca **Save**
6. Rigenera il deployment

### Altri Servizi di Hosting

Consulta la documentazione del tuo servizio di hosting per aggiungere variabili d'ambiente. Il processo è simile:
1. Trova la sezione "Environment Variables" o "Config"
2. Aggiungi `FIREBASE_SERVICE_ACCOUNT_KEY` con il valore JSON
3. Salva e ridistribuisci

## Sicurezza

⚠️ **IMPORTANTE**:
- **NON** committare il file `.env.local` nel repository Git (dovrebbe essere già nel `.gitignore`)
- **NON** condividere pubblicamente il service account key
- Il service account ha privilegi amministrativi sul progetto Firebase
- Se compromesso, revocalo immediatamente dalla Firebase Console e genera uno nuovo

## Troubleshooting

### Errore: "FIREBASE_SERVICE_ACCOUNT_KEY is not defined"

- Verifica che il file `.env.local` esista nella root del progetto
- Verifica che la variabile sia scritta correttamente (case-sensitive)
- Riavvia il server di sviluppo

### Errore: "Failed to parse private key"

- Verifica che il JSON sia valido
- Assicurati di aver mantenuto i `\n` nella private key
- Prova a copiare di nuovo il JSON dal file scaricato

### Le statistiche non si caricano ancora

1. Controlla i log del server per vedere quale SDK viene usato
2. Se vedi "Firebase Client SDK (fallback)", significa che Admin SDK non è inizializzato
3. Verifica che il JSON nel `.env.local` sia completo e valido
4. Controlla la console del browser per altri errori

### Il file .env.local non viene letto

- Assicurati che il file sia nella **root** del progetto (stessa cartella di `package.json`)
- Verifica che il nome del file sia esattamente `.env.local` (non `.env.local.txt`)
- Riavvia completamente il server di sviluppo

## Supporto

Se continui ad avere problemi, controlla:
1. I log del server per messaggi di errore dettagliati
2. La console del browser per errori client-side
3. Che il file `.env.local` sia formattato correttamente

