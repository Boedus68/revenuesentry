// API endpoint per competitor prices
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { logAdmin } from '../../../../lib/admin-log';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ============================================================================
// TYPES
// ============================================================================

interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  price: number;
  date: string;
  scrapedAt: string;
}

interface CompetitorAlert {
  competitorName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  severity: 'high' | 'medium' | 'low';
  date: string;
}

interface CompetitorDataDoc {
  hotelId: string;
  competitorId?: string;
  competitor_name?: string;
  competitorName?: string;
  price: number;
  date: string;
  isMock?: boolean;
  scraped_at?: any;
  createdAt?: any;
  updatedAt?: any;
}

interface CompetitorDoc {
  id: string;
  hotelId: string;
  competitor_name?: string;
  name?: string;
  url?: string;
  priceUnit?: 'per_notte' | 'per_persona';
  isActive: boolean;
  createdAt?: any;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function calculateChangePercent(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return 0;
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function getSeverity(changePercent: number): 'high' | 'medium' | 'low' {
  const absChange = Math.abs(changePercent);
  if (absChange >= 15) return 'high';
  if (absChange >= 10) return 'medium';
  return 'low';
}

/**
 * Extract userId from either Authorization header, hotelId query param, or body (for POST)
 */
async function getUserId(request: NextRequest, body?: any): Promise<string | null> {
  logAdmin('[Competitor Prices] Extracting userId...');
  
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  logAdmin('[Competitor Prices] Auth header:', { present: !!authHeader });
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      logAdmin('[Competitor Prices] Token verificato, userId:', { userId: decodedToken.uid });
      return decodedToken.uid;
    } catch (error: any) {
      logAdmin(`[Competitor Prices] Token verification failed: ${error.message}`, { error: error.message });
      // Non ritornare null subito, prova altri metodi come fallback
    }
  }
  
  // Try query param
  const { searchParams } = new URL(request.url);
  const hotelIdFromQuery = searchParams.get('hotelId');
  if (hotelIdFromQuery) {
    logAdmin('[Competitor Prices] Query param hotelId trovato', { hotelId: hotelIdFromQuery });
    return hotelIdFromQuery;
  }
  
  // Try body (for POST requests)
  if (body && body.hotelId) {
    logAdmin('[Competitor Prices] Body hotelId trovato', { hotelId: body.hotelId });
    return body.hotelId;
  }
  
  logAdmin('[Competitor Prices] Nessun hotelId trovato');
  return null;
}

// ============================================================================
// GET - Fetch competitor prices and alerts
// ============================================================================

