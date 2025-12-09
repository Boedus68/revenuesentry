import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { logAdmin } from '@/lib/admin-log';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * VERCEL CRON JOB - Scraping Notturno Competitors
 * 
 * Trigger: Ogni giorno alle 03:00 AM UTC
 * Configurazione: vercel.json
 * 
 * Questo endpoint:
 * 1. Scrapa tutti i competitor attivi per tutti gli hotel
 * 2. Salva i prezzi in Firestore (competitor_data)
 * 3. Supporta scraping multi-data (1-30 giorni futuri)
 */
export async function GET(request: NextRequest) {
  try {
    // ⚠️ SECURITY: Verifica che sia chiamata da Vercel Cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      logAdmin('[CRON] ⚠️ CRON_SECRET non configurato - endpoint disabilitato per sicurezza');
      return NextResponse.json(
        { error: 'CRON_SECRET non configurato' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logAdmin('[CRON] ❌ Unauthorized - header Authorization non valido');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logAdmin('[CRON] ✅ Inizio scraping notturno competitors');
    const startTime = Date.now();

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin('[CRON] ❌ Firebase Admin non inizializzato');
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato' },
        { status: 500 }
      );
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
      hotelsProcessed: 0,
      competitorsProcessed: 0
    };

    // Calcola date per domani (check-in = domani, check-out = dopodomani)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkIn = tomorrow.toISOString().split('T')[0];
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const checkOut = dayAfter.toISOString().split('T')[0];

    logAdmin('[CRON] Date calcolate', { checkIn, checkOut });

    // Ottieni tutti gli hotel con competitor configurati
    const hotelsSnapshot = await adminDb.collection('users').get();
    logAdmin('[CRON] Hotel trovati', { count: hotelsSnapshot.size });

    for (const hotelDoc of hotelsSnapshot.docs) {
      const userId = hotelDoc.id;
      logAdmin('[CRON] Processing hotel', { userId });

      // Ottieni competitors per questo hotel
      const competitorsSnapshot = await adminDb
        .collection('competitor_configs')
        .where('hotelId', '==', userId)
        .where('isActive', '==', true)
        .get();

      if (competitorsSnapshot.empty) {
        logAdmin('[CRON] No competitors configured', { userId });
        continue;
      }

      results.hotelsProcessed++;

      // Scrape ogni competitor
      for (const competitorDoc of competitorsSnapshot.docs) {
        const competitor = competitorDoc.data();
        results.total++;
        results.competitorsProcessed++;

        try {
          const competitorName = competitor.competitor_name || competitor.name || 'N/D';
          const bookingUrl = competitor.bookingUrl || competitor.url;
          const boardType = competitor.boardType || 'breakfast';

          if (!bookingUrl) {
            results.failed++;
            results.errors.push(`${competitorName}: URL mancante`);
            logAdmin('[CRON] ⚠️ Competitor senza URL', { competitorName });
            continue;
          }

          logAdmin('[CRON] Scraping competitor', {
            competitorId: competitorDoc.id,
            competitorName,
            url: bookingUrl,
            boardType
          });

          // Chiamata scraper Booking.com con timeout di 40 secondi
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://revenuesentry.vercel.app';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout
          
          let scrapingResponse;
          try {
            scrapingResponse = await fetch(
              `${appUrl}/api/scraper/booking`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingUrl,
                  checkInDate: checkIn,
                  checkOutDate: checkOut,
                  boardType
                }),
                signal: controller.signal
              }
            );
          } finally {
            clearTimeout(timeoutId);
          }

          if (scrapingResponse.ok) {
            const scrapingData = await scrapingResponse.json();
            
            if (scrapingData.price && scrapingData.success) {
              // Salva prezzo nel DB usando l'endpoint POST competitor-prices
              const saveResponse = await fetch(
                `${appUrl}/api/scraper/competitor-prices`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    hotelId: userId,
                    competitorId: competitorDoc.id,
                    competitor_name: competitorName,
                    price: scrapingData.price,
                    date: checkIn,
                    roomType: scrapingData.roomType || 'Standard',
                    boardType: scrapingData.boardType || boardType,
                    source: 'cron_scraper'
                  })
                }
              );

              if (saveResponse.ok) {
                results.success++;
                logAdmin('[CRON] ✅ Prezzo salvato', {
                  competitorName,
                  price: scrapingData.price,
                  date: checkIn
                });
              } else {
                const saveError = await saveResponse.text();
                results.failed++;
                results.errors.push(`${competitorName}: Errore salvataggio (${saveResponse.status})`);
                logAdmin('[CRON] ❌ Errore salvataggio prezzo', {
                  competitorName,
                  status: saveResponse.status,
                  error: saveError
                });
              }
            } else {
              results.failed++;
              results.errors.push(`${competitorName}: No price found`);
              logAdmin('[CRON] ⚠️ Nessun prezzo trovato', { competitorName });
            }
          } else {
            const errorText = await scrapingResponse.text();
            results.failed++;
            results.errors.push(`${competitorName}: Scraping failed (${scrapingResponse.status})`);
            logAdmin('[CRON] ❌ Scraping fallito', {
              competitorName,
              status: scrapingResponse.status,
              error: errorText.substring(0, 200)
            });
          }
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          const competitorName = competitor.competitor_name || competitor.name || 'N/D';
          results.errors.push(`${competitorName}: ${errorMsg}`);
          logAdmin('[CRON] ❌ Error scraping competitor', {
            competitorName,
            error: errorMsg
          });
        }

        // Sleep 2s tra ogni competitor per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const duration = Date.now() - startTime;
    const durationSeconds = Math.round(duration / 1000);

    logAdmin('[CRON] ✅ Scraping completato', {
      ...results,
      durationMs: duration,
      durationSeconds
    });

    return NextResponse.json({
      success: true,
      results,
      durationMs: duration,
      durationSeconds,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logAdmin('[CRON] ❌ Fatal error', { error: errorMsg });
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMsg
      },
      { status: 500 }
    );
  }
}

