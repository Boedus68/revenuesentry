// Simple Revenue Forecaster usando media mobile
// Implementazione base per Quick Win 2

import { HistoricalData } from '../types';

export interface ForecastData {
  date: string;
  predictedRevenue: number;
  predictedOccupancy: number;
  confidence: number; // 0-1
}

export class SimpleForecast {
  /**
   * Calcola media mobile con finestra specificata
   */
  calculateMovingAverage(data: number[], windowSize: number): number[] {
    if (data.length === 0) return [];
    if (windowSize <= 0 || windowSize > data.length) {
      return data.map(() => data.reduce((sum, val) => sum + val, 0) / data.length);
    }

    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = data.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(avg);
    }

    return result;
  }

  /**
   * Calcola coefficienti stagionalità per giorno settimana
   * Basato su dati storici
   */
  private calculateSeasonalityCoefficients(historicalData: HistoricalData[]): Map<number, number> {
    const dayOfWeekTotals = new Map<number, { sum: number; count: number }>();
    
    // Inizializza per ogni giorno settimana
    for (let i = 0; i < 7; i++) {
      dayOfWeekTotals.set(i, { sum: 0, count: 0 });
    }

    // Somma revenue per ogni giorno settimana
    historicalData.forEach(data => {
      if (data.day_of_week !== undefined) {
        const dayData = dayOfWeekTotals.get(data.day_of_week) || { sum: 0, count: 0 };
        dayData.sum += data.total_revenue;
        dayData.count += 1;
        dayOfWeekTotals.set(data.day_of_week, dayData);
      }
    });

    // Calcola media totale
    const totalAvg = historicalData.reduce((sum, d) => sum + d.total_revenue, 0) / historicalData.length;

    // Calcola coefficienti (media giorno / media totale)
    const coefficients = new Map<number, number>();
    dayOfWeekTotals.forEach((dayData, dayOfWeek) => {
      const dayAvg = dayData.count > 0 ? dayData.sum / dayData.count : totalAvg;
      coefficients.set(dayOfWeek, dayAvg / totalAvg);
    });

    return coefficients;
  }

  /**
   * Forecast revenue per prossimi N giorni
   */
  forecastRevenue(
    historicalData: HistoricalData[],
    daysAhead: number = 30
  ): ForecastData[] {
    if (historicalData.length === 0) {
      return [];
    }

    // Ordina per data
    const sorted = [...historicalData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Estrai revenue e occupancy
    const revenues = sorted.map(d => d.total_revenue);
    const occupancies = sorted.map(d => d.occupancy_rate);

    // Calcola media mobile 7 giorni
    const revenueMA = this.calculateMovingAverage(revenues, 7);
    const occupancyMA = this.calculateMovingAverage(occupancies, 7);

    // Ultimi valori per trend
    const lastRevenue = revenueMA[revenueMA.length - 1] || revenues[revenues.length - 1] || 0;
    const lastOccupancy = occupancyMA[occupancyMA.length - 1] || occupancies[occupancies.length - 1] || 0;

    // Calcola trend (differenza media ultimi 7 vs precedenti 7)
    const recent7 = revenueMA.slice(-7);
    const previous7 = revenueMA.slice(-14, -7);
    const recentAvg = recent7.reduce((sum, val) => sum + val, 0) / recent7.length;
    const previousAvg = previous7.length > 0 
      ? previous7.reduce((sum, val) => sum + val, 0) / previous7.length 
      : recentAvg;
    const trend = recentAvg - previousAvg;

    // Calcola coefficienti stagionalità
    const seasonalityCoeffs = this.calculateSeasonalityCoefficients(sorted);

    // Genera forecast
    const forecast: ForecastData[] = [];
    const startDate = new Date(sorted[sorted.length - 1].date);
    startDate.setDate(startDate.getDate() + 1); // Inizia dal giorno dopo l'ultimo dato

    for (let i = 0; i < daysAhead; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const dayOfWeek = forecastDate.getDay();
      const seasonalityCoeff = seasonalityCoeffs.get(dayOfWeek) || 1.0;

      // Applica trend e stagionalità
      const baseRevenue = lastRevenue + (trend * (i / 7)); // Trend si applica gradualmente
      const predictedRevenue = baseRevenue * seasonalityCoeff;

      // Occupancy segue trend simile ma con meno variazione
      const occupancyTrend = (occupancyMA[occupancyMA.length - 1] - occupancyMA[occupancyMA.length - 8]) / 7 || 0;
      const baseOccupancy = lastOccupancy + (occupancyTrend * (i / 7));
      const predictedOccupancy = Math.max(0, Math.min(100, baseOccupancy * seasonalityCoeff));

      // Confidence diminuisce nel tempo (più lontano = meno confidente)
      const confidence = Math.max(0.3, 1 - (i / daysAhead) * 0.7);

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(predictedRevenue * 100) / 100,
        predictedOccupancy: Math.round(predictedOccupancy * 100) / 100,
        confidence,
      });
    }

    return forecast;
  }

  /**
   * Calcola statistiche aggregate su forecast
   */
  calculateForecastStats(forecast: ForecastData[]): {
    totalRevenue30d: number;
    avgOccupancy: number;
    minRevenue: number;
    maxRevenue: number;
    confidenceInterval: { min: number; max: number };
  } {
    if (forecast.length === 0) {
      return {
        totalRevenue30d: 0,
        avgOccupancy: 0,
        minRevenue: 0,
        maxRevenue: 0,
        confidenceInterval: { min: 0, max: 0 },
      };
    }

    const revenues = forecast.map(f => f.predictedRevenue);
    const occupancies = forecast.map(f => f.predictedOccupancy);

    const totalRevenue30d = revenues.reduce((sum, r) => sum + r, 0);
    const avgOccupancy = occupancies.reduce((sum, o) => sum + o, 0) / occupancies.length;
    const minRevenue = Math.min(...revenues);
    const maxRevenue = Math.max(...revenues);

    // Confidence interval: ±10% per semplicità
    const avgRevenue = totalRevenue30d / revenues.length;
    const confidenceInterval = {
      min: avgRevenue * 0.9,
      max: avgRevenue * 1.1,
    };

    return {
      totalRevenue30d: Math.round(totalRevenue30d * 100) / 100,
      avgOccupancy: Math.round(avgOccupancy * 100) / 100,
      minRevenue: Math.round(minRevenue * 100) / 100,
      maxRevenue: Math.round(maxRevenue * 100) / 100,
      confidenceInterval: {
        min: Math.round(confidenceInterval.min * 100) / 100,
        max: Math.round(confidenceInterval.max * 100) / 100,
      },
    };
  }
}
