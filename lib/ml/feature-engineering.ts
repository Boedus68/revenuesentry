// Feature Engineering per ML Models
// Estrae e prepara features da dati storici per modelli ML

import { HistoricalData } from '../types';

export interface MLFeatures {
  // Features temporali
  dayOfWeek: number; // 0-6
  month: number; // 1-12
  dayOfMonth: number; // 1-31
  isWeekend: number; // 0 o 1
  isHoliday: number; // 0 o 1
  dayOfYear: number; // 1-365
  
  // Features stagionali
  seasonalityFactor: number; // 0.8-1.2
  isHighSeason: number; // 0 o 1
  isLowSeason: number; // 0 o 1
  
  // Features storiche (media mobile)
  avgOccupancy7d: number; // Media occupazione ultimi 7 giorni
  avgOccupancy30d: number; // Media occupazione ultimi 30 giorni
  avgADR7d: number; // Media ADR ultimi 7 giorni
  avgADR30d: number; // Media ADR ultimi 30 giorni
  avgRevPAR7d: number; // Media RevPAR ultimi 7 giorni
  avgRevPAR30d: number; // Media RevPAR ultimi 30 giorni
  
  // Features trend
  occupancyTrend7d: number; // Trend occupazione (differenza media ultimi 7 vs precedenti 7)
  occupancyTrend30d: number; // Trend occupazione (differenza media ultimi 30 vs precedenti 30)
  adrTrend7d: number; // Trend ADR
  adrTrend30d: number; // Trend ADR
  
  // Features competitor
  competitorAvgPrice: number;
  competitorMinPrice: number;
  competitorMaxPrice: number;
  competitorPriceSpread: number; // max - min
  marketPosition: number; // Posizione rispetto a competitor (0-1, dove 0 = più basso, 1 = più alto)
  
  // Features esterne
  weatherScore: number; // 0-1
  eventImpactScore: number; // 0-1
  
  // Features lag (valori precedenti)
  lagOccupancy1d: number; // Occupazione giorno precedente
  lagOccupancy7d: number; // Occupazione 7 giorni fa
  lagADR1d: number; // ADR giorno precedente
  lagADR7d: number; // ADR 7 giorni fa
  
  // Features derivate
  demandLevel: number; // 0-1, basato su occupazione storica
  priceElasticity: number; // Stima elasticità prezzo (basata su correlazione storico)
}

export class FeatureEngineer {
  /**
   * Calcola media mobile
   */
  private calculateMovingAverage(data: number[], windowSize: number): number {
    if (data.length === 0) return 0;
    if (windowSize > data.length) {
      return data.reduce((sum, val) => sum + val, 0) / data.length;
    }
    
    const window = data.slice(-windowSize);
    return window.reduce((sum, val) => sum + val, 0) / window.length;
  }

  /**
   * Calcola trend (differenza tra due medie)
   */
  private calculateTrend(
    data: number[],
    recentWindow: number,
    previousWindow: number
  ): number {
    if (data.length < recentWindow + previousWindow) return 0;
    
    const recent = this.calculateMovingAverage(data, recentWindow);
    const previous = this.calculateMovingAverage(
      data.slice(0, -recentWindow),
      previousWindow
    );
    
    return recent - previous;
  }

  /**
   * Determina stagione basata su mese
   */
  private getSeasonalityFactor(month: number): {
    factor: number;
    isHigh: boolean;
    isLow: boolean;
  } {
    const seasonalityMap: { [key: number]: number } = {
      1: 0.85,  // Gennaio - bassa
      2: 0.80,  // Febbraio - bassa
      3: 0.90,  // Marzo - media-bassa
      4: 1.00,  // Aprile - media
      5: 1.05,  // Maggio - media-alta
      6: 1.15,  // Giugno - alta
      7: 1.20,  // Luglio - alta
      8: 1.20,  // Agosto - alta
      9: 1.10,  // Settembre - media-alta
      10: 1.00, // Ottobre - media
      11: 0.90, // Novembre - media-bassa
      12: 0.85, // Dicembre - bassa
    };

    const factor = seasonalityMap[month] || 1.0;
    return {
      factor,
      isHigh: factor >= 1.15,
      isLow: factor <= 0.85,
    };
  }

