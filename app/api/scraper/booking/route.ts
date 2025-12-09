import { NextRequest, NextResponse } from 'next/server';

// Browserless.io configuration
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

let puppeteer: any;

// In produzione usa Browserless, in sviluppo locale usa puppeteer normale
if (isProduction) {
  // Su Vercel, usa puppeteer-core per connettersi a Browserless
  puppeteer = require('puppeteer-core');
} else {
  // In sviluppo locale, usa puppeteer normale (include Chrome)
  // Oppure Browserless se BROWSERLESS_API_KEY è configurata
  if (BROWSERLESS_API_KEY) {
    puppeteer = require('puppeteer-core');
  } else {
    puppeteer = require('puppeteer');
  }
}

/**
 * Configura la connessione a Browserless.io
 * In produzione usa sempre Browserless, in sviluppo locale solo se BROWSERLESS_API_KEY è presente
 */
async function setupBrowser() {
  // In produzione, Browserless è obbligatorio
  if (isProduction) {
    if (!BROWSERLESS_API_KEY || BROWSERLESS_API_KEY.trim() === '') {
      throw new Error(
        'BROWSERLESS_API_KEY non configurata. ' +
        'Registrati su https://www.browserless.io/ e aggiungi la chiave su Vercel → Settings → Environment Variables'
      );
    }
  } else {
    // In sviluppo locale, Browserless è opzionale
    if (!BROWSERLESS_API_KEY || BROWSERLESS_API_KEY.trim() === '') {
      // Usa puppeteer locale
      return null;
    }
  }

  // Browserless WebSocket endpoint
  const browserWSEndpoint = `wss://chrome.browserless.io?token=${BROWSERLESS_API_KEY}`;
  
  console.log('[Booking Scraper] Connessione a Browserless cloud...');
  
  return {
    browserWSEndpoint,
    headless: true,
  };
}

interface ScrapingRequest {
  bookingUrl: string;
  checkInDate: string;
  checkOutDate: string;
  boardType: 'room_only' | 'breakfast' | 'half_board' | 'full_board' | 'all_inclusive' | 'any';
  adults?: number;
  children?: number;
}

