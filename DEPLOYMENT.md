# Guida alla Configurazione in Produzione

## Problema: Admin Panel non autorizza in produzione

Se l'admin panel funziona in localhost ma non in produzione, il problema è probabilmente legato alla configurazione di Firebase Admin SDK.

## Soluzione 1: Configurare FIREBASE_SERVICE_ACCOUNT_KEY (Consigliato)

### Per Vercel:

1. Vai su https://vercel.com/dashboard
2. Seleziona il tuo progetto
3. Vai su **Settings** > **Environment Variables**
4. Aggiungi una nuova variabile:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: Il contenuto JSON completo della service account key (senza nuove righe, tutto su una riga)
5. Seleziona gli ambienti (Production, Preview, Development)
6. Clicca **Save**
7. **Redeploy** l'applicazione

### Come ottenere la Service Account Key:

1. Vai su https://console.firebase.google.com/
2. Seleziona il progetto **revenuesentry**
3. Vai su ⚙️ **Project Settings** > **Service Accounts**
4. Clicca **Generate New Private Key**
5. Scarica il file JSON
6. Apri il file e copia TUTTO il contenuto JSON
7. Converti in una singola riga (rimuovi tutti i newline)
8. Incolla come valore della variabile d'ambiente

### Formato della variabile:

La variabile deve contenere il JSON completo su una singola riga, ad esempio:
```
{"type":"service_account","project_id":"revenuesentry","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}
```

## Soluzione 2: Verificare le Regole Firestore

Le regole Firestore devono permettere agli utenti di leggere il proprio documento per verificare il ruolo admin.

1. Vai su https://console.firebase.google.com/
2. Seleziona **revenuesentry** > **Firestore Database** > **Rules**
3. Verifica che le regole siano aggiornate (deve essere presente il file `firestore.rules` del progetto)
4. Clicca **Publish**

## Soluzione 3: Verificare il Ruolo Admin in Firestore

1. Vai su **Firestore Database**
2. Apri la collezione `users`
3. Trova il documento con il tuo UID (puoi trovarlo nella console del browser quando provi ad accedere)
4. Verifica che esista il campo `role` con valore `"admin"` (stringa, non booleano)
5. Se manca, aggiungilo:
   - Campo: `role`
   - Tipo: `string`
   - Valore: `admin`

## Debug

Se il problema persiste, controlla i log:

### In Produzione (Vercel):
1. Vai su **Deployments**
2. Clicca sull'ultimo deployment
3. Apri **Function Logs**
4. Cerca i log che iniziano con `[Admin Verify]` o `[API Admin Stats]`

### In Localhost:
Apri la console del terminale dove è in esecuzione `npm run dev` e cerca i log.

### Cosa verificare nei log:

1. `[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY presente: true/false`
2. `[Admin Verify] Admin SDK disponibile: true/false`
3. `[Admin Verify] Risultato Admin SDK` o `Risultato Client SDK`

## Fallback

Se Admin SDK non è disponibile, il sistema usa Client SDK come fallback. Questo dovrebbe funzionare SE:
- Le regole Firestore permettono la lettura del proprio documento
- L'utente è autenticato correttamente
- Il documento esiste e ha il campo `role: "admin"`

## Note Importanti

- **NON committare** la service account key nel repository
- La variabile `FIREBASE_SERVICE_ACCOUNT_KEY` deve essere configurata nelle variabili d'ambiente del servizio di hosting
- Dopo aver aggiunto la variabile, è necessario fare un **redeploy** completo

