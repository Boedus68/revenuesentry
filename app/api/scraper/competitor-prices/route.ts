// API endpoint per scraping competitor prices
import { NextRequest, NextResponse } from 'next/server';
import { CompetitorScraper } from '../../../../lib/services/scraper-service';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { logAdmin } from '../../../../lib/admin-log';
import { AgentAction } from '../../../../lib/types';
import { validateAgentAction } from '../../../../lib/firestore-schemas';

// Helper functions
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

// GET - Fetch competitor prices and alerts
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
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    logAdmin(`[API] GET competitor prices request`, { hotelId });

    // 1. Fetch competitors attivi
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
    })) as Array<{ id: string; competitor_name?: string; [key: string]: any }>;

    // 2. Fetch latest prices per ogni competitor
    const today = new Date().toISOString().split('T')[0];
    const prices: any[] = [];
    const alerts: any[] = [];

    for (const competitor of competitors) {
      try {
        const competitorName = competitor.competitor_name;
        if (!competitorName) {
          logAdmin(`[API] Competitor senza nome saltato`, { competitorId: competitor.id });
          continue;
        }

        // Fetch ultimo prezzo (senza orderBy per evitare bisogno di indice)
        let latestPriceSnapshot;
        try {
          latestPriceSnapshot = await adminDb
            .collection('competitor_data')
            .where('hotelId', '==', hotelId)
            .where('competitor_name', '==', competitorName)
            .orderBy('scraped_at', 'desc')
            .limit(1)
            .get();
        } catch (orderByError: any) {
          // Se orderBy fallisce, prova senza e ordina in memoria
          const allPricesSnapshot = await adminDb
            .collection('competitor_data')
            .where('hotelId', '==', hotelId)
            .where('competitor_name', '==', competitorName)
            .get();
          
          const allPrices = allPricesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const aTime = a.scraped_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.scraped_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
              return bTime.getTime() - aTime.getTime();
            });
          
          latestPriceSnapshot = {
            empty: allPrices.length === 0,
            docs: allPrices.slice(0, 1).map(p => ({
              id: p.id,
              data: () => p
            })) as any[]
          } as any;
        }

        if (!latestPriceSnapshot.empty) {
          const latestPriceDoc = latestPriceSnapshot.docs[0];
          const latestPriceData = latestPriceDoc.data();
          const latestPrice = safeNumber(latestPriceData.price, 0);

          prices.push({
            competitorId: competitor.id,
            competitorName: competitorName,
            price: latestPrice,
            date: latestPriceData.date || today,
            scrapedAt: latestPriceData.scraped_at?.toDate?.()?.toISOString() || new Date().toISOString()
          });

          // Fetch previous price per alert (se disponibile)
          let previousPriceSnapshot;
          try {
            const allPricesSnapshot = await adminDb
              .collection('competitor_data')
              .where('hotelId', '==', hotelId)
              .where('competitor_name', '==', competitorName)
              .get();
            
            const allPrices = allPricesSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .sort((a, b) => {
                const aTime = a.scraped_at?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.scraped_at?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                return bTime.getTime() - aTime.getTime();
              });
            
            previousPriceSnapshot = {
              empty: allPrices.length < 2,
              docs: allPrices.length >= 2 ? [{
                id: allPrices[1].id,
                data: () => allPrices[1]
              }] : []
            } as any;
          } catch (err: any) {
            previousPriceSnapshot = { empty: true, docs: [] } as any;
          }

          if (!previousPriceSnapshot.empty) {
            const previousPriceData = previousPriceSnapshot.docs[0].data();
            const oldPrice = safeNumber(previousPriceData.price, 0);
            const changePercent = calculateChangePercent(oldPrice, latestPrice);

            // Alert se cambio significativo (>10%)
            if (Math.abs(changePercent) >= 10) {
              alerts.push({
                competitorName: competitorName,
                oldPrice,
                newPrice: latestPrice,
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
            scrapedAt: new Date().toISOString(),
            isMock: true
          });

          // Salva mock price in DB per future reference
          try {
            await adminDb.collection('competitor_data').add({
              hotelId,
              competitor_name: competitorName,
              price: mockPrice,
              date: today,
              isMock: true,
              scraped_at: adminDb.Timestamp.now()
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
      avgPrice: prices.length > 0 ? prices.reduce((sum, p) => sum + safeNumber(p.price), 0) / prices.length : 0,
      minPrice: prices.length > 0 ? Math.min(...prices.map(p => safeNumber(p.price))) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices.map(p => safeNumber(p.price))) : 0,
      competitorsCount: competitors.length,
      lastUpdated: new Date().toISOString()
    };

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location, checkinDate, checkoutDate, hotelId, currentPrice } = body;

    // Validazione input
    if (!location || !checkinDate || !checkoutDate || !hotelId) {
      return NextResponse.json(
        { error: 'Missing required fields: location, checkinDate, checkoutDate, hotelId' },
        { status: 400 }
      );
    }

    logAdmin(`[API] Competitor prices request`, { location, checkinDate, checkoutDate, hotelId });

    const scraper = new CompetitorScraper();
    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);

    // Verifica se ci sono competitor configurati
    const configuredCompetitors = await scraper.getConfiguredCompetitors(hotelId);
    
    // Verifica cache prima di scrapare
    const isCached = await scraper.isCached(hotelId, checkin);
    
    let competitors;
    let shouldRefreshCache = false;
    
    if (isCached && configuredCompetitors.length > 0) {
      // Se ci sono competitor configurati, verifica che la cache li contenga tutti
      logAdmin(`[API] Verifica cache con ${configuredCompetitors.length} competitor configurati`);
      const cached = await scraper.getFromCache(hotelId, location, checkin);
      
      if (cached && cached.length > 0) {
        const cachedNames = new Set(cached.map(c => c.competitor_name));
        const configuredNames = new Set(configuredCompetitors.map((c: any) => c.competitor_name));
        
        // Verifica se tutti i competitor configurati sono nella cache
        const allConfiguredInCache = Array.from(configuredNames).every(name => cachedNames.has(name));
        
        if (allConfiguredInCache && cached.length === configuredCompetitors.length) {
          // Cache valida, usa i dati cached
          logAdmin(`[API] Usando dati cached (${cached.length} competitor)`);
          competitors = cached.map(c => ({
            hotel_name: c.competitor_name,
            price: c.price,
            rating: c.rating,
            availability: c.availability,
          }));
        } else {
          // Cache non contiene tutti i competitor configurati, forza refresh
          logAdmin(`[API] Cache non completa (cached: ${cached.length}, configurati: ${configuredCompetitors.length}), forzo refresh`);
          shouldRefreshCache = true;
        }
      } else {
        shouldRefreshCache = true;
      }
    } else if (isCached) {
      // Nessun competitor configurato, usa cache se disponibile
      logAdmin(`[API] Usando dati cached`);
      const cached = await scraper.getFromCache(hotelId, location, checkin);
      competitors = cached?.map(c => ({
        hotel_name: c.competitor_name,
        price: c.price,
        rating: c.rating,
        availability: c.availability,
      })) || [];
    }
    
    // Se non c'è cache valida o serve refresh, scrapa nuovi dati
    if (!competitors || shouldRefreshCache) {
      logAdmin(`[API] Scraping nuovi dati competitor`);
      competitors = await scraper.scrapeBookingPrices(location, checkin, checkout, hotelId);
    }

    // Calcola statistiche con safe number
    const stats = {
      avgPrice: competitors.length > 0 
        ? competitors.reduce((sum, c) => sum + safeNumber(c.price), 0) / competitors.length 
        : 0,
      minPrice: competitors.length > 0 
        ? Math.min(...competitors.map(c => safeNumber(c.price))) 
        : 0,
      maxPrice: competitors.length > 0 
        ? Math.max(...competitors.map(c => safeNumber(c.price))) 
        : 0,
      competitorsCount: competitors.length
    };

    // Genera alert se competitor hanno abbassato prezzi significativamente
    const alerts: any[] = [];
    
    if (currentPrice && stats.avgPrice > 0) {
      const priceDifference = calculateChangePercent(stats.avgPrice, safeNumber(currentPrice));
      
      // Alert se competitor sono più economici del 10%
      if (priceDifference > 10) {
        alerts.push({
          type: 'competitor_price_drop',
          severity: 'high',
          message: `I competitor hanno prezzi medi del ${priceDifference.toFixed(1)}% più bassi del tuo`,
          competitorStats: stats,
        });

        // Salva alert in agent_actions
        const adminDb = getAdminDb();
        if (adminDb) {
          try {
            const actionData: Partial<AgentAction> = {
              hotelId,
              action_type: 'competitor_alert',
              action_data: {
                alert_type: 'competitor_price_drop',
                current_price: currentPrice,
                competitor_avg_price: stats.avgPrice,
                price_difference_percent: priceDifference,
                competitors: competitors,
              },
              status: 'pending',
              reasoning: `I competitor nella zona hanno abbassato i prezzi del ${priceDifference.toFixed(1)}% rispetto al tuo prezzo attuale (€${currentPrice}). Considera di rivalutare la tua strategia di pricing.`,
              impact_estimate: Math.round((priceDifference / 100) * currentPrice * 30), // Stima impatto mensile
              created_at: new Date(),
            };

            const validated = validateAgentAction(actionData);
            if (validated) {
              const actionRef = adminDb.collection('agent_actions').doc();
              await actionRef.set(validated);
              logAdmin(`[API] Alert salvato in agent_actions`);
            }
          } catch (error: any) {
            logAdmin(`[API] Errore salvataggio alert: ${error.message}`);
          }
        }
      }

      // Alert se qualche competitor specifico ha prezzo molto più basso
      for (const competitor of competitors) {
        const competitorPrice = safeNumber(competitor.price);
        const yourPrice = safeNumber(currentPrice);
        if (yourPrice > 0 && competitorPrice < yourPrice * 0.9) {
          const competitorDiff = calculateChangePercent(yourPrice, competitorPrice);
          alerts.push({
            type: 'specific_competitor_lower',
            severity: 'medium',
            message: `${competitor.hotel_name} ha un prezzo del ${competitorDiff.toFixed(1)}% più basso (€${competitorPrice.toFixed(2)} vs tuo €${yourPrice.toFixed(2)})`,
            competitor: competitor.hotel_name,
            competitorPrice: competitorPrice,
            yourPrice: yourPrice,
          });
        }
      }
    }

    return NextResponse.json({
      competitors,
      stats,
      alerts,
      cached: isCached && !shouldRefreshCache,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore competitor prices: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
