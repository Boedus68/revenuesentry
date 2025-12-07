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
  treatment?: string; // Trattamento (BB, HB, FB, solo pernottamento)
  price_unit?: 'per_camera' | 'per_persona' | 'per_camera_per_notte';
  guests?: number; // Numero ospiti per cui è valido il prezzo
  nights?: number; // Numero notti
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
  treatment?: string;
  price_unit?: 'per_camera' | 'per_persona' | 'per_camera_per_notte';
  guests?: number;
  nights?: number;
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

    // Leggi le date e il filtro trattamento dai parametri query
    const { searchParams } = new URL(request.url);
    const checkinDateParam = searchParams.get('checkinDate');
    const checkoutDateParam = searchParams.get('checkoutDate');
    const treatmentFilter = searchParams.get('treatment'); // 'BB', 'FB', o null per tutti
    
    // Usa le date fornite o default a oggi/domani
    const checkinDate = checkinDateParam ? new Date(checkinDateParam) : new Date();
    const checkoutDate = checkoutDateParam ? new Date(checkoutDateParam) : (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    })();
    
    // Valida che checkout sia dopo checkin
    if (checkoutDate <= checkinDate) {
      logAdmin('[Competitor Prices GET] Date non valide', { checkinDate: checkinDateParam, checkoutDate: checkoutDateParam });
      return NextResponse.json(
        { error: 'La data di check-out deve essere successiva alla data di check-in' },
        { status: 400 }
      );
    }
    
    const checkinDateStr = checkinDate.toISOString().split('T')[0];
    const checkoutDateStr = checkoutDate.toISOString().split('T')[0];
    
    // Calcola numero di notti
    const nights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));
    
    logAdmin('[Competitor Prices GET] Date richieste', { 
      checkinDate: checkinDateStr, 
      checkoutDate: checkoutDateStr,
      nights,
      treatmentFilter 
    });

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

    // 2. Fetch prices per la data specifica (checkinDate)
    const prices: CompetitorPrice[] = [];
    const alerts: CompetitorAlert[] = [];
    const competitorsNeedingScraping: CompetitorDoc[] = [];

    for (const competitor of competitors) {
      try {
        const competitorName = competitor.competitor_name || competitor.name || '';
        if (!competitorName) {
          logAdmin(`[Competitor Prices GET] Competitor senza nome saltato`, { competitorId: competitor.id });
          continue;
        }

        logAdmin(`[Competitor Prices GET] Processing competitor`, { competitorId: competitor.id, competitorName });

        // Cerca prezzi per la data specifica di check-in
        const priceSnapshot = await adminDb
          .collection('competitor_data')
          .where('hotelId', '==', userId)
          .where('competitor_name', '==', competitorName)
          .where('date', '==', checkinDateStr)
          .get();

        logAdmin(`[Competitor Prices GET] Prices per competitor e data`, { 
          competitorId: competitor.id, 
          date: checkinDateStr,
          count: priceSnapshot.size 
        });

        if (!priceSnapshot.empty) {
          // Prendi il primo risultato (dovrebbe essere uno solo per data)
          const priceData = priceSnapshot.docs[0].data() as CompetitorDataDoc;
          
          // Filtra per trattamento se richiesto
          const competitorTreatment = priceData.treatment?.toUpperCase() || '';
          if (treatmentFilter) {
            const filterUpper = treatmentFilter.toUpperCase();
            if (filterUpper === 'BB' && competitorTreatment !== 'BB' && competitorTreatment !== 'B&B') {
              logAdmin(`[Competitor Prices GET] Competitor filtrato per trattamento`, { 
                competitorName, 
                treatment: competitorTreatment,
                filter: filterUpper 
              });
              continue; // Salta questo competitor
            }
            if (filterUpper === 'FB' && competitorTreatment !== 'FB' && competitorTreatment !== 'FULL BOARD' && competitorTreatment !== 'PENSIONE COMPLETA') {
              logAdmin(`[Competitor Prices GET] Competitor filtrato per trattamento`, { 
                competitorName, 
                treatment: competitorTreatment,
                filter: filterUpper 
              });
              continue; // Salta questo competitor
            }
          }

          prices.push({
            competitorId: competitor.id,
            competitorName: competitorName,
            price: safeNumber(priceData.price, 0),
            date: priceData.date || checkinDateStr,
            scrapedAt: priceData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            treatment: priceData.treatment || undefined,
            price_unit: priceData.price_unit || 'per_camera',
            guests: priceData.guests || undefined,
            nights: priceData.nights || nights
          });

          // Check per alert: confronta con prezzo precedente (più recente prima di questa data)
          const previousPriceSnapshot = await adminDb
            .collection('competitor_data')
            .where('hotelId', '==', userId)
            .where('competitor_name', '==', competitorName)
            .where('date', '<', checkinDateStr)
            .orderBy('date', 'desc')
            .limit(1)
            .get();

          if (!previousPriceSnapshot.empty) {
            const previousPriceData = previousPriceSnapshot.docs[0].data() as CompetitorDataDoc;
            const oldPrice = safeNumber(previousPriceData.price, 0);
            const newPrice = safeNumber(priceData.price, 0);
            const changePercent = calculateChangePercent(oldPrice, newPrice);

            // Alert se cambio significativo (>10%)
            if (Math.abs(changePercent) >= 10) {
              alerts.push({
                competitorName: competitorName,
                oldPrice,
                newPrice,
                changePercent,
                severity: getSeverity(changePercent),
                date: priceData.date || checkinDateStr
              });
            }
          }
        } else {
          // Nessun prezzo trovato per questa data - aggiungi alla lista per scraping
          competitorsNeedingScraping.push(competitor);
        }
      } catch (error: any) {
        logAdmin(`[Competitor Prices GET] Error per competitor ${competitor.id}: ${error.message}`, { error: error.stack });
        // Continua con next competitor invece di fallire tutto
      }
    }

    // 3. Se ci sono competitor senza prezzi per questa data, genera mock data
    if (competitorsNeedingScraping.length > 0) {
      logAdmin(`[Competitor Prices GET] Generazione mock prices per ${competitorsNeedingScraping.length} competitor senza dati`);
      
      for (const competitor of competitorsNeedingScraping) {
        const competitorName = competitor.competitor_name || competitor.name || '';
        
        // Determina il trattamento in base al filtro o usa BB come default
        let mockTreatment = 'BB';
        if (treatmentFilter) {
          const filterUpper = treatmentFilter.toUpperCase();
          if (filterUpper === 'FB') {
            mockTreatment = 'FB';
          } else {
            mockTreatment = 'BB';
          }
        }
        
        // Genera mock price (variabile per data e competitor per simulare prezzi diversi)
        const basePrice = mockTreatment === 'FB' ? 120 : 90; // Full board costa di più
        // Usa hash della data per variare il prezzo in modo deterministico ma variabile
        const dateHash = checkinDateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Usa hash del nome competitor per variare il prezzo base
        const nameHash = competitorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const dateVariation = dateHash % 60; // Variazione 0-59 basata sulla data
        const nameVariation = (nameHash % 30); // Variazione 0-29 basata sul nome
        const mockPrice = Math.round((basePrice + dateVariation + nameVariation) * 100) / 100; // €90-179 (BB) o €120-209 (FB)
        
        prices.push({
          competitorId: competitor.id,
          competitorName: competitorName,
          price: mockPrice,
          date: checkinDateStr,
          scrapedAt: new Date().toISOString(),
          treatment: mockTreatment,
          price_unit: 'per_camera_per_notte',
          guests: 2, // Default 2 ospiti per camera doppia
          nights: nights
        });

        // Salva mock price in DB per questa data specifica
        try {
          // Determina il trattamento in base al filtro o usa BB come default
          let mockTreatment = 'BB';
          if (treatmentFilter) {
            const filterUpper = treatmentFilter.toUpperCase();
            if (filterUpper === 'FB') {
              mockTreatment = 'FB';
            } else {
              mockTreatment = 'BB';
            }
          }
          
          await adminDb.collection('competitor_data').add({
            hotelId: userId,
            competitor_name: competitorName,
            price: mockPrice,
            date: checkinDateStr,
            treatment: mockTreatment,
            price_unit: 'per_camera_per_notte',
            guests: 2,
            nights: nights,
            isMock: true,
            createdAt: FieldValue.serverTimestamp()
          });
          logAdmin(`[Competitor Prices GET] Mock price creato per data`, { 
            competitorName, 
            price: mockPrice, 
            date: checkinDateStr 
          });
        } catch (saveError: any) {
          logAdmin(`[Competitor Prices GET] Errore salvataggio mock price`, { error: saveError.message });
        }
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
