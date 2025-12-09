# Script di Migrazione: Aggiunta boardType ai Competitors

Questo script aggiunge il campo `boardType: 'breakfast'` a tutti i competitors esistenti che non hanno ancora questo campo.

## Prerequisiti

Assicurati di avere configurato le credenziali Firebase Admin in uno dei seguenti modi:

### Opzione 1: Variabile d'ambiente (Consigliato per produzione)
```bash
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

Oppure in formato Base64:
```bash
export FIREBASE_SERVICE_ACCOUNT_KEY_BASE64='base64_encoded_json'
```

### Opzione 2: File JSON locale (Solo per sviluppo locale)
Crea uno dei seguenti file nella root del progetto:
- `service-account-key.json`
- `revenuesentry-firebase-key.json`

**⚠️ IMPORTANTE**: Questi file NON devono essere committati su GitHub! Sono già nel `.gitignore`.

## Esecuzione

```bash
npx tsx scripts/add-boardtype.ts
```

## Output atteso

```
✅ Service Account caricato da [fonte]
✅ Firebase Admin inizializzato

🔍 Connessione a Firestore...
📊 Trovati X competitors totali
  - Competitor 1: aggiunto boardType: 'breakfast'
  - Competitor 2: aggiunto boardType: 'breakfast'
  ...

💾 Salvataggio di X aggiornamenti...
✅ Aggiornati X competitors
ℹ️  Y competitors avevano già boardType

✅ Migrazione completata con successo!
```

## Cosa fa lo script

1. Carica le credenziali Firebase da variabile d'ambiente o file JSON
2. Si connette a Firestore
3. Recupera tutti i documenti dalla collezione `competitor_configs`
4. Per ogni competitor senza `boardType`, aggiunge `boardType: 'breakfast'`
5. Salva gli aggiornamenti in batch

## Troubleshooting

### Errore: "Nessuna credenziale Firebase trovata"
- Verifica che una delle opzioni di autenticazione sia configurata
- Controlla che il file JSON esista nella root del progetto
- Verifica che le variabili d'ambiente siano impostate correttamente

### Errore: "Unknown file extension .ts"
- Usa `npx tsx` invece di `npx ts-node`
- Oppure installa `tsx` globalmente: `npm install -g tsx`

### Errore di connessione Firestore
- Verifica che le credenziali siano valide
- Controlla che il progetto Firebase sia configurato correttamente
- Verifica i permessi del Service Account su Firestore
