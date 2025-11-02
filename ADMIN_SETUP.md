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

## Miglioramenti Futuri

- [ ] Verifica admin lato server
- [ ] Middleware per proteggere route admin
- [ ] Log delle azioni admin
- [ ] Export dati in CSV/Excel
- [ ] Filtri e ricerca nella lista utenti
- [ ] Statistiche più dettagliate (KPI aggregati, trend, ecc.)
- [ ] Dashboard con grafici interattivi

