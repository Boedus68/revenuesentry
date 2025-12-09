# Test Manuale Cron Job

## Test con cURL

### 1. Test su Production (Vercel)

```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://revenuesentry.vercel.app/api/cron/scrape-competitors
```

### 2. Test su Development Locale

```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/scrape-competitors
```

## Test con Postman / Insomnia

1. **Method:** GET
2. **URL:** `https://revenuesentry.vercel.app/api/cron/scrape-competitors`
3. **Headers:**
   - Key: `Authorization`
   - Value: `Bearer YOUR_CRON_SECRET`

## Test con Browser (solo se aggiungi query param per sviluppo)

⚠️ **NOTA:** Per sicurezza, l'endpoint richiede l'header Authorization. 
Per testare dal browser, puoi usare un'estensione come "ModHeader" o creare un endpoint di test temporaneo.

## Risposta Attesa

```json
{
  "success": true,
  "results": {
    "total": 12,
    "success": 8,
    "failed": 4,
    "errors": [
      "Hotel Elite: No price found",
      "Hotel Romagna: Scraping failed (404)"
    ],
    "hotelsProcessed": 2,
    "competitorsProcessed": 12
  },
  "durationMs": 325000,
  "durationSeconds": 325,
  "timestamp": "2025-12-09T10:30:00.000Z"
}
```

## Troubleshooting

### Errore 401 Unauthorized
- Verifica che `CRON_SECRET` sia configurato su Vercel
- Verifica che l'header Authorization sia: `Bearer YOUR_CRON_SECRET` (con spazio dopo Bearer)

### Errore 500 CRON_SECRET non configurato
- Aggiungi `CRON_SECRET` nelle Environment Variables di Vercel
- Rifa il deploy dopo aver aggiunto la variabile

### Nessun competitor trovato
- Verifica che ci siano competitor configurati in Firestore (`competitor_configs`)
- Verifica che i competitor abbiano `isActive: true`
- Verifica che i competitor abbiano `bookingUrl` configurato

