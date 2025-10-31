// Servizi di calcolo per Revenue Management

import { CostsData, RevenueData, KPIData, CostAnalysis, HotelData, CostItem, MonthlyCostsData } from './types';

/**
 * Calcola KPI principali per l'hotel
 */
export function calculateKPI(
  costs: Partial<CostsData> | MonthlyCostsData[],
  revenues: RevenueData[],
  hotelData?: HotelData
): KPIData {
  // Se costs è un array di MonthlyCostsData, somma tutti i costi
  let totalCostsData: Partial<CostsData> = {};
  if (Array.isArray(costs)) {
    // Somma i costi di tutti i mesi
    costs.forEach(monthlyCost => {
      const monthCosts = monthlyCost.costs;
      // Ristorazione: somma tutti gli array
      if (monthCosts.ristorazione) {
        if (!totalCostsData.ristorazione) totalCostsData.ristorazione = [];
        totalCostsData.ristorazione = [...(totalCostsData.ristorazione || []), ...monthCosts.ristorazione];
      }
      // Utenze: somma i valori
      if (monthCosts.utenze) {
        if (!totalCostsData.utenze) totalCostsData.utenze = { energia: { fornitore: '', importo: 0 }, gas: { fornitore: '', importo: 0 }, acqua: { fornitore: '', importo: 0 } };
        totalCostsData.utenze.energia.importo = (totalCostsData.utenze.energia.importo || 0) + (monthCosts.utenze.energia?.importo || 0);
        totalCostsData.utenze.gas.importo = (totalCostsData.utenze.gas.importo || 0) + (monthCosts.utenze.gas?.importo || 0);
        totalCostsData.utenze.acqua.importo = (totalCostsData.utenze.acqua.importo || 0) + (monthCosts.utenze.acqua?.importo || 0);
      }
      // Personale: somma i valori
      if (monthCosts.personale) {
        if (!totalCostsData.personale) totalCostsData.personale = { bustePaga: 0, sicurezza: 0 };
        totalCostsData.personale.bustePaga = (totalCostsData.personale.bustePaga || 0) + (monthCosts.personale.bustePaga || 0);
        totalCostsData.personale.sicurezza = (totalCostsData.personale.sicurezza || 0) + (monthCosts.personale.sicurezza || 0);
      }
      // Altri costi: somma i valori
      if (monthCosts.altriCosti) {
        if (!totalCostsData.altriCosti) totalCostsData.altriCosti = {};
        Object.keys(monthCosts.altriCosti).forEach(key => {
          totalCostsData.altriCosti![key] = (totalCostsData.altriCosti![key] || 0) + (monthCosts.altriCosti![key] || 0);
        });
      }
    });
  } else {
    totalCostsData = costs;
  }
  
  // Calcola totali spese
  const totaleSpese = calculateTotalCosts(totalCostsData);

  // Calcola ricavi totali (somma di tutti i mesi)
  const totaleRicavi = revenues.reduce((sum, revenue) => sum + (revenue.entrateTotali || 0), 0);

  // KPI base (usiamo l'ultimo mese per occupazione e ADR per i calcoli KPI specifici)
  const ultimoMese = revenues[revenues.length - 1];
  const camereTotali = hotelData?.camereTotali || 1;
  const occupazione = ultimoMese?.occupazione || 0;
  const adr = ultimoMese?.prezzoMedioCamera || 0;

  // RevPAR = ADR × Occupancy Rate
  const revpar = (adr * occupazione) / 100;

  // CPPR = Total Costs / Total Room Nights
  // Calcola le notti totali da tutti i mesi
  const nottiTotali = revenues.reduce((sum, revenue) => sum + (revenue.nottiTotali || 0), 0);
  const cppr = nottiTotali > 0 ? totaleSpese / nottiTotali : 0;

  // GOP (Gross Operating Profit) = Revenue - Operating Costs
  const gop = totaleRicavi - totaleSpese;

  // GOP Margin = (GOP / Revenue) × 100
  const gopMargin = totaleRicavi > 0 ? (gop / totaleRicavi) * 100 : 0;

  // Profit per room = GOP / Total Rooms
  const profitPerRoom = gop / camereTotali;

  return {
    revpar: Math.round(revpar * 100) / 100,
    adr: Math.round(adr * 100) / 100,
    occupazione: Math.round(occupazione * 100) / 100,
    gop: Math.round(gop * 100) / 100,
    gopMargin: Math.round(gopMargin * 100) / 100,
    cppr: Math.round(cppr * 100) / 100,
    profitPerRoom: Math.round(profitPerRoom * 100) / 100,
    totaleSpese: Math.round(totaleSpese * 100) / 100,
    totaleRicavi: Math.round(totaleRicavi * 100) / 100,
  };
}

