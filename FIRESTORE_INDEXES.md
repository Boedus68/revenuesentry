# Firestore Indexes Setup

Questo documento descrive gli indici compositi necessari per le query Firestore utilizzate dall'applicazione.

## Indice Richiesto: `historical_data`

### Query che richiede l'indice:
- **Collection**: `historical_data`
- **Filtri**: 
  - `hotelId` (==)
  - `date` (>=)
- **Ordinamento**: `date` (asc)

### Come creare l'indice:

1. **Metodo Automatico (consigliato)**:
   - Quando esegui una query che richiede un indice, Firebase ti mostrerà un errore con un link diretto
   - Clicca sul link nell'errore (esempio: `https://console.firebase.google.com/v1/r/project/revenuesentry/firestore/indexes?create_composite=...`)
   - Firebase Console aprirà automaticamente la pagina con l'indice pre-configurato
   - Clicca su "Create Index"

2. **Metodo Manuale**:
   - Vai su [Firebase Console](https://console.firebase.google.com/project/revenuesentry/firestore/indexes)
   - Clicca su "Create Index"
   - Configura:
     - **Collection ID**: `historical_data`
     - **Fields to index**:
       - `hotelId` - Ascending
       - `date` - Ascending
     - **Query scope**: Collection
   - Clicca su "Create"

### Tempo di creazione:
- Gli indici vengono creati in background e possono richiedere alcuni minuti
- Puoi monitorare lo stato nella pagina Indexes di Firebase Console
- Una volta creato, le query funzioneranno automaticamente

### Note:
- Questo indice è necessario per:
  - `/api/ml/forecast-revenue` - Previsioni revenue
  - `/api/analytics/cost-anomalies` - Analisi anomalie costi
- Se l'indice non è ancora stato creato, le query restituiranno un errore con il link diretto per crearlo

---

## Indice Richiesto: `competitor_configs` (OPZIONALE)

### Query che richiede l'indice:
- **Collection**: `competitor_configs`
- **Filtri**: 
  - `hotelId` (==)
- **Ordinamento**: `competitor_name` (asc)

### Nota:
⚠️ **Questo indice NON è più necessario** - La query è stata modificata per ordinare in memoria invece che su Firestore, evitando la necessità di un indice composito.

Se vedi ancora errori relativi a questo indice, segui il link nell'errore per crearlo automaticamente, oppure ignora l'errore se la query funziona comunque (ordinamento in memoria).
