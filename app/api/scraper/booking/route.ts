import { NextRequest, NextResponse } from 'next/server';

// Import condizionale per Vercel (produzione) vs sviluppo locale
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

let puppeteer: any;
let chromium: any;

if (isProduction) {
  // Su Vercel, usa puppeteer-core con @sparticuz/chromium
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  // In sviluppo locale, usa puppeteer normale (include Chrome)
  puppeteer = require('puppeteer');
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
  let browser = null;
  
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

    // Configurazione per Vercel (produzione) vs sviluppo locale
    let launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ],
    };

    // Su Vercel, usa @sparticuz/chromium
    if (isProduction && chromium && typeof chromium.executablePath === 'function') {
      try {
        launchOptions.executablePath = await chromium.executablePath();
        if (chromium.args && Array.isArray(chromium.args)) {
          launchOptions.args = [
            ...chromium.args,
            '--hide-scrollbars',
            '--disable-web-security',
            '--window-size=1920x1080',
          ];
        }
      } catch (error: any) {
        console.error('[Booking Scraper] Errore configurazione chromium:', error?.message || error);
        // Fallback: usa args standard senza chromium
      }
    }

    browser = await puppeteer.launch(launchOptions);

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

    await browser.close();

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
    
    if (browser) {
      await browser.close();
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

