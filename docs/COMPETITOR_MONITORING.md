# Sistema Monitoraggio Competitor

## Panoramica

Il sistema di monitoraggio competitor permette di:
1. **Configurare competitor personalizzati** - L'utente può aggiungere/rimuovere hotel competitor da monitorare
2. **Scraping automatico prezzi** - I prezzi vengono recuperati automaticamente (attualmente mock, in futuro con Puppeteer/Playwright)
3. **Confronto prezzi** - Visualizzazione comparativa dei prezzi con alert automatici

## Unità di Misura Prezzi

I prezzi possono essere configurati in diverse unità di misura:

- **`per_camera`** - Prezzo totale per camera (indipendentemente dal numero di ospiti)
- **`per_persona`** - Prezzo per persona (moltiplicare per numero ospiti)
- **`per_camera_per_notte`** - Prezzo per camera per notte (moltiplicare per numero notti)

### Esempio:
- Se il tuo hotel ha prezzo **€130 per camera** (doppia, 2 persone, 1 notte)
- E un competitor mostra **€60 per persona** (stessa configurazione)
- Il sistema calcola: €60 × 2 persone = **€120 per camera**
- Differenza: €130 - €120 = **€10 più caro** (7.7%)

## Configurazione Competitor

### Aggiungere un Competitor

1. Vai alla sezione "Monitoraggio Competitor" nel dashboard
2. Clicca "Aggiungi Competitor"
3. Compila:
   - **Nome Hotel**: Nome del competitor
   - **Località**: Città/località
   - **URL Booking.com** (opzionale): Link alla pagina Booking.com per scraping futuro
   - **ID Booking.com** (opzionale): ID numerico hotel su Booking.com
   - **Priorità**: Alta/Media/Bassa (influenza frequenza monitoraggio)
   - **Note**: Note personali

### Gestire Competitor

- **Attiva/Disattiva**: Puoi temporaneamente disabilitare un competitor senza eliminarlo
- **Modifica**: Aggiorna informazioni competitor
- **Elimina**: Rimuovi definitivamente un competitor

## Come Funziona lo Scraping

### Stato Attuale (Sviluppo)
- **Mock Data**: I prezzi sono simulati per sviluppo/test
- **Cache**: I dati vengono cachati per 24 ore per evitare richieste eccessive

### Implementazione Futura (Produzione)
1. **Puppeteer/Playwright**: Scraping automatico da Booking.com
2. **API Booking.com**: Se disponibile, uso API ufficiale
3. **Frequenza**: Configurabile (giornaliera, settimanale, manuale)
4. **Multi-OTA**: Supporto per Expedia, Airbnb, etc.

## Alert Automatici

Il sistema genera alert quando:
- **Prezzo medio competitor >10% più basso** del tuo prezzo → Alert HIGH
- **Competitor specifico >10% più economico** → Alert MEDIUM

Gli alert vengono salvati in `agent_actions` per tracciamento storico.

## API Endpoints

### GET `/api/competitors?hotelId=xxx`
Lista tutti i competitor configurati per un hotel

### POST `/api/competitors`
Aggiungi nuovo competitor
```json
{
  "hotelId": "xxx",
  "competitor_name": "Hotel Riviera",
  "location": "Cattolica",
  "bookingUrl": "https://...",
  "priority": "high"
}
```

### PUT `/api/competitors/[id]`
Aggiorna competitor esistente

### DELETE `/api/competitors/[id]`
Elimina competitor

### POST `/api/scraper/competitor-prices`
Scrapa prezzi competitor (usa competitor configurati se disponibili)

## Collezioni Firestore

### `competitor_configs`
Configurazione competitor dell'utente
- `hotelId`: ID hotel proprietario
- `competitor_name`: Nome competitor
- `location`: Località
- `isActive`: Attivo/Disattivo
- `priority`: Priorità monitoraggio

### `competitor_data`
Dati scraped (cache 24h)
- `hotelId`: ID hotel proprietario
- `competitor_name`: Nome competitor
- `date`: Data prezzo
- `price`: Prezzo
- `price_unit`: Unità di misura
- `treatment`: Trattamento (BB, HB, FB)
- `room_type`: Tipo camera

## Note Importanti

⚠️ **Scraping Booking.com**: Lo scraping automatico di Booking.com potrebbe violare i Terms of Service. In produzione, considera:
- Usare API ufficiali se disponibili
- Richiedere permesso a Booking.com
- Usare servizi terzi autorizzati (es. DataForTravel, OTA Insight)

✅ **Best Practice**: 
- Configura solo competitor realmente rilevanti (stessa categoria, stessa zona)
- Mantieni lista aggiornata (rimuovi competitor non più rilevanti)
- Usa priorità "Alta" solo per competitor diretti più importanti
