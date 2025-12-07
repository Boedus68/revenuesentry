/**
 * CONTEXT BUILDER - Costruisce HotelContext da dati Firestore
 * 
 * Aggrega e prepara tutti i dati necessari per il Reasoning Engine
 */

import { HotelData, KPIData, HistoricalData, RevenueData, CostsData, MonthlyCostsData } from '../types';
import { HotelContext, TrendAnalysis, TrendMetrics, Anomaly, BenchmarkComparison, SeasonalityPattern } from './reasoning-engine';
import { calculateKPI, getBenchmarkValues } from '../calculations';
import { CostAnalyzer } from '../ml/cost-analyzer';

export class ContextBuilder {
  
  /**
   * Costruisce HotelContext completo da dati raw
   */
  public buildContext(params: {
    hotelId: string;
    currentMonth: string;
    hotelData: HotelData;
    revenueData: RevenueData[];
    costsData: CostsData[];
    historicalData: HistoricalData[];
  }): HotelContext {
    const { hotelId, currentMonth, hotelData, revenueData, costsData, historicalData } = params;
    
    // Converti CostsData[] in MonthlyCostsData[] per calculateKPI
    // calculateKPI accetta Partial<CostsData> | MonthlyCostsData[]
    let costsForKPI: Partial<CostsData> | MonthlyCostsData[];
    if (costsData.length === 0) {
      costsForKPI = {};
    } else if (costsData.length === 1) {
      // Se c'è un solo elemento, passa direttamente come Partial<CostsData>
      costsForKPI = costsData[0];
    } else {
      // Se ci sono più elementi, converti in MonthlyCostsData[]
      costsForKPI = costsData.map((cost, index) => {
        // Se il costo ha già un campo mese, usalo, altrimenti usa il mese corrente o un mese calcolato
        const mese = (cost as any).mese || this.getMonthFromIndex(index, currentMonth);
        return {
          mese,
          costs: cost
        };
      });
    }
    
    // Calcola KPI
    let kpis;
    try {
      kpis = calculateKPI(costsForKPI, revenueData, hotelData);
    } catch (err: any) {
      throw new Error(`Errore calcolo KPI: ${err.message}`);
    }
    
    // Analizza trend
    let trends;
    try {
      trends = this.analyzeTrends(revenueData, costsData, historicalData);
    } catch (err: any) {
      throw new Error(`Errore analisi trend: ${err.message}`);
    }
    
    // Identifica anomalie
    let anomalies: Anomaly[];
    try {
      anomalies = this.identifyAnomalies(costsData, revenueData, historicalData, kpis);
    } catch (err: any) {
      // Se fallisce, continua con array vuoto
      anomalies = [];
    }
    
    // Confronta con benchmark
    let benchmarks;
    try {
      benchmarks = this.buildBenchmarkComparison(kpis, hotelData);
    } catch (err: any) {
      throw new Error(`Errore benchmark comparison: ${err.message}`);
    }
    
    // Analizza stagionalità
    let seasonality;
    try {
      seasonality = this.analyzeSeasonality(historicalData, currentMonth);
    } catch (err: any) {
      // Se fallisce, usa valori di default
      seasonality = {
        currentMonthFactor: 1.0,
        nextMonthFactor: 1.0,
        isLowSeason: false,
        isHighSeason: false,
        historicalPattern: []
      };
    }
    
    return {
      currentMonth,
      hotelData,
      kpis,
      revenueData,
      costsData,
      historicalData,
      trends,
      anomalies,
      benchmarks,
      seasonality
    };
  }
  
  /**
   * Analizza trend da dati storici
   */
  private analyzeTrends(
    revenueData: RevenueData[],
    costsData: CostsData[],
    historicalData: HistoricalData[]
  ): TrendAnalysis {
    // Revenue trend (ultimi 3 mesi vs precedenti 3)
    const revenueTrend = this.calculateTrend(
      revenueData.length >= 3 ? revenueData.slice(-3).map(r => r.entrateTotali || 0) : [],
      revenueData.length >= 6 ? revenueData.slice(-6, -3).map(r => r.entrateTotali || 0) : [],
      'revenue'
    );
    
    // Occupancy trend
    const occupancyTrend = this.calculateTrend(
      revenueData.length >= 3 ? revenueData.slice(-3).map(r => r.occupazione || 0) : [],
      revenueData.length >= 6 ? revenueData.slice(-6, -3).map(r => r.occupazione || 0) : [],
      'occupancy'
    );
    
    // Costs trend
    const costsTrend = this.calculateTrend(
      costsData.length >= 3 ? costsData.slice(-3).map(c => this.getTotalCosts(c)) : [],
      costsData.length >= 6 ? costsData.slice(-6, -3).map(c => this.getTotalCosts(c)) : [],
      'costs'
    );
    
    // Profitability trend (GOPPAR)
    const profitabilityTrend = this.calculateProfitabilityTrend(revenueData, costsData);
    
    return {
      revenue: revenueTrend,
      occupancy: occupancyTrend,
      costs: costsTrend,
      profitability: profitabilityTrend
    };
  }
  