/**
 * Calcola il totale delle spese
 */
export function calculateTotalCosts(costs: Partial<CostsData>): number {
  let totale = 0;

  // Ristorazione
  if (costs.ristorazione) {
    totale += costs.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
  }

  // Utenze
  if (costs.utenze) {
    totale += (costs.utenze.energia?.importo || 0);
    totale += (costs.utenze.gas?.importo || 0);
    totale += (costs.utenze.acqua?.importo || 0);
  }

  // Personale
  if (costs.personale) {
    totale += (costs.personale.bustePaga || 0);
    totale += (costs.personale.sicurezza || 0);
  }

  // Altri costi
  if (costs.altriCosti) {
    totale += Object.values(costs.altriCosti).reduce((sum, val) => sum + (val || 0), 0);
  }

  return totale;
}

/**
 * Analizza i costi e identifica anomalie/trend
 */
export function analyzeCosts(
  currentCosts: Partial<CostsData>,
  previousCosts?: Partial<CostsData>,
  benchmark?: Record<string, number>
): CostAnalysis[] {
  const analyses: CostAnalysis[] = [];

  // Analisi Ristorazione
  const ristorazioneTotale = (currentCosts.ristorazione || []).reduce(
    (sum, item) => sum + (item.importo || 0),
    0
  );
  const ristorazionePrecedente = previousCosts
    ? (previousCosts.ristorazione || []).reduce((sum, item) => sum + (item.importo || 0), 0)
    : undefined;

  if (ristorazioneTotale > 0) {
    const variazione = ristorazionePrecedente
      ? ((ristorazioneTotale - ristorazionePrecedente) / ristorazionePrecedente) * 100
      : undefined;

    analyses.push({
      categoria: 'Ristorazione',
      importoAttuale: ristorazioneTotale,
      importoMesePrecedente: ristorazionePrecedente,
      variazionePercentuale: variazione,
      benchmarkSettore: benchmark?.ristorazione,
      differenzaBenchmark: benchmark?.ristorazione
        ? ristorazioneTotale - benchmark.ristorazione
        : undefined,
      trend: !variazione
        ? 'stabile'
        : variazione > 5
        ? 'incremento'
        : variazione < -5
        ? 'decremento'
        : 'stabile',
      anomalia: variazione ? Math.abs(variazione) > 20 : false,
      priorita: Math.abs(variazione || 0) > 15 ? 'alta' : variazione ? 'media' : 'bassa',
    });
  }

  // Analisi Utenze
  if (currentCosts.utenze) {
    ['energia', 'gas', 'acqua'].forEach((tipo) => {
      const utenza = currentCosts.utenze![tipo as keyof typeof currentCosts.utenze] as CostItem;
      const utenzaPrec = previousCosts?.utenze?.[tipo as keyof typeof previousCosts.utenze] as
        | CostItem
        | undefined;

      if (utenza?.importo) {
        const variazione = utenzaPrec?.importo
          ? ((utenza.importo - utenzaPrec.importo) / utenzaPrec.importo) * 100
          : undefined;

        analyses.push({
          categoria: `Utenze ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`,
          importoAttuale: utenza.importo,
          importoMesePrecedente: utenzaPrec?.importo,
          variazionePercentuale: variazione,
          trend: !variazione
            ? 'stabile'
            : variazione > 10
            ? 'incremento'
            : variazione < -10
            ? 'decremento'
            : 'stabile',
          anomalia: variazione ? Math.abs(variazione) > 25 : false,
          priorita: Math.abs(variazione || 0) > 20 ? 'alta' : variazione ? 'media' : 'bassa',
        });
      }
    });
  }

  // Analisi Personale
  if (currentCosts.personale) {
    const personaleTotale =
      (currentCosts.personale.bustePaga || 0) + (currentCosts.personale.sicurezza || 0);
    const personalePrec = previousCosts?.personale
      ? (previousCosts.personale.bustePaga || 0) + (previousCosts.personale.sicurezza || 0)
      : undefined;

    const variazione = personalePrec ? ((personaleTotale - personalePrec) / personalePrec) * 100 : undefined;

    if (personaleTotale > 0) {
      analyses.push({
        categoria: 'Personale',
        importoAttuale: personaleTotale,
        importoMesePrecedente: personalePrec,
        variazionePercentuale: variazione,
        trend: !variazione
          ? 'stabile'
          : variazione > 3
          ? 'incremento'
          : variazione < -3
          ? 'decremento'
          : 'stabile',
        anomalia: variazione ? Math.abs(variazione) > 10 : false,
        priorita: Math.abs(variazione || 0) > 8 ? 'alta' : variazione ? 'media' : 'bassa',
      });
    }
  }

  // Analisi Altri Costi (aggregato)
  if (currentCosts.altriCosti) {
    const altriCostiTotale = Object.values(currentCosts.altriCosti).reduce(
      (sum, val) => sum + (val || 0),
      0
    );
    const altriCostiPrec = previousCosts?.altriCosti
      ? Object.values(previousCosts.altriCosti).reduce((sum, val) => sum + (val || 0), 0)
      : undefined;

    if (altriCostiTotale > 0) {
      const variazione = altriCostiPrec
        ? ((altriCostiTotale - altriCostiPrec) / altriCostiPrec) * 100
        : undefined;

      analyses.push({
        categoria: 'Altri Costi',
        importoAttuale: altriCostiTotale,
        importoMesePrecedente: altriCostiPrec,
        variazionePercentuale: variazione,
        trend: !variazione
          ? 'stabile'
          : variazione > 10
          ? 'incremento'
          : variazione < -10
          ? 'decremento'
          : 'stabile',
        anomalia: variazione ? Math.abs(variazione) > 30 : false,
        priorita: (Math.abs(variazione || 0) > 25 ? 'alta' : variazione ? 'media' : 'bassa') as 'alta' | 'media' | 'bassa',
      });
    }
  }

  return analyses;
}

/**
 * Benchmark settore (valori medi per hotel in Italia)
 * Questi sono valori indicativi e potrebbero essere personalizzati
 */
export function getBenchmarkValues(hotelData?: HotelData): Record<string, number> {
  // Benchmark in base a categoria e stelle
  const baseBenchmark = {
    ristorazione: 15000, // €/mese per hotel medio
    utenze: 5000,
    personale: 35000,
  };

  // Adjust based on hotel category
  if (hotelData?.categoria === 'lussuoso') {
    return {
      ristorazione: baseBenchmark.ristorazione * 1.5,
      utenze: baseBenchmark.utenze * 1.2,
      personale: baseBenchmark.personale * 1.3,
    };
  }

  if (hotelData?.categoria === 'economico') {
    return {
      ristorazione: baseBenchmark.ristorazione * 0.7,
      utenze: baseBenchmark.utenze * 0.8,
      personale: baseBenchmark.personale * 0.8,
    };
  }

  return baseBenchmark;
}

