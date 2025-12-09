# Configurazione Vercel AI Gateway

## Setup

### 1. Installa dipendenze

```bash
npm install
```

Il pacchetto `ai` è già aggiunto a `package.json`.

### 2. Configura API Key OpenAI

**Opzione A: OpenAI diretto (più semplice)**
- Ottieni una API Key da [OpenAI](https://platform.openai.com/api-keys)
- Aggiungi su Vercel → Settings → Environment Variables:
  - Name: `OPENAI_API_KEY`
  - Value: `sk-...`
  - Environments: Production, Preview, Development

**Opzione B: Vercel AI Gateway (consigliato per produzione)**
1. Vai su [Vercel AI Gateway](https://vercel.com/boedus-projects/revenuesentry/ai-gateway)
2. Collega il progetto (se non già collegato)
3. Configura budget e monitoring
4. Aggiungi `OPENAI_API_KEY` come sopra
5. Vercel gestirà automaticamente il routing tramite AI Gateway

**Nota:** Con Vercel AI Gateway configurato, le chiamate passano automaticamente tramite il gateway per monitoring, budget e fallback.

### 3. Configura modello AI

Il chatbot usa `openai/gpt-4o-mini` per default (modello economico).

Per cambiare modello, modifica `app/api/chat/route.ts`:
```typescript
model: 'openai/gpt-4o-mini', // Cambia qui
```

Modelli disponibili:
- `openai/gpt-4o-mini` - Economico, veloce
- `openai/gpt-4o` - Più potente, più costoso
- `openai/gpt-3.5-turbo` - Alternativa economica
- `anthropic/claude-3-haiku` - Alternativa Anthropic

### 4. Test

Dopo il deploy, vai su Dashboard → Consigli AI e apri il chatbot.

## Funzionalità

Il chatbot può rispondere a domande su:
- KPI (RevPAR, ADR, Occupazione, GOP)
- Ricavi storici
- Confronti tra mesi
- Suggerimenti per migliorare performance
- Analisi trend

## Costi

Vercel AI Gateway offre:
- Budget management automatico
- Monitoring e analytics
- Load balancing tra provider
- Fallback automatico

Controlla i costi su [Vercel Dashboard → AI Gateway → Analytics](https://vercel.com/boedus-projects/revenuesentry/ai-gateway/analytics)

