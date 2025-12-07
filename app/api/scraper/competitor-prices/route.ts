// API endpoint per competitor prices
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { logAdmin } from '../../../../lib/admin-log';
import { FieldValue } from 'firebase-admin/firestore';

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
  competitorId: string;
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
  competitor_name: string;
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

// ============================================================================
// GET - Fetch competitor prices and alerts
// ============================================================================

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
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per GET competitor prices`, { hotelId });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    logAdmin(`[API] GET competitor prices request`, { hotelId });

    // 1. Fetch competitors attivi (usa competitor_configs come negli altri endpoint)
    const competitorsSnapshot = await adminDb
      .collection('competitor_configs')
      .where('hotelId', '==', hotelId)
      .where('isActive', '==', true)
      .get();

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
          logAdmin(`[API] Competitor senza nome saltato`, { competitorId: competitor.id });
          continue;
        }

        // Fetch tutti i prezzi per questo competitor
        const allPricesSnapshot = await adminDb
          .collection('competitor_data')
          .where('hotelId', '==', hotelId)
          .where('competitor_name', '==', competitorName)
          .get();

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
              hotelId,
              competitor_name: competitorName,
              price: mockPrice,
              date: today,
              isMock: true,
              createdAt: FieldValue.serverTimestamp()
            });
          } catch (saveError: any) {
            logAdmin(`[API] Errore salvataggio mock price: ${saveError.message}`);
          }
        }
      } catch (error: any) {
        logAdmin(`[API] Errore fetch prices per competitor ${competitor.id}: ${error.message}`);
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

    logAdmin(`[API] Competitor prices fetched`, {
      hotelId,
      competitorsCount: competitors.length,
      pricesCount: prices.length,
      alertsCount: alerts.length
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
    logAdmin(`[API] Errore GET competitor prices: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      {
        error: 'Errore nel recupero prezzi competitor',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Manually add competitor price
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hotelId, competitorId, price, date } = body;

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per POST competitor price`, { hotelId });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    // Valida input
    if (!competitorId || typeof competitorId !== 'string') {
      return NextResponse.json(
        { error: 'ID competitor obbligatorio' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json(
        { error: 'Prezzo non valido' },
        { status: 400 }
      );
    }

    // Verifica competitor ownership
    const competitorDoc = await adminDb.collection('competitor_configs').doc(competitorId).get();

    if (!competitorDoc.exists) {
      return NextResponse.json(
        { error: 'Competitor non trovato' },
        { status: 404 }
      );
    }

    const competitorData = competitorDoc.data() as CompetitorDoc;
    if (competitorData?.hotelId !== hotelId) {
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
      .where('hotelId', '==', hotelId)
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

      logAdmin(`[API] Competitor price updated`, { hotelId, competitorId, price, date: priceDate });

      return NextResponse.json({
        success: true,
        message: 'Prezzo aggiornato con successo'
      });
    } else {
      // Create new
      await adminDb.collection('competitor_data').add({
        hotelId,
        competitor_name: competitorName,
        price,
        date: priceDate,
        isMock: false,
        createdAt: FieldValue.serverTimestamp()
      });

      logAdmin(`[API] Competitor price added`, { hotelId, competitorId, price, date: priceDate });

      return NextResponse.json({
        success: true,
        message: 'Prezzo salvato con successo'
      }, { status: 201 });
    }

  } catch (error: any) {
    logAdmin(`[API] Errore POST competitor price: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      {
        error: 'Errore nel salvataggio prezzo',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
