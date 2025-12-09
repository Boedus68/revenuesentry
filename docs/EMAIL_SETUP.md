# Configurazione Sistema Email

Questo documento spiega come configurare il sistema di notifiche email per RevenueSentry.

## Servizio Email: Resend

RevenueSentry usa [Resend](https://resend.com) per inviare email transazionali.

### Setup Iniziale

1. **Crea un account Resend**
   - Vai su https://resend.com
   - Crea un account gratuito (fino a 3.000 email/mese)

2. **Ottieni la tua API Key**
   - Vai su https://resend.com/api-keys
   - Crea una nuova API Key
   - Copia la chiave (inizia con `re_`)

3. **Verifica un dominio email (opzionale ma consigliato)**
   - Vai su https://resend.com/domains
   - Aggiungi il tuo dominio
   - Configura i record DNS come indicato
   - Per test, puoi usare il dominio di Resend: `onboarding@resend.dev`

### Configurazione Variabili d'Ambiente

Crea un file `.env.local` nella root del progetto:

```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email mittente (deve essere verificata su Resend)
# Per test, usa: onboarding@resend.dev
# Per produzione, usa un dominio verificato: noreply@tudominio.com
FROM_EMAIL=noreply@revenuesentry.com

# URL dell'applicazione (per link nelle email)
NEXT_PUBLIC_APP_URL=https://tua-app.com
```

### Tipi di Email

Il sistema invia automaticamente:

1. **Email di Benvenuto**
   - Inviata alla registrazione
   - Include informazioni su come iniziare

2. **Email Consigli AI**
   - Inviata quando vengono generati nuovi consigli ad alta priorità
   - Include fino a 3 consigli più importanti
   - Inviata solo se ci sono consigli con priorità "alta" o "critica"

### Test Email

Per testare il sistema email in locale:

1. Configura le variabili d'ambiente
2. Registra un nuovo utente
3. Verifica che ricevi l'email di benvenuto
4. Genera dei consigli AI nel dashboard
5. Verifica che ricevi l'email con i consigli (se ce ne sono ad alta priorità)

### Troubleshooting

**Email non vengono inviate:**
- Verifica che `RESEND_API_KEY` sia configurata correttamente
- Controlla i log della console per errori
- Verifica che l'email mittente sia verificata su Resend

**Email vanno in spam:**
- Verifica il tuo dominio su Resend (non solo l'email)
- Configura SPF e DKIM correttamente
- Evita contenuti che possono essere classificati come spam

### Limiti

- Piano gratuito Resend: 3.000 email/mese
- Piano Pro: 50.000 email/mese
- Per produzione, considera un piano pagamento

### Alternative

Se preferisci usare un altro servizio email, modifica `lib/email.ts`:
- **SendGrid**: `@sendgrid/mail`
- **AWS SES**: `@aws-sdk/client-ses`
- **Mailgun**: `mailgun.js`

