// API route per iniziare il flusso OAuth di Fatture in Cloud
import { NextRequest, NextResponse } from 'next/server';
import { getFICOAuthUrl, getFICConfig } from '../../../../../lib/services/fattureincloud-service';
import { logAdmin } from '../../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    
    // Accetta anche clientId e clientSecret come parametri opzionali (per retrocompatibilità)
    // ma preferisce recuperarli dal database
    const clientIdParam = searchParams.get('clientId');
    const clientSecretParam = searchParams.get('clientSecret');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Prova a recuperare le credenziali dal database
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    
    try {
      const config = await getFICConfig(userId);
      if (config?.clientId && config?.clientSecret) {
        clientId = config.clientId;
        clientSecret = config.clientSecret;
        logAdmin(`[FIC] Credenziali recuperate dal database per utente ${userId}`);
      }
    } catch (err) {
      logAdmin(`[FIC] Errore recupero config dal DB: ${err}`);
    }

    // Se non trovate nel database, usa i parametri URL (fallback)
    if (!clientId || !clientSecret) {
      if (clientIdParam && clientSecretParam) {
        clientId = decodeURIComponent(clientIdParam);
        clientSecret = decodeURIComponent(clientSecretParam);
        logAdmin(`[FIC] Credenziali recuperate dai parametri URL per utente ${userId}`);
      } else {
        return NextResponse.json(
          { error: 'Missing credentials. Please configure Client ID and Client Secret first.' },
          { status: 400 }
        );
      }
    }

    // Verifica che il Client ID non sia vuoto o contenga solo spazi
    if (!clientId || !clientId.trim()) {
      return NextResponse.json(
        { error: 'Invalid Client ID. Please check your configuration.' },
        { status: 400 }
      );
    }

    // Genera redirect URI (deve corrispondere a quello configurato nell'app Fatture in Cloud)
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/integrations/fattureincloud/callback`;

    // Genera uno state token per sicurezza
    const state = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Ottieni URL di autorizzazione
    const authUrl = getFICOAuthUrl(clientId.trim(), redirectUri, state);

    logAdmin(`[FIC] Avviato flusso OAuth per utente ${userId}, Client ID: ${clientId.substring(0, 10)}...`);
    logAdmin(`[FIC] Redirect URI: ${redirectUri}`);
    logAdmin(`[FIC] OAuth URL: ${authUrl.substring(0, 100)}...`);

    return NextResponse.json({
      authUrl,
      state,
      redirectUri,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[FIC] Errore auth: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
