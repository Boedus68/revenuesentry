# Configurazione Firestore Rules

## Problema
Se ricevi l'errore "Missing or insufficient permissions", significa che le regole di sicurezza di Firestore non permettono l'accesso ai dati.

## Soluzione

### Passo 1: Accedi alla Firebase Console
1. Vai su https://console.firebase.google.com/
2. Seleziona il progetto "revenuesentry"

### Passo 2: Apri Firestore Database
1. Nel menu laterale, clicca su "Firestore Database"
2. Clicca sulla tab "Rules" (in alto)

### Passo 3: Copia e incolla le regole
Copia il contenuto del file `firestore.rules` che hai nel progetto e incollalo nella console Firebase.

Le regole permettono:
- ✅ Ogni utente autenticato può leggere e scrivere solo il proprio documento nella collezione `users`
- ✅ Nessun accesso ad altre collezioni

### Passo 4: Pubblica le regole
1. Clicca su "Pubblica" (Publish) in alto a destra
2. Attendi la conferma che le regole sono state pubblicate

### Verifica
Dopo aver pubblicato le regole, prova di nuovo a salvare i dati dalla dashboard. Dovrebbe funzionare correttamente.

## Note di Sicurezza
- Le regole attuali permettono solo agli utenti autenticati di accedere
- Ogni utente può modificare solo il proprio documento (basato su `request.auth.uid == userId`)
- Tutte le altre collezioni sono bloccate per default

