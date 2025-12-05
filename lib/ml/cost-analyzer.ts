// Cost Analyzer per rilevare anomalie costo/guest
// Quick Win 3

import { HistoricalData } from '../types';

export interface CostAnomaly {
  date: string;
  costPerGuest: number;
  avgCostPerGuest: number;
  deviation: number; // z-score
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export class CostAnalyzer {
  /**
   * Calcola costo per guest per un giorno
   */
  calculateCostPerGuest(costs: number, guests: number): number {
    if (guests === 0) return 0;
    return costs / guests;
  }

  /**
   * Calcola media e deviazione standard
   */
  private calculateStats(values: number[]): { mean: number; stdDev: number } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }

  /**
   * Rileva anomalie usando z-score
   * Threshold: ±2 std dev = medium, ±3 std dev = high
   */
  detectAnomalies(historicalCostPerGuest: Array<{ date: string; costPerGuest: number }>): CostAnomaly[] {
    if (historicalCostPerGuest.length === 0) {
      return [];
    }

    const costs = historicalCostPerGuest.map(d => d.costPerGuest);
    const { mean, stdDev } = this.calculateStats(costs);

    if (stdDev === 0) {
      return []; // Nessuna variazione, nessuna anomalia
    }

    const anomalies: CostAnomaly[] = [];

    historicalCostPerGuest.forEach(({ date, costPerGuest }) => {
      const zScore = (costPerGuest - mean) / stdDev;
      const absZScore = Math.abs(zScore);

      // Solo anomalie positive (costi troppo alti)
      if (zScore > 0 && absZScore >= 2) {
        const severity: 'high' | 'medium' | 'low' = absZScore >= 3 ? 'high' : 'medium';
        
        anomalies.push({
          date,
          costPerGuest: Math.round(costPerGuest * 100) / 100,
          avgCostPerGuest: Math.round(mean * 100) / 100,
          deviation: Math.round(zScore * 100) / 100,
          severity,
          suggestion: this.generateSuggestion(costPerGuest, mean, zScore),
        });
      }
    });

    // Ordina per severity e deviation
    return anomalies.sort((a, b) => {
      if (a.severity === 'high' && b.severity !== 'high') return -1;
      if (b.severity === 'high' && a.severity !== 'high') return 1;
      return b.deviation - a.deviation;
    });
  }

  /**
   * Genera suggerimento generico basato su anomalia
   */
  private generateSuggestion(costPerGuest: number, avgCostPerGuest: number, zScore: number): string {
    const percentDiff = ((costPerGuest - avgCostPerGuest) / avgCostPerGuest) * 100;

    if (percentDiff > 50) {
      return `Costo per guest del ${percentDiff.toFixed(0)}% superiore alla media. Verifica consumo energia e sprechi.`;
    } else if (percentDiff > 30) {
      return `Costo per guest del ${percentDiff.toFixed(0)}% superiore alla media. Controlla forniture e personale.`;
    } else {
      return `Costo per guest del ${percentDiff.toFixed(0)}% superiore alla media. Analizza variazioni stagionali.`;
    }
  }

  /**
   * Genera alert per ogni anomalia
   */
  generateCostAlerts(anomalies: CostAnomaly[]): Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    date: string;
    costPerGuest: number;
    suggestion: string;
  }> {
    return anomalies.map(anomaly => ({
      type: 'cost_anomaly',
      severity: anomaly.severity,
      message: `Giorno ${anomaly.date}: Costo/guest €${anomaly.costPerGuest.toFixed(2)} (+${((anomaly.costPerGuest - anomaly.avgCostPerGuest) / anomaly.avgCostPerGuest * 100).toFixed(0)}% vs media)`,
      date: anomaly.date,
      costPerGuest: anomaly.costPerGuest,
      suggestion: anomaly.suggestion,
    }));
  }
}