export async function POST(request: NextRequest) {
  let browser: any = null;
  let isBrowserless = false;
  
  try {
    const body: ScrapingRequest = await request.json();
    const { bookingUrl, checkInDate, checkOutDate, boardType, adults = 2, children = 0 } = body;

    console.log('[Booking Scraper] Inizio scraping:', {
      url: bookingUrl,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      boardType,
    });

    if (!bookingUrl || !checkInDate || !checkOutDate) {
      return NextResponse.json(
        { success: false, error: 'URL, checkInDate e checkOutDate sono obbligatori' },
        { status: 400 }
      );
    }

    const checkInDateObj = new Date(checkInDate);
    const checkOutDateObj = new Date(checkOutDate);
    
    if (isNaN(checkInDateObj.getTime()) || isNaN(checkOutDateObj.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Formato date non valido' },
        { status: 400 }
      );
    }

    if (checkOutDateObj <= checkInDateObj) {
      return NextResponse.json(
        { success: false, error: 'Check-out deve essere dopo check-in' },
        { status: 400 }
      );
    }

    const url = buildBookingUrl(bookingUrl, checkInDate, checkOutDate, adults, children);
    
    console.log('[Booking Scraper] URL costruito:', url);

    // Configura browser: Browserless (produzione o se configurato) vs locale (sviluppo)
    const browserConfig = await setupBrowser();
    
    if (browserConfig) {
      // Usa Browserless cloud
      isBrowserless = true;
      console.log('[Booking Scraper] Connessione a Browserless...');
      browser = await puppeteer.connect({
        browserWSEndpoint: browserConfig.browserWSEndpoint,
      });
      console.log('[Booking Scraper] Browserless connesso con successo!');
    } else {
      // Usa browser locale (solo sviluppo)
      isBrowserless = false;
      console.log('[Booking Scraper] Avvio browser locale...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });
      console.log('[Booking Scraper] Browser locale avviato');
    }

    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    console.log('[Booking Scraper] Navigazione in corso...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    try {
      await page.waitForSelector('button[id*="onetrust-accept"]', { timeout: 3000 });
      await page.click('button[id*="onetrust-accept"]');
      console.log('[Booking Scraper] Cookie banner accettato');
    } catch (e) {
      console.log('[Booking Scraper] Nessun cookie banner trovato');
    }

    console.log('[Booking Scraper] Attendo caricamento prezzi...');
    
    // Prova a trovare i prezzi con selettori multipli
    let priceFound = false;
    const pageSelectors = [
      '[data-testid="price-and-discounted-price"]',
      '.prco-valign-middle-helper',
      '.bui-price-display__value',
      '[data-testid="property-card-price"]',
      '.bui-price-display',
      '.hprt-price-price',
    ];
    
    for (const selector of pageSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        priceFound = true;
        console.log(`[Booking Scraper] Trovato selettore: ${selector}`);
        break;
      } catch (e) {
        // Prova il prossimo selettore
        continue;
      }
    }
    
    if (!priceFound) {
      // Aspetta ancora un po' per il caricamento completo
      console.log('[Booking Scraper] Nessun selettore standard trovato, attendo caricamento completo...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const scrapedData = await page.evaluate((requestedBoardType: 'room_only' | 'breakfast' | 'half_board' | 'full_board' | 'all_inclusive' | 'any') => {
      const results: any[] = [];

      const priceSelectors = [
        '[data-testid="price-and-discounted-price"]',
        '.prco-valign-middle-helper',
        '.bui-price-display__value',
        '.prco-inline-block-maker-helper',
        '[data-testid="property-card-price"]',
        '.bui-price-display',
        '.hprt-price-price',
        '.prco-valign-helper',
      ];

      let priceElements: HTMLElement[] = [];
      for (const selector of priceSelectors) {
        const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        if (elements.length > 0) {
          priceElements = elements;
          break;
        }
      }

      console.log('Elementi prezzi trovati:', priceElements.length);

      priceElements.forEach((priceEl, index) => {
        try {
          const priceText = priceEl.textContent?.trim() || '';
          const priceMatch = priceText.match(/[\d.,]+/);
          
          if (!priceMatch) return;
          
          const price = parseFloat(priceMatch[0].replace(/\./g, '').replace(',', '.'));
          
          if (isNaN(price) || price <= 0) return;

          let parentRow = priceEl.closest('.hprt-table-room-row, [data-block-id*="room"]') as HTMLElement;
          if (!parentRow) {
            parentRow = priceEl.closest('tr, .room-info') as HTMLElement;
          }

          let roomType = 'Camera Standard';
          let detectedBoardType = 'room_only';

          if (parentRow) {
            const roomNameSelectors = [
              '.hprt-roomtype-icon-link',
              '[data-testid="title"]',
              '.room-name',
              'h3',
              '.hprt-roomtype-link',
            ];

            for (const selector of roomNameSelectors) {
              const roomNameEl = parentRow.querySelector(selector);
              if (roomNameEl?.textContent) {
                roomType = roomNameEl.textContent.trim();
                break;
              }
            }

            const mealText = parentRow.textContent?.toLowerCase() || '';
            
            if (mealText.includes('pensione completa') || mealText.includes('full board')) {
              detectedBoardType = 'full_board';
            } else if (mealText.includes('mezza pensione') || mealText.includes('half board')) {
              detectedBoardType = 'half_board';
            } else if (mealText.includes('colazione') || mealText.includes('breakfast')) {
              detectedBoardType = 'breakfast';
            } else if (mealText.includes('all inclusive') || mealText.includes('tutto incluso')) {
              detectedBoardType = 'all_inclusive';
            }
          }

          results.push({
            price,
            roomType,
            boardType: detectedBoardType,
            index,
          });
        } catch (err) {
          console.error('Errore parsing elemento prezzo:', err);
        }
      });

      let filteredResults = results;
      if (requestedBoardType && requestedBoardType !== 'any') {
        filteredResults = results.filter(r => r.boardType === requestedBoardType);
      }

      if (filteredResults.length === 0) {
        filteredResults = results;
      }

      return {
        allPrices: results,
        filteredPrices: filteredResults,
        bestPrice: filteredResults.length > 0 
          ? Math.min(...filteredResults.map(r => r.price))
          : (results.length > 0 ? Math.min(...results.map(r => r.price)) : null),
      };
    }, boardType);

    console.log('[Booking Scraper] Dati estratti:', scrapedData);

    // Chiudi browser: disconnect per Browserless, close per locale
    if (isBrowserless) {
      await browser.disconnect();
      console.log('[Booking Scraper] Browserless disconnesso');
    } else {
      await browser.close();
      console.log('[Booking Scraper] Browser locale chiuso');
    }

    if (!scrapedData.bestPrice) {
      console.log('[Booking Scraper] Nessun prezzo trovato, potrebbe essere non disponibile');
      return NextResponse.json({
        success: false,
        error: 'Nessun prezzo trovato - hotel potrebbe non essere disponibile per queste date',
        debug: {
          allPricesCount: scrapedData.allPrices?.length || 0,
          filteredPricesCount: scrapedData.filteredPrices?.length || 0,
        },
      }, { status: 404 });
    }

    const bestMatch = scrapedData.filteredPrices.length > 0
      ? scrapedData.filteredPrices.reduce((prev: any, curr: any) => 
          curr.price < prev.price ? curr : prev
        )
      : scrapedData.allPrices[0];

    return NextResponse.json({
      success: true,
      price: scrapedData.bestPrice,
      currency: 'EUR',
      roomType: bestMatch?.roomType || 'N/D',
      boardType: bestMatch?.boardType || boardType,
      availability: true,
      scrapedAt: new Date().toISOString(),
      allPrices: scrapedData.allPrices.map((p: any) => ({
        price: p.price,
        roomType: p.roomType,
        boardType: p.boardType,
      })),
    });

  } catch (error: any) {
    console.error('[Booking Scraper] Errore:', error);
    
    // Chiudi browser in caso di errore
    if (browser) {
      try {
        if (isBrowserless) {
          await browser.disconnect();
        } else {
          await browser.close();
        }
      } catch (closeError) {
        console.error('[Booking Scraper] Errore chiusura browser:', closeError);
      }
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante lo scraping',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

function buildBookingUrl(
  baseUrl: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
): string {
  try {
    const url = new URL(baseUrl);
    
    url.searchParams.delete('checkin');
    url.searchParams.delete('checkout');
    url.searchParams.delete('group_adults');
    url.searchParams.delete('group_children');
    url.searchParams.delete('no_rooms');

    url.searchParams.set('checkin', checkIn);
    url.searchParams.set('checkout', checkOut);
    url.searchParams.set('group_adults', adults.toString());
    url.searchParams.set('group_children', children.toString());
    url.searchParams.set('no_rooms', '1');
    url.searchParams.set('selected_currency', 'EUR');

    return url.toString();
  } catch (error) {
    console.error('[Booking Scraper] Errore costruzione URL:', error);
    return baseUrl;
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Booking Scraper API',
    status: 'ready',
    endpoints: {
      POST: 'Scrape price from Booking.com URL',
    },
    requiredFields: {
      bookingUrl: 'string',
      checkInDate: 'string (YYYY-MM-DD)',
      checkOutDate: 'string (YYYY-MM-DD)',
      boardType: 'room_only | breakfast | half_board | full_board | all_inclusive',
      adults: 'number (optional, default: 2)',
      children: 'number (optional, default: 0)',
    },
  });
}

