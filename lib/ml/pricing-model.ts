// Pricing Model ML per Dynamic Pricing
// FASE 2: Dynamic Pricing Agent

import { HistoricalData } from '../types';

export interface PriceRecommendation {
  date: string;
  currentPrice: number;
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number; // 0-1
  reasoning: string;
  factors: {
    demandLevel: 'high' | 'medium' | 'low';
    competitorPrice: number;
    competitorAvgPrice: number;
    seasonalityFactor: number;
    occupancyTrend: 'increasing' | 'stable' | 'decreasing';
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
  };
}

export interface PricingFactors {
  basePrice: number;
  competitorPrice: number;
  competitorAvgPrice: number;
  competitorMinPrice: number;
  competitorMaxPrice: number;
  demandLevel: number; // 0-1, basato su occupazione storica
  seasonalityFactor: number; // 0.8-1.2
  dayOfWeek: number; // 0-6
  isWeekend: boolean;
  isHoliday: boolean;
  occupancyTrend: number; // -1 to 1
  weatherScore?: number; // 0-1
  eventImpactScore?: number; // 0-1
}

export class PricingModel {
  /**
   * Calcola livello di domanda basato su occupazione storica
   */
  private calculateDemandLevel(
    historicalData: HistoricalData[],
    date: Date
  ): number {
    if (historicalData.length === 0) return 0.5; // Default medio

    // Filtra dati storici per stesso giorno settimana e periodo simile
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    
    const similarDays = historicalData.filter(d => {
      const dDate = new Date(d.date);
      return (
        dDate.getDay() === dayOfWeek &&
        Math.abs(dDate.getMonth() - month) <= 1 // Stesso mese o adiacente
      );
    });

    if (similarDays.length === 0) {
      // Fallback: media generale
      const avgOccupancy = historicalData.reduce(
        (sum, d) => sum + (d.occupancy_rate || 0),
        0
      ) / historicalData.length;
      return avgOccupancy / 100; // Normalizza 0-1
    }

    // Media occupazione per giorni simili
    const avgOccupancy = similarDays.reduce(
      (sum, d) => sum + (d.occupancy_rate || 0),
      0
    ) / similarDays.length;

    return Math.min(1, Math.max(0, avgOccupancy / 100));
  }

  /**
   * Calcola fattore stagionalità basato su mese
   */
  private calculateSeasonalityFactor(date: Date): number {
    const month = date.getMonth(); // 0-11
    
    // Fattori stagionali per hotel italiani (esempio)
    // Estate (giugno-agosto): alta stagione
    // Inverno (dicembre-febbraio): bassa stagione per hotel balneari
    const seasonalityMap: { [key: number]: number } = {
      0: 0.85,  // Gennaio - bassa
      1: 0.80,  // Febbraio - bassa
      2: 0.90,  // Marzo - media-bassa
      3: 1.00,  // Aprile - media
      4: 1.05,  // Maggio - media-alta
      5: 1.15,  // Giugno - alta
      6: 1.20,  // Luglio - alta
      7: 1.20,  // Agosto - alta
      8: 1.10,  // Settembre - media-alta
      9: 1.00,  // Ottobre - media
      10: 0.90, // Novembre - media-bassa
      11: 0.85, // Dicembre - bassa
    };

    return seasonalityMap[month] || 1.0;
  }

