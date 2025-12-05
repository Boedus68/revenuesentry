// API endpoint per scraping competitor prices
import { NextRequest, NextResponse } from 'next/server';
import { CompetitorScraper } from '../../../../lib/services/scraper-service';
import { adminDb } from '../../../../lib/firebase-admin';
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

    // Verifica cache prima di scrapare
    const isCached = await scraper.isCached(hotelId, checkin);
    
    let competitors;
    if (isCached) {
      logAdmin(`[API] Usando dati cached`);
      // Recupera da cache
      const cached = await scraper.getFromCache(hotelId, location, checkin);
      competitors = cached?.map(c => ({
        hotel_name: c.competitor_name,
        price: c.price,
        rating: c.rating,
        availability: c.availability,
      })) || [];
    } else {
      // Scrapa nuovi dati
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
            if (validated && adminDb) {
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
            message: `${competitor.hotel_name} ha un prezzo del ${competitorDiff.toFixed(1)}% più basso (€${competitor.price} vs tuo €${currentPrice})`,
            competitor: competitor.hotel_name,
            competitorPrice: competitor.price,
            yourPrice: currentPrice,
          });
        }
      }
    }

    return NextResponse.json({
      competitors,
      stats,
      alerts,
      cached: isCached,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore competitor prices: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
