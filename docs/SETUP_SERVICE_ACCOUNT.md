# Setup Service Account - Soluzione Rapida

## Problema
Next.js non legge correttamente la variabile `FIREBASE_SERVICE_ACCOUNT_KEY` dal file `.env.local`.

## Soluzione Alternativa (PIÙ SEMPLICE)

Invece di usare la variabile d'ambiente, puoi usare direttamente il file JSON del service account.

### Passo 1: Rinomina il file JSON
1. Apri la cartella dove hai salvato il file JSON del service account scaricato da Firebase
2. Rinomina il file in: **`service-account-key.json`** (nome esatto, tutto minuscolo con trattini)

### Passo 2: Sposta il file nella root del progetto
1. Sposta (o copia) il file `service-account-key.json` nella **root del progetto**
   - Stessa cartella dove si trova `package.json`
   - Stessa cartella dove si trova `next.config.mjs`

### Passo 3: Verifica la struttura
La struttura dovrebbe essere:
```
revenuesentry/
├── service-account-key.json  ← QUI
├── package.json
├── next.config.mjs
├── .env.local (opzionale)
└── ...
```

### Passo 4: Riavvia il server
1. Ferma il server (Ctrl+C)
2. Riavvia con `npm run dev`

### Passo 5: Verifica nei log
Dovresti vedere:
```
[Firebase Admin] Tentativo lettura da file service-account-key.json
[Firebase Admin] ✅ Service Account caricato da file
[Firebase Admin] ✅ Inizializzato correttamente con Service Account
```

## Sicurezza

⚠️ **IMPORTANTE:**
- **NON** committare `service-account-key.json` nel repository Git
- Il file è già nel `.gitignore`, ma verifica che non venga committato accidentalmente
- Questo metodo funziona solo in sviluppo locale
- In produzione, usa la variabile d'ambiente `FIREBASE_SERVICE_ACCOUNT_KEY`

## Troubleshooting

### Il file non viene trovato
- Verifica che il nome sia esattamente `service-account-key.json` (case-sensitive)
- Verifica che sia nella root del progetto (stessa cartella di `package.json`)
- Riavvia completamente il server

### Errore "JSON parsing"
- Verifica che il file JSON sia valido (puoi aprirlo con un editor di testo)
- Non modificare il contenuto del JSON
- Assicurati che il file non sia corrotto

## Alternativa: Variabile d'Ambiente

Se preferisci usare la variabile d'ambiente invece del file:

1. Crea/modifica `.env.local` nella root
2. Aggiungi:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```
3. Riavvia il server

**Nota**: Su alcuni sistemi, Next.js potrebbe non leggere correttamente `.env.local`. In quel caso, usa il metodo del file JSON descritto sopra.