  /**
   * Calcola trend metric
   */
  private calculateTrend(
    recent: number[],
    previous: number[],
    type: string
  ): TrendMetrics {
    if (recent.length === 0 || previous.length === 0) {
      return {
        direction: 'stable',
        strength: 0,
        changePercent: 0,
        timeframe: '3 mesi',
        significance: 'low'
      };
    }
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    if (previousAvg === 0) {
      return {
        direction: 'stable',
        strength: 0,
        changePercent: 0,
        timeframe: '3 mesi',
        significance: 'low'
      };
    }
    
    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
    const absChange = Math.abs(changePercent);
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (changePercent > 2) direction = 'up';
    else if (changePercent < -2) direction = 'down';
    
    let significance: 'high' | 'medium' | 'low' = 'low';
    if (absChange > 15) significance = 'high';
    else if (absChange > 8) significance = 'medium';
    
    const strength = Math.min(10, absChange / 2);
    
    return {
      direction,
      strength,
      changePercent,
      timeframe: '3 mesi',
      significance
    };
  }
  
  /**
   * Calcola profitability trend
   */
  private calculateProfitabilityTrend(
    revenueData: RevenueData[],
    costsData: CostsData[]
  ): TrendMetrics {
    if (revenueData.length < 6 || costsData.length < 6) {
      return {
        direction: 'stable',
        strength: 0,
        changePercent: 0,
        timeframe: '3 mesi',
        significance: 'low'
      };
    }
    
    const recentRevenue = revenueData.slice(-3).map(r => r.entrateTotali || 0);
    const recentCosts = costsData.slice(-3).map(c => this.getTotalCosts(c));
    const recentProfit = recentRevenue.map((r, i) => r - (recentCosts[i] || 0));
    
    const previousRevenue = revenueData.slice(-6, -3).map(r => r.entrateTotali || 0);
    const previousCosts = costsData.slice(-6, -3).map(c => this.getTotalCosts(c));
    const previousProfit = previousRevenue.map((r, i) => r - (previousCosts[i] || 0));
    
    return this.calculateTrend(recentProfit, previousProfit, 'profitability');
  }
  
  /**
   * Identifica anomalie
   */
  private identifyAnomalies(
    costsData: CostsData[],
    revenueData: RevenueData[],
    historicalData: HistoricalData[],
    kpis: KPIData
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Usa CostAnalyzer per anomalie costi
    if (costsData.length > 0) {
      const costAnalyzer = new CostAnalyzer();
      const latestCosts = costsData[costsData.length - 1];
      const totalCosts = this.getTotalCosts(latestCosts);
      
      // Calcola cost per guest se possibile
      const avgGuests = historicalData.length > 0
        ? historicalData.slice(-30).reduce((sum, h) => sum + (h.total_revenue / (h.adr || 1)), 0) / Math.min(30, historicalData.length)
        : 0;
      
      if (avgGuests > 0) {
        const costPerGuest = totalCosts / avgGuests;
        const expectedCostPerGuest = this.getExpectedCostPerGuest(costsData, revenueData);
        
        if (expectedCostPerGuest > 0) {
          const deviation = ((costPerGuest - expectedCostPerGuest) / expectedCostPerGuest) * 100;
          
          if (Math.abs(deviation) > 20) {
            anomalies.push({
              type: 'cost',
              severity: Math.abs(deviation) > 30 ? 'critical' : 'warning',
              metric: 'Cost per Guest',
              actual: costPerGuest,
              expected: expectedCostPerGuest,
              deviation,
              period: 'Ultimo mese',
              possibleCauses: [
                'Aumento costi operativi',
                'Riduzione numero ospiti',
                'Costi una-tantum',
                'Inefficienze operative'
              ]
            });
          }
        }
      }
    }
    
    // Anomalie revenue
    if (revenueData.length >= 3) {
      const recentRevenue = revenueData.slice(-3).map(r => r.entrateTotali || 0);
      const avgRecent = recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length;
      const previousRevenue = revenueData.slice(-6, -3).map(r => r.entrateTotali || 0);
      const avgPrevious = previousRevenue.reduce((a, b) => a + b, 0) / previousRevenue.length;
      
      if (avgPrevious > 0) {
        const deviation = ((avgRecent - avgPrevious) / avgPrevious) * 100;
        
        if (deviation < -20) {
          anomalies.push({
            type: 'revenue',
            severity: deviation < -30 ? 'critical' : 'warning',
            metric: 'Total Revenue',
            actual: avgRecent,
            expected: avgPrevious,
            deviation,
            period: 'Ultimi 3 mesi',
            possibleCauses: [
              'Calo occupazione',
              'Riduzione prezzi',
              'Stagionalità',
              'Problemi competitivi'
            ]
          });
        }
      }
    }
    
    return anomalies;
  }
  
