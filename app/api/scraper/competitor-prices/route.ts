// API endpoint per scraping competitor prices
import { NextRequest, NextResponse } from 'next/server';
import { CompetitorScraper } from '../../../../lib/services/scraper-service';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { logAdmin } from '../../../../lib/admin-log';
import { AgentAction } from '../../../../lib/types';
import { validateAgentAction } from '../../../../lib/firestore-schemas';

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

    // Calcola statistiche
    const stats = scraper.getCompetitorStats(competitors);

    // Genera alert se competitor hanno abbassato prezzi significativamente
    const alerts: any[] = [];
    
    if (currentPrice && stats.avgPrice > 0) {
      const priceDifference = ((currentPrice - stats.avgPrice) / stats.avgPrice) * 100;
      
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
        if (currentPrice && competitor.price < currentPrice * 0.9) {
          const competitorDiff = ((currentPrice - competitor.price) / currentPrice) * 100;
          alerts.push({
            type: 'specific_competitor_lower',
            severity: 'medium',
            message: `${competitor.hotel_name} ha un prezzo del ${competitorDiff.toFixed(1)}% più basso (€${competitor.price.toFixed(2)} vs tuo €${currentPrice.toFixed(2)})`,
            competitor: competitor.hotel_name,
            competitorPrice: parseFloat(competitor.price.toFixed(2)),
            yourPrice: parseFloat(currentPrice.toFixed(2)),
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
