// API per gestire competitor configurati dall'utente
// GET: lista competitor
// POST: aggiungi nuovo competitor

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebase-admin';
import { validateCompetitorConfig } from '../../../lib/firestore-schemas';
import { CompetitorConfig } from '../../../lib/types';
import { logAdmin } from '../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotelId');

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per GET competitors`, { hotelId });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      );
    }

    logAdmin(`[API] Get competitors request`, { hotelId });

    // Query senza orderBy per evitare bisogno di indice composito
    // Ordiniamo in memoria invece
    const snapshot = await adminDb
      .collection('competitor_configs')
      .where('hotelId', '==', hotelId)
      .get();

    const competitors: (CompetitorConfig & { id: string })[] = [];
    snapshot.docs.forEach(doc => {
      competitors.push({ ...doc.data(), id: doc.id } as CompetitorConfig & { id: string });
    });

    // Ordina in memoria per nome
    competitors.sort((a, b) => a.competitor_name.localeCompare(b.competitor_name));

    return NextResponse.json({ competitors }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore get competitors: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hotelId, competitor_name, location, bookingUrl, bookingId, priority, notes } = body;

    if (!hotelId || !competitor_name || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: hotelId, competitor_name, location' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per POST competitors`, { hotelId, competitor_name });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      );
    }

    logAdmin(`[API] Add competitor request`, { hotelId, competitor_name });

    const competitorData: Partial<CompetitorConfig> = {
      hotelId,
      competitor_name,
      location,
      bookingUrl,
      bookingId,
      isActive: true,
      priority: priority || 'medium',
      notes,
      created_at: new Date(),
    };

    const validated = validateCompetitorConfig(competitorData);
    if (!validated) {
      return NextResponse.json(
        { error: 'Invalid competitor data' },
        { status: 400 }
      );
    }

    // Verifica se esiste già
    const existingSnapshot = await adminDb
      .collection('competitor_configs')
      .where('hotelId', '==', hotelId)
      .where('competitor_name', '==', competitor_name)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: 'Competitor già esistente' },
        { status: 409 }
      );
    }

    const docRef = adminDb.collection('competitor_configs').doc();
    await docRef.set(validated);

    logAdmin(`[API] Competitor aggiunto: ${competitor_name}`);

    return NextResponse.json({
      success: true,
      competitor: { ...validated, id: docRef.id },
    }, { status: 201 });

  } catch (error: any) {
    logAdmin(`[API] Errore add competitor: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
