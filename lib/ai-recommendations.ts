// Sistema di Raccomandazioni IA per Ottimizzazione Costi e Profitti

import { CostsData, RevenueData, KPIData, CostAnalysis, Recommendation, HotelData } from './types';
import { calculateTotalCosts, analyzeCosts, getBenchmarkValues } from './calculations';

/**
 * Genera raccomandazioni IA basate su analisi dei costi e performance
 */
export function generateRecommendations(
  costs: Partial<CostsData>,
  revenues: RevenueData[],
  kpi: KPIData,
  costAnalyses: CostAnalysis[],
  hotelData?: HotelData
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 1. Analisi anomalie costi
  costAnalyses.forEach((analysis) => {
    if (analysis.anomalia) {
      if (analysis.trend === 'incremento' && analysis.variazionePercentuale && analysis.variazionePercentuale > 20) {
        recommendations.push({
          id: `anomalia-${analysis.categoria.toLowerCase().replace(/\s+/g, '-')}`,
          categoria: analysis.categoria,
          titolo: `Spesa ${analysis.categoria} aumentata del ${Math.round(analysis.variazionePercentuale)}%`,
          descrizione: `Rilevato un aumento significativo nella categoria ${analysis.categoria}. Analizza le cause e valuta alternative.`,
          impattoStimato: Math.round(analysis.importoAttuale * 0.15), // potenziale risparmio del 15%
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Verifica contratti con fornitori attuali',
            'Richiedi preventivi da fornitori alternativi',
            'Analizza consumo vs. periodo precedente',
            'Valuta rinegoziazione contratti',
          ],
          evidenze: [
            `Variazione: +${Math.round(analysis.variazionePercentuale)}% rispetto al mese precedente`,
            `Importo attuale: €${analysis.importoAttuale.toLocaleString('it-IT')}`,
          ],
        });
      }
    }

    // Confronto con benchmark
    if (analysis.benchmarkSettore && analysis.differenzaBenchmark) {
      const percentualeSopraBenchmark = (analysis.differenzaBenchmark / analysis.benchmarkSettore) * 100;
      if (percentualeSopraBenchmark > 15) {
        recommendations.push({
          id: `benchmark-${analysis.categoria.toLowerCase().replace(/\s+/g, '-')}`,
          categoria: analysis.categoria,
          titolo: `${analysis.categoria} superiore del ${Math.round(percentualeSopraBenchmark)}% rispetto al benchmark`,
          descrizione: `I tuoi costi per ${analysis.categoria} sono significativamente superiori alla media del settore.`,
          impattoStimato: Math.round(Math.abs(analysis.differenzaBenchmark) * 0.2), // 20% del gap
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Confronta con benchmark di settore',
            'Identifica aree di inefficienza',
            'Valuta ottimizzazione processi',
            'Considera investimenti in tecnologie efficienti',
          ],
          evidenze: [
            `Benchmark settore: €${analysis.benchmarkSettore.toLocaleString('it-IT')}`,
            `Tuo valore: €${analysis.importoAttuale.toLocaleString('it-IT')}`,
          ],
        });
      }
    }
  });

  // 2. Analisi GOP e margini
  if (kpi.gopMargin < 20) {
    recommendations.push({
      id: 'gop-margin-basso',
      categoria: 'Profitability',
      titolo: 'Margine GOP sotto il target raccomandato',
      descrizione: `Il tuo margine GOP è ${kpi.gopMargin.toFixed(1)}%. L'obiettivo per hotel di successo è >25%.`,
      impattoStimato: Math.round(kpi.totaleRicavi * 0.05), // potenziale miglioramento del 5%
      difficolta: 'complessa',
      priorita: kpi.gopMargin < 10 ? 'critica' : 'alta',
      azioni: [
        'Rivedi strategia pricing',
        'Ottimizza costi operativi',
        'Aumenta occupazione media',
        'Migliora mix di servizi offerti',
      ],
      evidenze: [
        `Margine GOP attuale: ${kpi.gopMargin.toFixed(1)}%`,
        `Target settore: 25-35%`,
      ],
    });
  }

  // 3. Analisi Ristorazione - troppi fornitori
  if (costs.ristorazione) {
    const fornitoriAttivi = costs.ristorazione.filter((item) => item.importo > 0).length;
    if (fornitoriAttivi > 10) {
      recommendations.push({
        id: 'fornitori-troppi',
        categoria: 'Ristorazione',
        titolo: 'Troppi fornitori ristorazione',
        descrizione: `Hai ${fornitoriAttivi} fornitori attivi. Consolidare in 5-8 fornitori principali può ridurre costi e semplificare gestione.`,
        impattoStimato: Math.round(calculateTotalCosts({ ristorazione: costs.ristorazione }) * 0.08),
        difficolta: 'facile',
        priorita: 'media',
        azioni: [
          'Identifica fornitori principali (80% spesa)',
          'Valuta consolidamento con fornitori chiave',
          'Rinegozia contratti con volumi maggiori',
          'Elimina fornitori marginali',
        ],
        evidenze: [`Numero fornitori attivi: ${fornitoriAttivi}`],
      });
    }
  }

  // 4. Analisi CPPR (Cost Per Paying Room)
  if (kpi.cppr > kpi.adr * 0.4) {
    recommendations.push({
      id: 'cppr-alto',
      categoria: 'Efficienza Operativa',
      titolo: 'Costo per camera venduta troppo elevato',
      descrizione: `Il tuo CPPR (€${kpi.cppr.toFixed(2)}) è troppo alto rispetto all'ADR. Target: <40% dell'ADR.`,
      impattoStimato: Math.round(kpi.totaleSpese * 0.1), // potenziale riduzione del 10%
      difficolta: 'complessa',
      priorita: 'alta',
      azioni: [
        'Riduci costi fissi',
        'Migliora efficienza energetica',
        'Ottimizza rotazione personale',
        'Automatizza processi ripetitivi',
      ],
      evidenze: [
        `CPPR: €${kpi.cppr.toFixed(2)}`,
        `ADR: €${kpi.adr.toFixed(2)}`,
        `Rapporto: ${((kpi.cppr / kpi.adr) * 100).toFixed(1)}%`,
      ],
    });
  }

  // 5. Analisi occupazione
  const ultimoMese = revenues[revenues.length - 1];
  if (ultimoMese && ultimoMese.occupazione < 60) {
    recommendations.push({
      id: 'occupazione-bassa',
      categoria: 'Revenue',
      titolo: 'Occupazione sotto il target ottimale',
      descrizione: `Occupazione del ${ultimoMese.occupazione.toFixed(1)}% è sotto l'obiettivo del 70%+.`,
      impattoStimato: Math.round(kpi.totaleRicavi * 0.15), // potenziale aumento del 15%
      difficolta: 'media',
      priorita: 'alta',
      azioni: [
        'Migliora strategia di pricing dinamico',
        'Ottimizza canali di distribuzione',
        'Investi in marketing mirato',
        'Rivedi offerte e pacchetti',
      ],
      evidenze: [
        `Occupazione attuale: ${ultimoMese.occupazione.toFixed(1)}%`,
        `Target settore: 70-80%`,
      ],
    });
  }

  // 6. Analisi Utenze - consumo eccessivo
  if (costs.utenze) {
    const utenzeTotali =
      (costs.utenze.energia?.importo || 0) +
      (costs.utenze.gas?.importo || 0) +
      (costs.utenze.acqua?.importo || 0);
    const benchmark = getBenchmarkValues(hotelData);
    if (utenzeTotali > benchmark.utenze * 1.3) {
      recommendations.push({
        id: 'utenze-eccessive',
        categoria: 'Utenze',
        titolo: 'Consumo utenze superiore alla norma',
        descrizione: 'Le utenze rappresentano una spesa significativa. Valuta interventi di efficienza energetica.',
        impattoStimato: Math.round(utenzeTotali * 0.2), // potenziale risparmio del 20%
        difficolta: 'media',
        priorita: 'media',
        azioni: [
          'Effettua audit energetico',
          'Installa sistemi di controllo automatico',
          'Sostituisci apparecchi obsoleti',
          'Forma personale su best practices',
        ],
        evidenze: [`Spesa utenze: €${utenzeTotali.toLocaleString('it-IT')}`],
      });
    }
  }

  // Ordina per priorità e impatto
  return recommendations.sort((a, b) => {
    const prioritaOrder = { critica: 4, alta: 3, media: 2, bassa: 1 };
    const prioritaDiff = prioritaOrder[b.priorita] - prioritaOrder[a.priorita];
    if (prioritaDiff !== 0) return prioritaDiff;
    return b.impattoStimato - a.impattoStimato;
  });
}

