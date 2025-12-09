# Troubleshooting: "Firebase Admin non inizializzato"

## Errore
Quando provi ad aggiungere o gestire competitor, vedi l'errore:
```
Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.
```

## Causa
Firebase Admin SDK non è stato inizializzato correttamente perché manca la configurazione del Service Account.

## Soluzione Rapida

### Opzione 1: Usa il file JSON (Consigliato per sviluppo)

1. **Scarica il Service Account Key da Firebase Console:**
   - Vai a [Firebase Console](https://console.firebase.google.com/)
   - Seleziona il progetto `revenuesentry`
   - Vai su "Impostazioni progetto" (icona ingranaggio) → "Account di servizio"
   - Clicca "Genera nuova chiave privata"
   - Scarica il file JSON

2. **Rinomina e posiziona il file:**
   - Rinomina il file scaricato in: `service-account-key.json`
   - Spostalo nella **root del progetto** (stessa cartella di `package.json`)

3. **Verifica struttura:**
   ```
   revenuesentry/
   ├── service-account-key.json  ← QUI
   ├── package.json
   ├── .env.local
   └── ...
   ```

4. **Riavvia il server:**
   ```bash
   # Ferma il server (Ctrl+C)
   npm run dev
   ```

5. **Verifica nei log del terminale:**
   Dovresti vedere:
   ```
   [Firebase Admin] ✅ Service Account caricato da file
   [Firebase Admin] ✅ Inizializzato correttamente con Service Account
   [Firebase Admin] ✅ Firestore Admin inizializzato correttamente
   ```

### Opzione 2: Usa variabile d'ambiente

1. **Crea/modifica `.env.local` nella root del progetto**

2. **Aggiungi la chiave:**
   ```env
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"revenuesentry",...}'
   ```
   ⚠️ **Importante**: Il valore deve essere un JSON valido su una singola riga, racchiuso tra virgolette singole.

3. **Come ottenere il JSON:**
   - Apri il file JSON del service account scaricato
   - Copia tutto il contenuto
   - Convertilo in una singola riga (rimuovi tutti i newline)
   - Oppure usa un tool online per minificare JSON

4. **Riavvia il server**

## Verifica Configurazione

Dopo aver configurato, controlla i log all'avvio del server. Dovresti vedere:

✅ **Configurazione corretta:**
```
[Firebase Admin] ✅ Service Account caricato da file
[Firebase Admin] ✅ Inizializzato correttamente con Service Account
[Firebase Admin] ✅ Firestore Admin inizializzato correttamente
```

❌ **Configurazione mancante:**
```
[Firebase Admin] ❌ FIREBASE_SERVICE_ACCOUNT_KEY NON TROVATA
[Firebase Admin] ⚠️ File service-account-key.json non trovato
[Firebase Admin] ⚠️ App non inizializzata, Firestore Admin non disponibile
```

## Sicurezza

⚠️ **IMPORTANTE:**
- **NON** committare `service-account-key.json` nel repository Git
- Il file è già nel `.gitignore`, ma verifica:
  ```bash
  git check-ignore service-account-key.json
  ```
  Dovrebbe restituire il percorso del file (significa che è ignorato)

- **NON** condividere mai il file JSON o la chiave con altri
- In produzione, usa sempre variabili d'ambiente (non file JSON)

## Troubleshooting Avanzato

### Il file non viene trovato
- Verifica che il nome sia esattamente `service-account-key.json` (case-sensitive)
- Verifica che sia nella root del progetto (stessa cartella di `package.json`)
- Controlla i log per vedere i percorsi cercati:
  ```
  [Firebase Admin] Working directory (cwd): ...
  [Firebase Admin] Percorso completo file: ...
  [Firebase Admin] File esiste?: false
  ```

### Errore "JSON parsing"
- Verifica che il file JSON sia valido (aprilo con un editor di testo)
- Non modificare il contenuto del JSON
- Assicurati che il file non sia corrotto

### Errore "Project ID mismatch"
- Verifica che il `project_id` nel JSON sia `revenuesentry`
- Se hai cambiato progetto, scarica un nuovo service account key

### Il server non rileva le modifiche
- Ferma completamente il server (Ctrl+C)
- Elimina `.next` folder: `rm -rf .next` (o `rmdir /s .next` su Windows)
- Riavvia: `npm run dev`

## Test Rapido

Dopo la configurazione, prova ad aggiungere un competitor:
1. Vai alla sezione "Competitor" nel dashboard
2. Clicca "Aggiungi Competitor"
3. Compila i campi obbligatori
4. Clicca "Aggiungi"

Se tutto funziona, vedrai il competitor nella lista. Se vedi ancora l'errore, controlla i log del server per dettagli.

## Supporto

Se il problema persiste:
1. Controlla i log completi del server (tutto l'output di `[Firebase Admin]`)
2. Verifica che il file `.env.local` esista e contenga la variabile (se usi Opzione 2)
3. Verifica che `service-account-key.json` esista nella root (se usi Opzione 1)
4. Riavvia completamente il server
