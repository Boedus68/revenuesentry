// Servizio email con Resend
import { Resend } from 'resend';

// Inizializza Resend solo se la chiave API è disponibile
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@revenuesentry.com';
const FROM_NAME = 'RevenueSentry';

/**
 * Invia email di benvenuto all'utente registrato
 */
export async function sendWelcomeEmail(email: string, hotelName: string) {
  if (!resend) {
    console.warn('Resend non configurato: salto invio email di benvenuto');
    return { success: false, error: 'Resend non configurato' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [email],
      subject: 'Benvenuto in RevenueSentry! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Benvenuto in RevenueSentry! 🎉</h1>
            </div>
            <div class="content">
              <p>Ciao,</p>
              <p>Siamo entusiasti di darti il benvenuto in <strong>RevenueSentry</strong>!</p>
              <p>Il tuo hotel <strong>${hotelName}</strong> è stato registrato con successo.</p>
              <p>Ora puoi iniziare a:</p>
              <ul>
                <li>📊 Monitorare i tuoi KPI (RevPAR, TrevPAR, Occupazione, ecc.)</li>
                <li>💰 Analizzare i costi e identificare opportunità di risparmio</li>
                <li>🤖 Ricevere consigli intelligenti basati sull'AI</li>
                <li>📈 Ottimizzare la tua strategia di revenue management</li>
              </ul>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" class="button">
                Vai alla Dashboard
              </a>
              <p style="margin-top: 30px;">Se hai domande o hai bisogno di supporto, non esitare a contattarci.</p>
              <p>Buon lavoro!</p>
              <p>Il team di RevenueSentry</p>
            </div>
            <div class="footer">
              <p>Questa email è stata inviata automaticamente. Non rispondere a questa email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Errore invio email di benvenuto:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Errore invio email di benvenuto:', error);
    return { success: false, error };
  }
}

/**
 * Invia notifica email con consigli AI
 */
export async function sendAIRecommendationEmail(
  email: string,
  hotelName: string,
  recommendations: Array<{ titolo: string; descrizione: string; impattoStimato: number; priorita: string }>
) {
  if (!resend) {
    console.warn('Resend non configurato: salto invio email consigli AI');
    return { success: false, error: 'Resend non configurato' };
  }

  try {
    // Prendi solo i consigli ad alta priorità (max 3)
    const topRecommendations = recommendations
      .filter(r => r.priorita === 'alta' || r.priorita === 'critica')
      .slice(0, 3);

    if (topRecommendations.length === 0) {
      // Nessun consiglio ad alta priorità, non inviare email
      return { success: false, skipped: true };
    }

    const recommendationsList = topRecommendations
      .map((rec, idx) => `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #667eea; border-radius: 5px;">
          <h3 style="margin-top: 0; color: #667eea;">${idx + 1}. ${rec.titolo}</h3>
          <p style="margin: 10px 0;">${rec.descrizione}</p>
          <p style="margin: 5px 0;"><strong>Potenziale risparmio:</strong> €${rec.impattoStimato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          <span style="display: inline-block; padding: 5px 10px; background: ${rec.priorita === 'critica' ? '#ef4444' : '#f59e0b'}; color: white; border-radius: 3px; font-size: 12px; font-weight: bold;">
            ${rec.priorita === 'critica' ? '⚡ CRITICA' : '⚠️ ALTA'}
          </span>
        </div>
      `)
      .join('');

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [email],
      subject: `💡 Nuovi consigli AI per ${hotelName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💡 Nuovi Consigli AI per Te</h1>
            </div>
            <div class="content">
              <p>Ciao,</p>
              <p>Abbiamo analizzato i dati del tuo hotel <strong>${hotelName}</strong> e abbiamo identificato <strong>${topRecommendations.length}</strong> nuove opportunità di ottimizzazione ad alta priorità.</p>
              ${recommendationsList}
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" class="button">
                Vedi tutti i Consigli
              </a>
              <p style="margin-top: 30px;">Buon lavoro!</p>
              <p>Il team di RevenueSentry</p>
            </div>
            <div class="footer">
              <p>Questa email è stata inviata automaticamente. Non rispondere a questa email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Errore invio email consigli AI:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Errore invio email consigli AI:', error);
    return { success: false, error };
  }
}