  /**
   * Calcola trend occupazione (incremento/decremento)
   */
  private calculateOccupancyTrend(historicalData: HistoricalData[]): number {
    if (historicalData.length < 14) return 0; // Non abbastanza dati

    // Ordina per data
    const sorted = [...historicalData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Ultimi 7 giorni vs precedenti 7 giorni
    const recent7 = sorted.slice(-7);
    const previous7 = sorted.slice(-14, -7);

    if (previous7.length === 0) return 0;

    const recentAvg = recent7.reduce(
      (sum, d) => sum + (d.occupancy_rate || 0),
      0
    ) / recent7.length;

    const previousAvg = previous7.reduce(
      (sum, d) => sum + (d.occupancy_rate || 0),
      0
    ) / previous7.length;

    // Normalizza tra -1 e 1
    const diff = recentAvg - previousAvg;
    return Math.max(-1, Math.min(1, diff / 100));
  }

  /**
   * Estrae fattori di pricing da dati storici e contesto
   */
  extractPricingFactors(
    historicalData: HistoricalData[],
    date: Date,
    basePrice: number
  ): PricingFactors {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Ultimi dati storici per competitor prices
    const recentData = historicalData
      .filter(d => new Date(d.date) <= date)
      .slice(-30); // Ultimi 30 giorni

    const competitorPrice = recentData.length > 0
      ? recentData[recentData.length - 1].competitor_avg_price || basePrice
      : basePrice;

    const competitorAvgPrice = recentData.length > 0
      ? recentData.reduce(
          (sum, d) => sum + (d.competitor_avg_price || basePrice),
          0
        ) / recentData.length
      : basePrice;

    const competitorMinPrice = recentData.length > 0
      ? Math.min(...recentData.map(d => d.competitor_min_price || basePrice))
      : basePrice;

    const competitorMaxPrice = recentData.length > 0
      ? Math.max(...recentData.map(d => d.competitor_max_price || basePrice))
      : basePrice;

    const demandLevel = this.calculateDemandLevel(historicalData, date);
    const seasonalityFactor = this.calculateSeasonalityFactor(date);
    const occupancyTrend = this.calculateOccupancyTrend(historicalData);

    // Weather e event impact dall'ultimo dato storico disponibile
    const lastData = recentData[recentData.length - 1];
    const weatherScore = lastData?.weather_score;
    const eventImpactScore = lastData?.event_impact_score;

    return {
      basePrice,
      competitorPrice,
      competitorAvgPrice,
      competitorMinPrice,
      competitorMaxPrice,
      demandLevel,
      seasonalityFactor,
      dayOfWeek,
      isWeekend,
      isHoliday: false, // TODO: implementare logica festività
      occupancyTrend,
      weatherScore,
      eventImpactScore,
    };
  }

  /**
   * Calcola prezzo raccomandato basato su fattori
   */
  calculateRecommendedPrice(factors: PricingFactors): number {
    let price = factors.basePrice;

    // 1. Aggiusta per competitor pricing (peso 30%)
    const competitorDiff = factors.competitorAvgPrice - factors.basePrice;
    price += competitorDiff * 0.3;

    // 2. Aggiusta per domanda (peso 25%)
    // Alta domanda = aumenta prezzo, bassa domanda = diminuisci
    const demandAdjustment = (factors.demandLevel - 0.5) * 0.25; // -0.125 to +0.125
    price *= (1 + demandAdjustment);

    // 3. Aggiusta per stagionalità (peso 20%)
    price *= factors.seasonalityFactor * 0.2 + 0.8; // Mix con base

    // 4. Aggiusta per weekend (peso 10%)
    if (factors.isWeekend) {
      price *= 1.1; // +10% weekend
    }

    // 5. Aggiusta per trend occupazione (peso 10%)
    if (factors.occupancyTrend > 0.1) {
      // Trend positivo = aumenta prezzo
      price *= (1 + factors.occupancyTrend * 0.1);
    } else if (factors.occupancyTrend < -0.1) {
      // Trend negativo = diminuisci prezzo
      price *= (1 + factors.occupancyTrend * 0.1);
    }

    // 6. Aggiusta per weather (peso 5%)
    if (factors.weatherScore !== undefined) {
      // Buon tempo = aumenta prezzo leggermente
      price *= (1 + (factors.weatherScore - 0.5) * 0.05);
    }

    // 7. Limita tra min e max competitor
    const minPrice = Math.max(
      factors.basePrice * 0.7, // Minimo 70% del prezzo base
      factors.competitorMinPrice * 0.9 // O 90% del competitor più basso
    );
    const maxPrice = Math.min(
      factors.basePrice * 1.5, // Massimo 150% del prezzo base
      factors.competitorMaxPrice * 1.1 // O 110% del competitor più alto
    );

    price = Math.max(minPrice, Math.min(maxPrice, price));

    return Math.round(price * 100) / 100; // Arrotonda a 2 decimali
  }

  /**
   * Genera raccomandazione di prezzo completa
   */
  recommendPrice(
    historicalData: HistoricalData[],
    date: Date,
    currentPrice: number
  ): PriceRecommendation {
    const factors = this.extractPricingFactors(
      historicalData,
      date,
      currentPrice
    );

    const recommendedPrice = this.calculateRecommendedPrice(factors);

    // Calcola confidence basata su quantità dati disponibili
    const dataPoints = historicalData.filter(
      d => new Date(d.date) <= date
    ).length;
    const confidence = Math.min(1, dataPoints / 30); // Max confidence con 30+ giorni di dati

    // Determina livello domanda
    const demandLevel: 'high' | 'medium' | 'low' =
      factors.demandLevel > 0.7 ? 'high' :
      factors.demandLevel > 0.4 ? 'medium' : 'low';

    // Determina trend occupazione
    const occupancyTrend: 'increasing' | 'stable' | 'decreasing' =
      factors.occupancyTrend > 0.1 ? 'increasing' :
      factors.occupancyTrend < -0.1 ? 'decreasing' : 'stable';

    // Genera reasoning
    const reasoning = this.generateReasoning(factors, recommendedPrice, currentPrice);

    // Calcola min/max price range
    const priceDiff = Math.abs(recommendedPrice - currentPrice);
    const minPrice = Math.max(
      factors.competitorMinPrice * 0.9,
      recommendedPrice - priceDiff * 0.5
    );
    const maxPrice = Math.min(
      factors.competitorMaxPrice * 1.1,
      recommendedPrice + priceDiff * 0.5
    );

    return {
      date: date.toISOString().split('T')[0],
      currentPrice,
      recommendedPrice,
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      confidence,
      reasoning,
      factors: {
        demandLevel,
        competitorPrice: factors.competitorPrice,
        competitorAvgPrice: factors.competitorAvgPrice,
        seasonalityFactor: factors.seasonalityFactor,
        occupancyTrend,
        dayOfWeek: factors.dayOfWeek,
        isWeekend: factors.isWeekend,
        isHoliday: factors.isHoliday,
      },
    };
  }

  /**
   * Genera spiegazione testuale della raccomandazione
   */
  private generateReasoning(
    factors: PricingFactors,
    recommendedPrice: number,
    currentPrice: number
  ): string {
    const priceDiff = recommendedPrice - currentPrice;
    const percentDiff = ((priceDiff / currentPrice) * 100).toFixed(1);
    
    const reasons: string[] = [];

    if (Math.abs(priceDiff) < 1) {
      reasons.push('Il prezzo attuale è già ottimale.');
    } else if (priceDiff > 0) {
      reasons.push(`Aumento suggerito del ${percentDiff}%`);
    } else {
      reasons.push(`Riduzione suggerita del ${Math.abs(parseFloat(percentDiff))}%`);
    }

    // Aggiungi ragioni specifiche
    if (factors.demandLevel > 0.7) {
      reasons.push('Alta domanda prevista');
    } else if (factors.demandLevel < 0.4) {
      reasons.push('Bassa domanda prevista');
    }

    if (factors.seasonalityFactor > 1.1) {
      reasons.push('Periodo di alta stagione');
    } else if (factors.seasonalityFactor < 0.9) {
      reasons.push('Periodo di bassa stagione');
    }

    if (factors.isWeekend) {
      reasons.push('Giorno weekend');
    }

    if (factors.occupancyTrend > 0.1) {
      reasons.push('Trend occupazione in aumento');
    } else if (factors.occupancyTrend < -0.1) {
      reasons.push('Trend occupazione in calo');
    }

    const competitorDiff = factors.competitorAvgPrice - currentPrice;
    if (Math.abs(competitorDiff) > currentPrice * 0.1) {
      if (competitorDiff > 0) {
        reasons.push(`Competitor mediamente più alti del ${((competitorDiff / currentPrice) * 100).toFixed(0)}%`);
      } else {
        reasons.push(`Competitor mediamente più bassi del ${((Math.abs(competitorDiff) / currentPrice) * 100).toFixed(0)}%`);
      }
    }

    return reasons.join('. ') + '.';
  }
}
