// API route per gestire il callback OAuth di Fatture in Cloud
import { NextRequest, NextResponse } from 'next/server';
import { exchangeFICCodeForToken, getFICCompanies, saveFICConfig } from '../../../../../lib/services/fattureincloud-service';
import { logAdmin } from '../../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logAdmin(`[FIC] Errore OAuth callback: ${error}`);
      return NextResponse.redirect(
        new URL(`/dashboard?fic_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?fic_error=missing_code_or_state', request.url)
      );
    }

    // Estrai userId dallo state (formato: userId-timestamp-random)
    const userId = state.split('-')[0];
    if (!userId) {
      return NextResponse.redirect(
        new URL('/dashboard?fic_error=invalid_state', request.url)
      );
    }

    // Recupera clientId e clientSecret dalla configurazione esistente
    const { getFICConfig } = await import('../../../../../lib/services/fattureincloud-service');
    const existingConfig = await getFICConfig(userId);
    
    if (!existingConfig || !existingConfig.clientId || !existingConfig.clientSecret) {
      logAdmin(`[FIC] Configurazione non trovata per utente ${userId}`);
      return NextResponse.redirect(
        new URL('/dashboard?fic_error=missing_credentials', request.url)
      );
    }

    const clientId = existingConfig.clientId;
    const clientSecret = existingConfig.clientSecret;

    // Costruisci redirect URI
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = `${protocol}://${host}/api/integrations/fattureincloud/callback`;

    // Scambia codice per token
    const tokenData = await exchangeFICCodeForToken(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Recupera lista aziende
    const companies = await getFICCompanies(tokenData.access_token);
    
    // Salva configurazione
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    await saveFICConfig(userId, {
      clientId,
      clientSecret,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      companyId: companies.length > 0 ? String(companies[0].id) : undefined,
      enabled: true,
    });

    logAdmin(`[FIC] OAuth completato per utente ${userId}, azienda: ${companies[0]?.name || 'N/A'}`);

    return NextResponse.redirect(
      new URL('/dashboard?fic_success=1', request.url)
    );

  } catch (error: any) {
    logAdmin(`[FIC] Errore callback: ${error.message}`, { error: error.stack });
    return NextResponse.redirect(
      new URL(`/dashboard?fic_error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
