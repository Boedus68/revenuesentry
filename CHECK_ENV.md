# Verifica Configurazione .env.local

## Il Problema

Dai log vedo:
```
[Firebase Admin] Tentativo inizializzazione con Application Default Credentials
```

Questo significa che la variabile `FIREBASE_SERVICE_ACCOUNT_KEY` **NON viene letta**.

## Soluzione

### Passo 1: Verifica che il file esista

Il file deve chiamarsi esattamente **`.env.local`** (con il punto all'inizio) e deve essere nella **root del progetto** (stessa cartella di `package.json`).

### Passo 2: Formato Corretto

Il file `.env.local` deve contenere **una sola riga**:

```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"revenuesentry",...}'
```

**IMPORTANTE:**
- Il JSON deve essere su una **singola riga**
- Usa **virgolette singole** `'...'` all'esterno
- Mantieni le **virgolette doppie** `"..."` all'interno del JSON
- **NON** mettere spazi prima o dopo il `=`

### Passo 3: Esempio Completo

1. Apri il file JSON del service account che hai scaricato da Firebase
2. Copia tutto il contenuto (Ctrl+A, Ctrl+C)
3. Nel file `.env.local`, incolla così:

```env
FIREBASE_SERVICE_ACCOUNT_KEY='COPIAMECITUTTOILJSONQUI'
```

### Passo 4: Verifica

Dopo aver salvato il file, **RIAVVIA COMPLETAMENTE** il server:
1. Ferma il server (Ctrl+C nel terminale)
2. Riavvia con `npm run dev`

### Passo 5: Controlla i Log

Quando riavvii, dovresti vedere:
```
[Firebase Admin] ✅ FIREBASE_SERVICE_ACCOUNT_KEY presente: true
[Firebase Admin] ✅ Lunghezza chiave: XXXX caratteri
[Firebase Admin] Inizia con { (JSON valido): true
[Firebase Admin] ✅ Inizializzato correttamente con Service Account
```

Se vedi ancora:
```
[Firebase Admin] ❌ FIREBASE_SERVICE_ACCOUNT_KEY NON TROVATA
```

significa che:
- Il file non esiste o non è nella root
- Il nome del file è sbagliato
- La variabile è scritta in modo errato
- Il server non è stato riavviato

## Troubleshooting

### Il file esiste ma non viene letto

1. Verifica che il nome sia esattamente `.env.local` (non `.env.local.txt`)
2. Verifica che sia nella root del progetto (stessa cartella di `package.json`)
3. Verifica che non ci siano spazi nel nome della variabile: `FIREBASE_SERVICE_ACCOUNT_KEY` (non `FIREBASE_SERVICE_ACCOUNT_KEY `)

### Errore "JSON parsing"

Se vedi errori di parsing JSON, verifica che:
- Il JSON sia completo (non tagliato)
- Le virgolette siano corrette
- Non ci siano caratteri nascosti o problemi di encoding

### Windows: Problemi con le virgolette

Su Windows, se hai problemi con le virgolette, prova a usare i backticks:

```env
FIREBASE_SERVICE_ACCOUNT_KEY=`{"type":"service_account",...}`
```

