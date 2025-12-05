// Servizio scraping competitor prices
// Gestisce scraping Booking.com e caching in Firestore

import { adminDb } from '../firebase-admin';
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
   * Scrapa prezzi competitor da Booking.com
   * Nota: In produzione, usa Puppeteer/Playwright o API ufficiale
   * Per ora, simula con dati mock per sviluppo
   */
  async scrapeBookingPrices(
    location: string,
    checkinDate: Date,
    checkoutDate: Date,
    hotelId: string
  ): Promise<CompetitorPrice[]> {
    try {
      logAdmin(`[Scraper] Inizio scraping competitor per ${location}`, { location, checkinDate, checkoutDate });

      // TODO: Implementare scraping reale con Puppeteer/Playwright
      // Per ora, usa dati mock per sviluppo
      const mockCompetitors: CompetitorPrice[] = [
        { hotel_name: 'Hotel Riviera', price: 120, rating: 4.2, availability: true },
        { hotel_name: 'Grand Hotel Cattolica', price: 150, rating: 4.5, availability: true },
        { hotel_name: 'Hotel Adriatico', price: 100, rating: 4.0, availability: true },
      ];

      // Salva in cache
      await this.saveToCache(hotelId, location, checkinDate, checkoutDate, mockCompetitors);

      logAdmin(`[Scraper] Scraping completato: ${mockCompetitors.length} competitor trovati`);
      return mockCompetitors;

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
      minPrice,
      maxPrice,
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
    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
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