/**
 * Genera alert per anomalie critiche
 */
export function generateAlerts(
  costAnalyses: CostAnalysis[],
  kpi: KPIData
): Array<{ tipo: 'anomalia' | 'soglia' | 'trend'; messaggio: string; severita: 'critica' | 'alta' | 'media' | 'bassa' }> {
  const alerts: Array<{
    tipo: 'anomalia' | 'soglia' | 'trend';
    messaggio: string;
    severita: 'critica' | 'alta' | 'media' | 'bassa';
  }> = [];

  // Alert per anomalie critiche
  costAnalyses.forEach((analysis) => {
    if (analysis.anomalia && analysis.variazionePercentuale && Math.abs(analysis.variazionePercentuale) > 30) {
      alerts.push({
        tipo: 'anomalia',
        messaggio: `${analysis.categoria}: variazione del ${Math.round(analysis.variazionePercentuale)}%`,
        severita: 'critica',
      });
    }
  });

  // Alert per GOP negativo
  if (kpi.gop < 0) {
    alerts.push({
      tipo: 'soglia',
      messaggio: 'GOP negativo: hotel in perdita',
      severita: 'critica',
    });
  }

  // Alert per margine critico
  if (kpi.gopMargin < 5) {
    alerts.push({
      tipo: 'soglia',
      messaggio: `Margine GOP critico: ${kpi.gopMargin.toFixed(1)}%`,
      severita: 'alta',
    });
  }

  return alerts;
}

