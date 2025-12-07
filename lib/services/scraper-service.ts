// Servizio scraping competitor prices
// Gestisce scraping Booking.com e caching in Firestore

import { getAdminDb } from '../firebase-admin';
import { validateCompetitorData, getCompetitorDataDocId } from '../firestore-schemas';
import { CompetitorData } from '../types';
import { logAdmin } from '../admin-log';

export interface CompetitorPrice {
  hotel_name: string;
  price: number;
  rating?: number;
  availability?: boolean;
  room_type?: string;
}

export interface CompetitorStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  count: number;
}

export class CompetitorScraper {
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 ore in millisecondi

  /**
   * Recupera lista competitor configurati dall'utente
   */
  async getConfiguredCompetitors(hotelId: string): Promise<any[]> {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return [];
    }

    try {
      const snapshot = await adminDb
        .collection('competitor_configs')
        .where('hotelId', '==', hotelId)
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      logAdmin(`[Scraper] Errore recupero competitor configurati: ${error.message}`);
      return [];
    }
  }

  /**
   * Scrapa prezzi competitor da Booking.com
   * Usa i competitor configurati dall'utente se disponibili, altrimenti usa lista di default
   * Nota: In produzione, usa Puppeteer/Playwright o API ufficiale
   * Per ora, simula con dati mock per sviluppo
   * 
   * @param treatmentFilter - Filtro trattamento ('BB', 'FB', o null per tutti)
   *                          Quando 'FB', lo scraping dovrebbe usare il filtro Booking.com
   *                          "all meals included" nella URL di ricerca
   */
  async scrapeBookingPrices(
    location: string,
    checkinDate: Date,
    checkoutDate: Date,
    hotelId: string,
    treatmentFilter?: string
  ): Promise<CompetitorPrice[]> {
    try {
      logAdmin(`[Scraper] Inizio scraping competitor per ${location}`, { location, checkinDate, checkoutDate });

      // Recupera competitor configurati dall'utente
      const configuredCompetitors = await this.getConfiguredCompetitors(hotelId);
      
      let competitorsToScrape: CompetitorPrice[] = [];

      if (configuredCompetitors.length > 0) {
        // Usa competitor configurati dall'utente
        logAdmin(`[Scraper] Trovati ${configuredCompetitors.length} competitor configurati`);
        
        // TODO: Implementare scraping reale con Puppeteer/Playwright per ogni competitor configurato
        // Per ora, simula con dati mock basati sui competitor configurati
        competitorsToScrape = configuredCompetitors.map((comp: any) => ({
          hotel_name: comp.competitor_name,
          price: Math.round((100 + Math.random() * 50) * 100) / 100, // Mock: prezzo casuale tra 100-150, arrotondato a 2 decimali
          rating: 4.0 + Math.random() * 1.0, // Mock: rating tra 4.0-5.0
          availability: true,
          room_type: 'doppia', // Mock
        }));
      } else {
        // Fallback: usa lista di default (solo per sviluppo)
        logAdmin(`[Scraper] Nessun competitor configurato, uso lista default`);
        competitorsToScrape = [
          { hotel_name: 'Hotel Riviera', price: 120, rating: 4.2, availability: true },
          { hotel_name: 'Grand Hotel Cattolica', price: 150, rating: 4.5, availability: true },
          { hotel_name: 'Hotel Adriatico', price: 100, rating: 4.0, availability: true },
        ];
      }

      // Salva in cache
      await this.saveToCache(hotelId, location, checkinDate, checkoutDate, competitorsToScrape);

      logAdmin(`[Scraper] Scraping completato: ${competitorsToScrape.length} competitor trovati`);
      return competitorsToScrape;

    } catch (error: any) {
      logAdmin(`[Scraper] Errore durante scraping: ${error.message}`, { error: error.stack });
      
      // Fallback: prova a recuperare dati cached
      const cached = await this.getFromCache(hotelId, location, checkinDate);
      if (cached && cached.length > 0) {
        logAdmin(`[Scraper] Usando dati cached come fallback`);
        return cached.map(c => ({
          hotel_name: c.competitor_name,
          price: c.price,
          rating: c.rating,
          availability: c.availability,
        }));
      }

      throw new Error(`Scraping fallito e nessun dato cached disponibile: ${error.message}`);
    }
  }

  /**
   * Calcola statistiche sui prezzi competitor
   */
  getCompetitorStats(data: CompetitorPrice[]): CompetitorStats {
    if (data.length === 0) {
      return {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        medianPrice: 0,
        count: 0,
      };
    }

    const prices = data.map(c => c.price).sort((a, b) => a - b);
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avgPrice = sum / prices.length;
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];
    
    // Calcola mediana
    const mid = Math.floor(prices.length / 2);
    const medianPrice = prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];

    return {
      avgPrice: Math.round(avgPrice * 100) / 100,
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      medianPrice: Math.round(medianPrice * 100) / 100,
      count: data.length,
    };
  }

  /**
   * Salva dati competitor in Firestore con cache TTL
   */
  private async saveToCache(
    hotelId: string,
    location: string,
    checkinDate: Date,
    checkoutDate: Date,
    competitors: CompetitorPrice[]
  ): Promise<void> {
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.');
    }

    try {
      const dateStr = checkinDate.toISOString().split('T')[0];
      const cacheExpiry = new Date(Date.now() + this.cacheTTL);

      const batch = adminDb.batch();

      for (const competitor of competitors) {
        const docId = getCompetitorDataDocId(hotelId, competitor.hotel_name, dateStr);
        const docRef = adminDb.collection('competitor_data').doc(docId);

        const competitorData: Partial<CompetitorData> = {
          hotelId,
          competitor_name: competitor.hotel_name,
          location,
          date: dateStr,
          price: competitor.price,
          rating: competitor.rating,
          availability: competitor.availability,
          room_type: competitor.room_type,
          scraped_at: new Date(),
          cache_ttl: cacheExpiry,
        };

        const validated = validateCompetitorData(competitorData);
        if (validated) {
          batch.set(docRef, validated, { merge: true });
        }
      }

      await batch.commit();
      logAdmin(`[Scraper] Dati salvati in cache per ${competitors.length} competitor`);

    } catch (error: any) {
      logAdmin(`[Scraper] Errore salvataggio cache: ${error.message}`, { error: error.stack });
      throw error;
    }
  }

  /**
   * Recupera dati competitor dalla cache se ancora validi
   */
  async getFromCache(
    hotelId: string,
    location: string,
    checkinDate: Date
  ): Promise<CompetitorData[] | null> {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return null;
    }

    try {
      const dateStr = checkinDate.toISOString().split('T')[0];
      const now = new Date();

      // Query competitor_data per hotelId e date
      const snapshot = await adminDb
        .collection('competitor_data')
        .where('hotelId', '==', hotelId)
        .where('date', '==', dateStr)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const cached: CompetitorData[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data() as CompetitorData;
        
        // Verifica se cache è ancora valida
        if (data.cache_ttl) {
          const expiry = data.cache_ttl.toDate ? data.cache_ttl.toDate() : new Date(data.cache_ttl);
          if (expiry < now) {
            // Cache scaduta, ignora
            continue;
          }
        }

        cached.push(data);
      }

      return cached.length > 0 ? cached : null;

    } catch (error: any) {
      logAdmin(`[Scraper] Errore recupero cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica se dati sono in cache e ancora validi
   */
  async isCached(hotelId: string, checkinDate: Date): Promise<boolean> {
    const cached = await this.getFromCache(hotelId, '', checkinDate);
    return cached !== null && cached.length > 0;
  }
}