  /**
   * Calcola livello domanda basato su occupazione storica
   */
  private calculateDemandLevel(
    historicalData: HistoricalData[],
    date: Date
  ): number {
    if (historicalData.length === 0) return 0.5;

    const dayOfWeek = date.getDay();
    const month = date.getMonth() + 1; // 1-12
    
    const similarDays = historicalData.filter(d => {
      const dDate = new Date(d.date);
      return (
        dDate.getDay() === dayOfWeek &&
        Math.abs((dDate.getMonth() + 1) - month) <= 1
      );
    });

    if (similarDays.length === 0) {
      const avgOccupancy = historicalData.reduce(
        (sum, d) => sum + (d.occupancy_rate || 0),
        0
      ) / historicalData.length;
      return avgOccupancy / 100;
    }

    const avgOccupancy = similarDays.reduce(
      (sum, d) => sum + (d.occupancy_rate || 0),
      0
    ) / similarDays.length;

    return Math.min(1, Math.max(0, avgOccupancy / 100));
  }

  /**
   * Estrae features per una data specifica
   */
  extractFeatures(
    historicalData: HistoricalData[],
    targetDate: Date
  ): MLFeatures {
    // Ordina dati per data
    const sorted = [...historicalData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Filtra dati fino alla target date (esclusa)
    const dataUntilTarget = sorted.filter(
      d => new Date(d.date) < targetDate
    );

    // Features temporali
    const dayOfWeek = targetDate.getDay();
    const month = targetDate.getMonth() + 1;
    const dayOfMonth = targetDate.getDate();
    const dayOfYear = Math.floor(
      (targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
    const isHoliday = 0; // TODO: implementare logica festività

    // Features stagionali
    const seasonality = this.getSeasonalityFactor(month);
    const seasonalityFactor = seasonality.factor;
    const isHighSeason = seasonality.isHigh ? 1 : 0;
    const isLowSeason = seasonality.isLow ? 1 : 0;

    // Estrai array di valori storici
    const occupancies = dataUntilTarget.map(d => d.occupancy_rate || 0);
    const adrs = dataUntilTarget.map(d => d.adr || 0);
    const revpars = dataUntilTarget.map(d => d.revpar || 0);

    // Features storiche (media mobile)
    const avgOccupancy7d = this.calculateMovingAverage(occupancies, 7);
    const avgOccupancy30d = this.calculateMovingAverage(occupancies, 30);
    const avgADR7d = this.calculateMovingAverage(adrs, 7);
    const avgADR30d = this.calculateMovingAverage(adrs, 30);
    const avgRevPAR7d = this.calculateMovingAverage(revpars, 7);
    const avgRevPAR30d = this.calculateMovingAverage(revpars, 30);

    // Features trend
    const occupancyTrend7d = this.calculateTrend(occupancies, 7, 7);
    const occupancyTrend30d = this.calculateTrend(occupancies, 30, 30);
    const adrTrend7d = this.calculateTrend(adrs, 7, 7);
    const adrTrend30d = this.calculateTrend(adrs, 30, 30);

    // Features competitor (dall'ultimo dato disponibile)
    const recentData = dataUntilTarget.slice(-30);
    const competitorPrices = recentData
      .map(d => d.competitor_avg_price)
      .filter(p => p !== undefined && p > 0) as number[];

    const competitorAvgPrice = competitorPrices.length > 0
      ? competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length
      : 0;

    const competitorMinPrice = competitorPrices.length > 0
      ? Math.min(...competitorPrices)
      : 0;

    const competitorMaxPrice = competitorPrices.length > 0
      ? Math.max(...competitorPrices)
      : 0;

    const competitorPriceSpread = competitorMaxPrice - competitorMinPrice;

    // Market position (basato su ultimo ADR vs competitor avg)
    const lastADR = adrs.length > 0 ? adrs[adrs.length - 1] : 0;
    const marketPosition = competitorAvgPrice > 0
      ? Math.min(1, Math.max(0, lastADR / competitorAvgPrice))
      : 0.5;

    // Features esterne (dall'ultimo dato disponibile)
    const lastData = recentData[recentData.length - 1];
    const weatherScore = (lastData?.weather_score || 0) / 10; // Normalizza 0-1
    const eventImpactScore = (lastData?.event_impact_score || 0) / 10; // Normalizza 0-1

    // Features lag
    const lagOccupancy1d = occupancies.length > 0 ? occupancies[occupancies.length - 1] : 0;
    const lagOccupancy7d = occupancies.length >= 7 ? occupancies[occupancies.length - 7] : lagOccupancy1d;
    const lagADR1d = adrs.length > 0 ? adrs[adrs.length - 1] : 0;
    const lagADR7d = adrs.length >= 7 ? adrs[adrs.length - 7] : lagADR1d;

    // Features derivate
    const demandLevel = this.calculateDemandLevel(dataUntilTarget, targetDate);

    // Price elasticity (semplificato: correlazione tra variazioni prezzo e occupazione)
    // Calcola correlazione tra ADR e occupazione negli ultimi 30 giorni
    let priceElasticity = 0;
    if (adrs.length >= 7 && occupancies.length >= 7) {
      const recentADRs = adrs.slice(-7);
      const recentOccupancies = occupancies.slice(-7);
      
      const avgADR = recentADRs.reduce((sum, a) => sum + a, 0) / recentADRs.length;
      const avgOcc = recentOccupancies.reduce((sum, o) => sum + o, 0) / recentOccupancies.length;
      
      let covariance = 0;
      let adrVariance = 0;
      
      for (let i = 0; i < recentADRs.length; i++) {
        const adrDiff = recentADRs[i] - avgADR;
        const occDiff = recentOccupancies[i] - avgOcc;
        covariance += adrDiff * occDiff;
        adrVariance += adrDiff * adrDiff;
      }
      
      // Elasticità = -covariance / variance (negativo perché prezzo alto -> occupazione bassa)
      priceElasticity = adrVariance > 0 ? -covariance / adrVariance : 0;
      // Normalizza tra -1 e 1
      priceElasticity = Math.max(-1, Math.min(1, priceElasticity));
    }

    return {
      // Temporali
      dayOfWeek,
      month,
      dayOfMonth,
      isWeekend,
      isHoliday,
      dayOfYear,
      
      // Stagionali
      seasonalityFactor,
      isHighSeason,
      isLowSeason,
      
      // Storiche
      avgOccupancy7d: Math.round(avgOccupancy7d * 100) / 100,
      avgOccupancy30d: Math.round(avgOccupancy30d * 100) / 100,
      avgADR7d: Math.round(avgADR7d * 100) / 100,
      avgADR30d: Math.round(avgADR30d * 100) / 100,
      avgRevPAR7d: Math.round(avgRevPAR7d * 100) / 100,
      avgRevPAR30d: Math.round(avgRevPAR30d * 100) / 100,
      
      // Trend
      occupancyTrend7d: Math.round(occupancyTrend7d * 100) / 100,
      occupancyTrend30d: Math.round(occupancyTrend30d * 100) / 100,
      adrTrend7d: Math.round(adrTrend7d * 100) / 100,
      adrTrend30d: Math.round(adrTrend30d * 100) / 100,
      
      // Competitor
      competitorAvgPrice: Math.round(competitorAvgPrice * 100) / 100,
      competitorMinPrice: Math.round(competitorMinPrice * 100) / 100,
      competitorMaxPrice: Math.round(competitorMaxPrice * 100) / 100,
      competitorPriceSpread: Math.round(competitorPriceSpread * 100) / 100,
      marketPosition: Math.round(marketPosition * 100) / 100,
      
      // Esterne
      weatherScore: Math.round(weatherScore * 100) / 100,
      eventImpactScore: Math.round(eventImpactScore * 100) / 100,
      
      // Lag
      lagOccupancy1d: Math.round(lagOccupancy1d * 100) / 100,
      lagOccupancy7d: Math.round(lagOccupancy7d * 100) / 100,
      lagADR1d: Math.round(lagADR1d * 100) / 100,
      lagADR7d: Math.round(lagADR7d * 100) / 100,
      
      // Derivate
      demandLevel: Math.round(demandLevel * 100) / 100,
      priceElasticity: Math.round(priceElasticity * 100) / 100,
    };
  }

  /**
   * Estrae features per un range di date (batch)
   */
  extractFeaturesBatch(
    historicalData: HistoricalData[],
    startDate: Date,
    endDate: Date
  ): Map<string, MLFeatures> {
    const featuresMap = new Map<string, MLFeatures>();
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const features = this.extractFeatures(historicalData, new Date(currentDate));
      featuresMap.set(dateStr, features);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return featuresMap;
  }

  /**
   * Normalizza features per ML (0-1 scaling)
   */
  normalizeFeatures(features: MLFeatures, minMax: {
    [key: string]: { min: number; max: number };
  }): MLFeatures {
    const normalized: any = {};

    for (const [key, value] of Object.entries(features)) {
      const range = minMax[key];
      if (range && range.max !== range.min) {
        normalized[key] = (value - range.min) / (range.max - range.min);
      } else {
        normalized[key] = value;
      }
    }

    return normalized as MLFeatures;
  }
}
