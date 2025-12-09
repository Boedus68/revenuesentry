# Configurazione Vercel AI Gateway

## Setup

### 1. Installa dipendenze

```bash
npm install
```

Il pacchetto `ai` è già aggiunto a `package.json`.

### 2. Configura AI Gateway su Vercel

1. Vai su [Vercel AI Gateway](https://vercel.com/boedus-projects/revenuesentry/ai-gateway)
2. Crea una API Key o collega il progetto con OIDC

**Opzione A: API Key**
- Crea una API Key
- Aggiungi come variabile d'ambiente su Vercel:
  - Name: `AI_GATEWAY_API_KEY`
  - Value: `your_api_key_here`
  - Environments: Production, Preview, Development

**Opzione B: OIDC Token (consigliato)**
```bash
vercel link
vercel env pull
```

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

