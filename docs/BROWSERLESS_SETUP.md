# Browserless.io Setup per Puppeteer su Vercel

## Problema Risolto

Puppeteer/Chromium non funzionava su Vercel Serverless Functions a causa di limitazioni con i binari Chromium. La soluzione è usare **Browserless.io**, un servizio cloud che gestisce Chromium per te.

## Setup

### 1. Registrati su Browserless

1. Vai su: https://www.browserless.io/
2. Sign up (Free tier: 6 ore/mese)
3. Dashboard → Copia il tuo **API Key** (es. `bless_abc123xyz...`)

### 2. Configura API Key su Vercel

1. Vercel Dashboard → Settings → Environment Variables
2. Aggiungi:
   - Name: `BROWSERLESS_API_KEY`
   - Value: `bless_abc123xyz...` (la tua chiave)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

### 3. Configura API Key Locale (opzionale)

Aggiungi a `.env.local`:

```bash
BROWSERLESS_API_KEY=bless_abc123xyz...
```

**Nota:** In sviluppo locale, se `BROWSERLESS_API_KEY` non è configurata, viene usato Puppeteer locale.

## Come Funziona

- **Produzione (Vercel):** Usa sempre Browserless (obbligatorio)
- **Sviluppo Locale:** 
  - Se `BROWSERLESS_API_KEY` è configurata → usa Browserless
  - Altrimenti → usa Puppeteer locale

## Test Locale

```bash
# Assicurati che BROWSERLESS_API_KEY sia in .env.local (opzionale)
npm run dev

# In un altro terminale, testa lo scraper
curl -X POST http://localhost:3000/api/scraper/booking \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.booking.com/hotel/it/d-annunzio.it.html",
    "checkIn": "2026-07-19",
    "checkOut": "2026-07-20",
    "boardType": "breakfast"
  }'
```

## Pricing Browserless

### Free Tier
- **6 ore/mese** (~720 scraping sessions da 30s)
- **Sufficiente per:** 12 hotel × 2 scraping/giorno × 30 giorni = 720 sessions ✅

### Paid Tiers
- **Starter:** $19/mese → 40 ore (4,800 sessions)
- **Growth:** $49/mese → 120 ore (14,400 sessions)
- **Enterprise:** Custom pricing

## Calcolo Usage (Cron Job Notturno)

**Setup attuale:**
- 12 competitor × 30s/scraping = 6 minuti/notte
- 30 notti = 180 minuti/mese = **3 ore/mese** ✅

**Free tier Browserless (6 ore) è PERFETTO per questo use case!**

## Vantaggi Browserless

✅ **Nessun setup Chromium** - funziona out-of-the-box  
✅ **Vercel compatible** - nessuna limitazione serverless  
✅ **Più veloce** - browser già warm, nessun cold start  
✅ **Più affidabile** - gestito professionalmente  
✅ **Monitoring** - dashboard con statistiche  

## Troubleshooting

### Errore: "BROWSERLESS_API_KEY non configurata"
→ Verifica che `BROWSERLESS_API_KEY` sia configurata su Vercel → Settings → Environment Variables

### Errore: "Connection refused"
→ Verifica che `BROWSERLESS_API_KEY` sia corretta (copia di nuovo da Browserless dashboard)

### Errore: "Timeout"
→ Browserless free tier ha limite 30s/session. Ottimizza selettori o upgrade a paid plan.

### Errore: "Quota exceeded"
→ Hai finito le 6 ore gratuite. Upgrade a paid plan o aspetta il reset mensile.

## Monitoring Usage

1. Login: https://www.browserless.io/
2. Dashboard → **Usage**
3. Vedi:
   - Ore usate questo mese
   - Sessions count
   - Errori
   - Quota rimanente

**TIP:** Configura alert quando raggiungi 80% quota.

## File Modificati

- ✅ `app/api/scraper/booking/route.ts` - Usa Browserless invece di Chromium
- ✅ `package.json` - Rimosso `@sparticuz/chromium`
- ✅ `vercel.json` - Nessuna modifica necessaria (già configurato `maxDuration: 60`)

## Risultato Finale

**PRIMA:**
- ❌ Chromium non funziona su Vercel
- ❌ Errore: "directory does not exist"
- ❌ Impossibile fare deploy

**DOPO:**
- ✅ Puppeteer funziona tramite Browserless cloud
- ✅ Nessun binario da deployare
- ✅ Più veloce e affidabile
- ✅ Free tier perfetto per cron notturno