  /**
   * Costruisce confronto con benchmark
   */
  private buildBenchmarkComparison(kpis: KPIData, hotelData: HotelData): BenchmarkComparison {
    // Benchmark basati su stelle hotel
    const stars = hotelData.stelle || 3;
    const benchmarkADR: Record<number, number> = { 3: 90, 4: 140, 5: 220 };
    const benchmarkOccupancy: Record<number, number> = { 3: 0.65, 4: 0.75, 5: 0.80 };
    const benchmarkRevpar: Record<number, number> = { 
      3: benchmarkADR[3] * benchmarkOccupancy[3], 
      4: benchmarkADR[4] * benchmarkOccupancy[4], 
      5: benchmarkADR[5] * benchmarkOccupancy[5] 
    };
    const benchmarkGoppar: Record<number, number> = { 3: 25, 4: 45, 5: 80 };
    
    const adrBenchmark = benchmarkADR[stars] || 90;
    const occupancyBenchmark = benchmarkOccupancy[stars] || 0.65;
    const revparBenchmark = benchmarkRevpar[stars] || 58.5;
    const gopparBenchmark = benchmarkGoppar[stars] || 25;
    
    // Calcola costRatio se disponibile
    const costRatioActual = kpis.totaleRicavi > 0 
      ? kpis.totaleSpese / kpis.totaleRicavi 
      : 0.65;
    const costRatioBenchmark = 0.65; // Standard industry
    
    return {
      adr: {
        actual: kpis.adr,
        benchmark: adrBenchmark,
        gap: (kpis.adr - adrBenchmark) / adrBenchmark
      },
      occupancy: {
        actual: kpis.occupazione,
        benchmark: occupancyBenchmark,
        gap: (kpis.occupazione - occupancyBenchmark) / occupancyBenchmark
      },
      revpar: {
        actual: kpis.revpar,
        benchmark: revparBenchmark,
        gap: (kpis.revpar - revparBenchmark) / revparBenchmark
      },
      goppar: {
        actual: kpis.goppar || 0,
        benchmark: gopparBenchmark,
        gap: ((kpis.goppar || 0) - gopparBenchmark) / gopparBenchmark
      },
      costRatio: {
        actual: costRatioActual,
        benchmark: costRatioBenchmark,
        gap: (costRatioActual - costRatioBenchmark) / costRatioBenchmark
      }
    };
  }
  
  /**
   * Analizza stagionalità
   */
  private analyzeSeasonality(historicalData: HistoricalData[], currentMonth: string): SeasonalityPattern {
    if (historicalData.length === 0) {
      return {
        currentMonthFactor: 1.0,
        nextMonthFactor: 1.0,
        isLowSeason: false,
        isHighSeason: false,
        historicalPattern: []
      };
    }
    
    // Raggruppa per mese
    const monthlyData: Record<string, number[]> = {};
    historicalData.forEach(h => {
      const month = h.date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(h.occupancy_rate);
    });
    
    // Calcola media occupazione per mese
    const monthlyAvg: Record<string, number> = {};
    Object.keys(monthlyData).forEach(month => {
      if (monthlyData[month].length > 0) {
        monthlyAvg[month] = monthlyData[month].reduce((a, b) => a + b, 0) / monthlyData[month].length;
      }
    });
    
    // Media generale
    const monthlyValues = Object.values(monthlyAvg);
    const overallAvg = monthlyValues.length > 0 
      ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length 
      : 0;
    
    // Fattore mese corrente
    const currentMonthKey = currentMonth.substring(0, 7);
    const currentMonthFactor = (overallAvg > 0 && monthlyAvg[currentMonthKey]) 
      ? monthlyAvg[currentMonthKey] / overallAvg 
      : 1.0;
    
    // Fattore prossimo mese
    const nextMonthDate = new Date(currentMonth + '-01');
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthFactor = (overallAvg > 0 && monthlyAvg[nextMonthKey])
      ? monthlyAvg[nextMonthKey] / overallAvg
      : 1.0;
    
    // Determina se è bassa/alta stagione
    const isLowSeason = currentMonthFactor < 0.85;
    const isHighSeason = currentMonthFactor > 1.15;
    
    // Pattern storico
    const historicalPattern = Object.keys(monthlyAvg)
      .sort()
      .map(month => ({
        month,
        avgOccupancy: monthlyAvg[month]
      }));
    
    return {
      currentMonthFactor,
      nextMonthFactor,
      isLowSeason,
      isHighSeason,
      historicalPattern
    };
  }
  
