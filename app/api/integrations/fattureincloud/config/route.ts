// API route per gestire la configurazione Fatture in Cloud
import { NextRequest, NextResponse } from 'next/server';
import { getFICConfig, saveFICConfig, getFICCompanies, getValidAccessToken } from '../../../../../lib/services/fattureincloud-service';
import { logAdmin } from '../../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    const config = await getFICConfig(userId);
    
    if (!config) {
      return NextResponse.json({ config: null }, { status: 200 });
    }

    // Non restituire il clientSecret per sicurezza
    const { clientSecret, ...safeConfig } = config;

    return NextResponse.json({ config: safeConfig }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[FIC] Errore get config: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, clientId, clientSecret, enabled, companyId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Se stiamo abilitando, verifica che abbiamo clientId e clientSecret
    if (enabled && (!clientId || !clientSecret)) {
      return NextResponse.json(
        { error: 'clientId and clientSecret are required when enabling' },
        { status: 400 }
      );
    }

    // Recupera configurazione esistente
    const existingConfig = await getFICConfig(userId);

    const updateData: any = {
      enabled: enabled !== undefined ? enabled : existingConfig?.enabled ?? false,
    };

    // Rimuovi spazi iniziali/finali e verifica che non siano vuoti
    if (clientId) {
      const trimmedClientId = clientId.trim();
      if (trimmedClientId) {
        updateData.clientId = trimmedClientId;
        logAdmin(`[FIC] Salvando Client ID per utente ${userId}, lunghezza: ${trimmedClientId.length}`);
      } else {
        logAdmin(`[FIC] Client ID vuoto dopo trim per utente ${userId}`);
      }
    }
    
    if (clientSecret) {
      const trimmedClientSecret = clientSecret.trim();
      if (trimmedClientSecret) {
        updateData.clientSecret = trimmedClientSecret;
        logAdmin(`[FIC] Salvando Client Secret per utente ${userId}, lunghezza: ${trimmedClientSecret.length}`);
      } else {
        logAdmin(`[FIC] Client Secret vuoto dopo trim per utente ${userId}`);
      }
    }
    
    if (companyId) updateData.companyId = companyId;

    // Se stiamo abilitando e abbiamo già un access token, verifica che sia valido
    if (updateData.enabled && existingConfig?.accessToken) {
      try {
        const validToken = await getValidAccessToken({
          ...existingConfig,
          ...updateData,
        } as any);
        updateData.accessToken = validToken;
      } catch (error) {
        // Token non valido, sarà necessario riconnettersi
        logAdmin(`[FIC] Token non valido, richiesta riconnessione`);
      }
    }

    await saveFICConfig(userId, updateData);

    logAdmin(`[FIC] Configurazione aggiornata per utente ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Configurazione salvata',
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[FIC] Errore save config: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      );
    }

    // Disabilita l'integrazione (non cancelliamo i dati, solo disabilitiamo)
    await saveFICConfig(userId, {
      enabled: false,
    });

    logAdmin(`[FIC] Integrazione disabilitata per utente ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Integrazione disabilitata',
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[FIC] Errore delete config: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