export async function GET(request: NextRequest) {
  logAdmin('[Competitor Prices GET] Request received');
  
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin('[Competitor Prices GET] Firebase Admin non inizializzato');
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    const userId = await getUserId(request);
    
    if (!userId) {
      logAdmin('[Competitor Prices GET] Autenticazione fallita');
      return NextResponse.json(
        { error: 'Non autenticato - token o hotelId mancante' },
        { status: 401 }
      );
    }

    logAdmin('[Competitor Prices GET] userId trovato', { userId });

    // 1. Fetch competitors attivi (usa competitor_configs come negli altri endpoint)
    const competitorsSnapshot = await adminDb
      .collection('competitor_configs')
      .where('hotelId', '==', userId)
      .where('isActive', '==', true)
      .get();

    logAdmin('[Competitor Prices GET] Competitors trovati', { count: competitorsSnapshot.size });

    if (competitorsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        prices: [],
        alerts: [],
        stats: { avgPrice: 0, minPrice: 0, maxPrice: 0, competitorsCount: 0 },
        message: 'Nessun competitor configurato'
      });
    }

    const competitors = competitorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CompetitorDoc[];

    // 2. Fetch ALL prices per ogni competitor e prendi il più recente
    const today = new Date().toISOString().split('T')[0];
    const prices: CompetitorPrice[] = [];
    const alerts: CompetitorAlert[] = [];

    for (const competitor of competitors) {
      try {
        const competitorName = competitor.competitor_name || competitor.name || '';
        if (!competitorName) {
          logAdmin(`[Competitor Prices GET] Competitor senza nome saltato`, { competitorId: competitor.id });
          continue;
        }

        logAdmin(`[Competitor Prices GET] Processing competitor`, { competitorId: competitor.id });

        // Fetch tutti i prezzi per questo competitor (usa competitor_name per compatibilità)
        const allPricesSnapshot = await adminDb
          .collection('competitor_data')
          .where('hotelId', '==', userId)
          .where('competitor_name', '==', competitorName)
          .get();

        logAdmin(`[Competitor Prices GET] Prices per competitor`, { competitorId: competitor.id, count: allPricesSnapshot.size });

        if (!allPricesSnapshot.empty) {
          // Converti a array tipizzato e ordina per data
          const allPrices = allPricesSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as CompetitorDataDoc & { id: string }))
            .sort((a, b) => {
              // Usa scraped_at se disponibile, altrimenti createdAt
              const aTime = a.scraped_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.scraped_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime();
            });

          // Prendi il più recente
          const latestPriceData = allPrices[0];

          prices.push({
            competitorId: competitor.id,
            competitorName: competitorName,
            price: safeNumber(latestPriceData.price, 0),
            date: latestPriceData.date || today,
            scrapedAt: latestPriceData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
          });

          // Check per alert se c'è un prezzo precedente
          if (allPrices.length > 1) {
            const previousPriceData = allPrices[1];
            const oldPrice = safeNumber(previousPriceData.price, 0);
            const newPrice = safeNumber(latestPriceData.price, 0);
            const changePercent = calculateChangePercent(oldPrice, newPrice);

            // Alert se cambio significativo (>10%)
            if (Math.abs(changePercent) >= 10) {
              alerts.push({
                competitorName: competitorName,
                oldPrice,
                newPrice,
                changePercent,
                severity: getSeverity(changePercent),
                date: latestPriceData.date || today
              });
            }
          }
        } else {
          // Nessun prezzo trovato - genera mock data per demo
          const mockPrice = 90 + Math.floor(Math.random() * 60); // €90-150

          prices.push({
            competitorId: competitor.id,
            competitorName: competitorName,
            price: mockPrice,
            date: today,
            scrapedAt: new Date().toISOString()
          });

          // Salva mock price in DB per future reference
          try {
            await adminDb.collection('competitor_data').add({
              hotelId: userId,
              competitor_name: competitorName,
              price: mockPrice,
              date: today,
              isMock: true,
              createdAt: FieldValue.serverTimestamp()
            });
            logAdmin(`[Competitor Prices GET] Mock price creato`, { price: mockPrice });
          } catch (saveError: any) {
            logAdmin(`[Competitor Prices GET] Errore salvataggio mock price`, { error: saveError.message });
          }
        }
      } catch (error: any) {
        logAdmin(`[Competitor Prices GET] Error per competitor ${competitor.id}: ${error.message}`, { error: error.stack });
        // Continua con next competitor invece di fallire tutto
      }
    }

    // 3. Calcola statistiche
    const stats = {
      avgPrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length : 0,
      minPrice: prices.length > 0 ? Math.min(...prices.map(p => p.price)) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0,
      competitorsCount: competitors.length,
      lastUpdated: new Date().toISOString()
    };

    logAdmin('[Competitor Prices GET] Success!', {
      pricesCount: prices.length,
      alertsCount: alerts.length,
      stats
    });

    return NextResponse.json({
      success: true,
      prices,
      alerts,
      stats,
      metadata: {
        fetchedAt: new Date().toISOString(),
        dataSource: 'database'
      }
    });

  } catch (error: any) {
    logAdmin('[Competitor Prices GET] ERRORE', { message: error.message, stack: error.stack });
    
    return NextResponse.json(
      {
        error: 'Errore nel recupero prezzi competitor',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Manually add competitor price
// ============================================================================

export async function POST(request: NextRequest) {
  logAdmin('[Competitor Prices POST] Request received');
  
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin('[Competitor Prices POST] Firebase Admin non inizializzato');
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    // Parse body first (needed for getUserId to check body)
    let body;
    try {
      body = await request.json();
      logAdmin('[Competitor Prices POST] Body ricevuto', { 
        hasBody: !!body,
        hasHotelId: !!body?.hotelId,
        hasCompetitorId: !!body?.competitorId,
        hasPrice: !!body?.price
      });
    } catch (error: any) {
      logAdmin('[Competitor Prices POST] Body parse error', { error: error.message });
      return NextResponse.json(
        { error: 'Body richiesta non valido' },
        { status: 400 }
      );
    }

    // Get userId from header, query param, or body
    const userId = await getUserId(request, body);
    
    if (!userId) {
      logAdmin('[Competitor Prices POST] Autenticazione fallita');
      return NextResponse.json(
        { error: 'Non autenticato - token o hotelId mancante' },
        { status: 401 }
      );
    }

    logAdmin('[Competitor Prices POST] userId trovato', { userId });

    const { hotelId, competitorId, price, date } = body;

    // Se hotelId è nel body, usa quello (per compatibilità)
    const finalHotelId = hotelId || userId;

    // Valida input
    if (!competitorId || typeof competitorId !== 'string') {
      logAdmin('[Competitor Prices POST] competitorId mancante o invalido');
      return NextResponse.json(
        { error: 'ID competitor obbligatorio' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price <= 0) {
      logAdmin('[Competitor Prices POST] price invalido', { price });
      return NextResponse.json(
        { error: 'Prezzo non valido' },
        { status: 400 }
      );
    }

    // Verifica competitor ownership (usa competitor_configs)
    const competitorDoc = await adminDb.collection('competitor_configs').doc(competitorId).get();

    if (!competitorDoc.exists) {
      logAdmin('[Competitor Prices POST] Competitor non trovato', { competitorId });
      return NextResponse.json(
        { error: 'Competitor non trovato' },
        { status: 404 }
      );
    }

    const competitorData = competitorDoc.data() as CompetitorDoc;
    if (competitorData?.hotelId !== finalHotelId) {
      logAdmin('[Competitor Prices POST] Competitor non appartiene a userId');
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 403 }
      );
    }

    // Salva prezzo
    const priceDate = date || new Date().toISOString().split('T')[0];
    const competitorName = competitorData.competitor_name || competitorData.name || '';

    // Check se prezzo per questa data già esistente
    const existingSnapshot = await adminDb
      .collection('competitor_data')
      .where('hotelId', '==', finalHotelId)
      .where('competitor_name', '==', competitorName)
      .where('date', '==', priceDate)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing
      const docId = existingSnapshot.docs[0].id;
      await adminDb.collection('competitor_data').doc(docId).update({
        price,
        updatedAt: FieldValue.serverTimestamp()
      });

      logAdmin('[Competitor Prices POST] Prezzo aggiornato');
      return NextResponse.json({
        success: true,
        message: 'Prezzo aggiornato con successo'
      });
    } else {
      // Create new
      await adminDb.collection('competitor_data').add({
        hotelId: finalHotelId,
        competitor_name: competitorName,
        price,
        date: priceDate,
        isMock: false,
        createdAt: FieldValue.serverTimestamp()
      });

      logAdmin('[Competitor Prices POST] Prezzo creato');
      return NextResponse.json({
        success: true,
        message: 'Prezzo salvato con successo'
      }, { status: 201 });
    }

  } catch (error: any) {
    logAdmin('[Competitor Prices POST] ERRORE', { message: error.message, stack: error.stack });
    
    return NextResponse.json(
      {
        error: 'Errore nel salvataggio prezzo',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