  /**
   * Helper: calcola total costs
   */
  private getTotalCosts(costs: CostsData | Partial<CostsData>): number {
    if (!costs || typeof costs !== 'object') {
      return 0;
    }
    
    let total = 0;
    
    try {
      // Personale
      if (costs.personale && typeof costs.personale === 'object') {
        total += (costs.personale.bustePaga || 0);
        total += (costs.personale.contributiINPS || 0);
        total += (costs.personale.sicurezza || 0);
      }
      
      // Utenze
      if (costs.utenze && typeof costs.utenze === 'object') {
        if (costs.utenze.energia && typeof costs.utenze.energia === 'object') {
          total += (costs.utenze.energia.importo || 0);
        }
        if (costs.utenze.gas && typeof costs.utenze.gas === 'object') {
          total += (costs.utenze.gas.importo || 0);
        }
        if (costs.utenze.acqua && typeof costs.utenze.acqua === 'object') {
          total += (costs.utenze.acqua.importo || 0);
        }
      }
      
      // Ristorazione
      if (costs.ristorazione && Array.isArray(costs.ristorazione)) {
        total += costs.ristorazione.reduce((sum, item) => {
          if (item && typeof item === 'object' && 'importo' in item) {
            return sum + (item.importo || 0);
          }
          return sum;
        }, 0);
      }
      
      // Marketing
      if (costs.marketing && typeof costs.marketing === 'object') {
        total += (costs.marketing.costiMarketing || 0);
        total += (costs.marketing.commissioniOTA || 0);
      }
      
      // Altri costi
      if (costs.altriCosti) {
        if (Array.isArray(costs.altriCosti)) {
          total += costs.altriCosti.reduce((sum, item) => {
            if (item && typeof item === 'object' && 'importo' in item) {
              return sum + (item.importo || 0);
            }
            return sum;
          }, 0);
        } else if (typeof costs.altriCosti === 'object') {
          // Se è un oggetto con chiavi numeriche
          Object.values(costs.altriCosti).forEach(value => {
            if (typeof value === 'number') {
              total += value;
            }
          });
        }
      }
    } catch (err: any) {
      // Se c'è un errore nel calcolo, ritorna almeno un valore parziale
      console.error('[ContextBuilder] Errore calcolo total costs:', err.message);
    }
    
    return total;
  }
  
  /**
   * Helper: calcola mese da indice (fallback)
   */
  private getMonthFromIndex(index: number, currentMonth: string): string {
    const date = new Date(currentMonth + '-01');
    date.setMonth(date.getMonth() - index);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  /**
   * Helper: calcola expected cost per guest
   */
  private getExpectedCostPerGuest(costsData: CostsData[], revenueData: RevenueData[]): number {
    if (costsData.length < 3 || revenueData.length < 3) return 0;
    
    // Media costi ultimi 6 mesi
    const avgCosts = costsData.slice(-6).reduce((sum, c) => sum + this.getTotalCosts(c), 0) / 6;
    
    // Media revenue ultimi 6 mesi
    const avgRevenue = revenueData.slice(-6).reduce((sum, r) => sum + (r.entrateTotali || 0), 0) / 6;
    
    // Stima guests da revenue e ADR medio
    const avgADR = revenueData.slice(-6).reduce((sum, r) => sum + (r.prezzoMedioCamera || 0), 0) / 6;
    if (avgADR === 0) return 0;
    
    const avgGuests = avgRevenue / avgADR;
    if (avgGuests === 0) return 0;
    
    return avgCosts / avgGuests;
  }
}
