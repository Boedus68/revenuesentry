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
      // Marketing: somma i valori
      if (monthCosts.marketing) {
        if (!totalCostsData.marketing) totalCostsData.marketing = { costiMarketing: 0, commissioniOTA: 0 };
        totalCostsData.marketing.costiMarketing = (totalCostsData.marketing.costiMarketing || 0) + (monthCosts.marketing.costiMarketing || 0);
        totalCostsData.marketing.commissioniOTA = (totalCostsData.marketing.commissioniOTA || 0) + (monthCosts.marketing.commissioniOTA || 0);
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

  // Calcola ricavi totali camere (somma di tutti i mesi)
  const totaleRicaviCamere = revenues.reduce((sum, revenue) => sum + (revenue.entrateTotali || 0), 0);
  
  // Calcola ricavi totali hotel (camere + F&B + servizi aggiuntivi)
  const totaleRicaviHotel = revenues.reduce((sum, revenue) => {
    return sum + (revenue.entrateTotali || 0) + (revenue.ricaviRistorazione || 0) + (revenue.ricaviServiziAggiuntivi || 0);
  }, 0);
  
  // Usa totaleRicaviHotel per i calcoli KPI generali
  const totaleRicavi = totaleRicaviHotel;

  // Calcoli specifici per hotel stagionali - CALCOLIAMO PRIMA I GIORNI DI APERTURA
  const isStagionale = hotelData?.tipoHotel === 'stagionale';
  
  // Calcola i giorni totali di apertura: preferisci la somma dei giorni mensili se disponibile
  let giorniAperturaTotali = 365; // default per hotel annuali
  const giorniAperturaMensiliTotali = revenues.reduce((sum, revenue) => 
    sum + (revenue.giorniAperturaMese || 0), 0
  );
  
  if (isStagionale) {
    // Se abbiamo i giorni di apertura mensili, usiamo quelli (più precisi)
    if (giorniAperturaMensiliTotali > 0) {
      giorniAperturaTotali = giorniAperturaMensiliTotali;
    } else {
      // Altrimenti usiamo il valore annuale dall'hotel data
      giorniAperturaTotali = hotelData?.giorniApertura || 365;
    }
  } else if (giorniAperturaMensiliTotali > 0) {
    // Anche per hotel annuali, se abbiamo giorni mensili, usiamoli (più precisi)
    giorniAperturaTotali = giorniAperturaMensiliTotali;
  }

  // KPI base (usiamo l'ultimo mese per occupazione e ADR per i calcoli KPI specifici)
  const ultimoMese = revenues[revenues.length - 1];
  const camereTotali = hotelData?.camereTotali || 1;
  const postiLettoTotali = hotelData?.postiLettoTotali || camereTotali; // usa posti letto se disponibili, altrimenti assume 1 posto letto per camera
  
  // Calcola occupazione correttamente usando giorni di apertura invece di giorni del mese
  let occupazione = ultimoMese?.occupazione || 0;
  
  // Se l'occupazione non è fornita o vogliamo ricalcolarla, usiamo i dati disponibili
  // Occupazione = (Presenze / (Posti Letto Totali × Giorni Apertura)) × 100
  if (ultimoMese) {
    const giorniAperturaMese = ultimoMese.giorniAperturaMese || (isStagionale ? Math.floor(giorniAperturaTotali / revenues.length) : 30);
    const presenze = ultimoMese.nottiTotali || 0;
    
    // Calcola occupazione corretta usando giorni di apertura e posti letto
    if (presenze > 0 && postiLettoTotali > 0 && giorniAperturaMese > 0) {
      const occupazioneCalcolata = (presenze / (postiLettoTotali * giorniAperturaMese)) * 100;
      
      // Se l'occupazione fornita è molto diversa da quella calcolata, potrebbe essere errata
      // Usa quella calcolata se la differenza è significativa (>5 punti percentuali)
      if (!ultimoMese.occupazione || Math.abs(occupazioneCalcolata - (ultimoMese.occupazione || 0)) > 5) {
        occupazione = occupazioneCalcolata;
      }
    } else if (ultimoMese.camereVendute && giorniAperturaMese > 0) {
      // Alternativa: usa camere vendute se disponibili
      const camereDisponibiliMese = camereTotali * giorniAperturaMese;
      occupazione = camereDisponibiliMese > 0 ? (ultimoMese.camereVendute / camereDisponibiliMese) * 100 : occupazione;
    }
  }
  
  const adr = ultimoMese?.prezzoMedioCamera || 0;

  // RevPAR = ADR × Occupancy Rate (o Ricavi Camere / Camere Disponibili)
  // Calcola RevPAR usando i giorni di apertura del mese invece di tutti i giorni del mese
  let revpar = 0;
  
  if (ultimoMese?.entrateTotali && camereTotali > 0) {
    // Metodo più accurato: RevPAR = Ricavi Camere / (Camere × Giorni Apertura Mese)
    // Se abbiamo giorniAperturaMese specificato, usalo, altrimenti usa il default corretto
    let giorniAperturaMese = ultimoMese.giorniAperturaMese;
    
    // Se non è specificato, calcolalo in modo intelligente
    if (!giorniAperturaMese || giorniAperturaMese <= 0) {
      if (isStagionale && giorniAperturaTotali > 0 && revenues.length > 0) {
        // Per hotel stagionali: distribuisci i giorni totali tra i mesi
        giorniAperturaMese = Math.floor(giorniAperturaTotali / revenues.length);
      } else {
        // Per hotel annuali: usa giorni effettivi del mese (non sempre 30!)
        const meseYear = ultimoMese.mese.split('-');
        const year = parseInt(meseYear[0]);
        const month = parseInt(meseYear[1]) - 1; // 0-based
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        giorniAperturaMese = daysInMonth; // Assumiamo aperti tutti i giorni del mese per hotel annuali
      }
    }
    
    const camereDisponibiliMese = camereTotali * giorniAperturaMese;
    if (camereDisponibiliMese > 0) {
      revpar = ultimoMese.entrateTotali / camereDisponibiliMese;
    }
  }
  
  // Se non abbiamo entrate totali o RevPAR è ancora 0, usa il metodo ADR × Occupancy
  // Questo metodo è più diretto e spesso più accurato se l'occupazione è calcolata correttamente
  if ((revpar === 0 || !ultimoMese?.entrateTotali) && adr > 0 && occupazione > 0) {
    revpar = (adr * occupazione) / 100;
  }
  
  // Assicurati che RevPAR non sia negativo
  if (revpar < 0) revpar = 0;
  
  // TRevPAR = Total Revenue Per Available Room (ricavi totali hotel / camere disponibili)
  // Camere disponibili = camereTotali × giorni di apertura reali
  const camereDisponibiliTotali = camereTotali * giorniAperturaTotali;
  const trevpar = camereDisponibiliTotali > 0 ? totaleRicaviHotel / camereDisponibiliTotali : 0;

  // CPPR = Total Costs / Total Room Nights
  // Calcola le notti totali da tutti i mesi
  const nottiTotali = revenues.reduce((sum, revenue) => sum + (revenue.nottiTotali || 0), 0);
  
  // Calcola camere vendute totali
  const camereVenduteTotali = revenues.reduce((sum, revenue) => sum + (revenue.camereVendute || 0), 0);
  
  // CPPR = Total Costs / Total Room Nights
  const cppr = nottiTotali > 0 ? totaleSpese / nottiTotali : 0;
  
  // CPOR = Costi Reparto Camere / Camere Vendute
  // Stima costi reparto camere: considera parte di personale, utenze proporzionali, altri costi operativi
  // Per semplicità, assumiamo che ~40% dei costi totali siano relativi al reparto camere
  // (stima conservativa: include pulizia, lavanderia, amenities, parte di utenze e personale)
  const costiRepartoCamere = totaleSpese * 0.4;
  const cpor = camereVenduteTotali > 0 ? costiRepartoCamere / camereVenduteTotali : 0;

  // GOP (Gross Operating Profit) = Revenue - Operating Costs
  const gop = totaleRicavi - totaleSpese;

  // GOP Margin = (GOP / Revenue) × 100
  const gopMargin = totaleRicavi > 0 ? (gop / totaleRicavi) * 100 : 0;

  // Profit per room = GOP / Total Rooms
  const profitPerRoom = gop / camereTotali;
  
  // GOPPAR = Gross Operating Profit Per Available Room
  // Usa i giorni di apertura reali già calcolati sopra
  const goppar = camereDisponibiliTotali > 0 ? gop / camereDisponibiliTotali : 0;
  
  // Calcola costi e ricavi giornalieri medi
  const costiGiornalieriMedi = isStagionale && giorniAperturaTotali > 0 
    ? totaleSpese / giorniAperturaTotali 
    : totaleSpese / 365;
  const ricaviGiornalieriMedi = isStagionale && giorniAperturaTotali > 0
    ? totaleRicavi / giorniAperturaTotali
    : totaleRicavi / 365;

  // ROI (Return on Investment) = (GOP / Total Costs) × 100
  // Se l'hotel è stagionale, normalizziamo rispetto ai giorni di apertura
  let roi: number | undefined;
  if (totaleSpese > 0) {
    if (isStagionale && giorniAperturaTotali > 0) {
      // Per hotel stagionali: normalizziamo i costi e i ricavi ai giorni effettivi
      // ROI stagionale = (Ricavi giornalieri medi - Costi giornalieri medi) / Costi giornalieri medi * 100
      roi = costiGiornalieriMedi > 0 
        ? ((ricaviGiornalieriMedi - costiGiornalieriMedi) / costiGiornalieriMedi) * 100
        : 0;
    } else {
      // Per hotel annuali: ROI standard
      roi = (gop / totaleSpese) * 100;
    }
  }
  
  // CAC = Costo Acquisto Clienti = (Costi Marketing + Commissioni OTA) / Numero Prenotazioni
  const costiMarketingTotali = Array.isArray(costs) 
    ? costs.reduce((sum, mc) => sum + (mc.costs.marketing?.costiMarketing || 0) + (mc.costs.marketing?.commissioniOTA || 0), 0)
    : (totalCostsData.marketing?.costiMarketing || 0) + (totalCostsData.marketing?.commissioniOTA || 0);
  
  const numeroPrenotazioniTotali = revenues.reduce((sum, revenue) => sum + (revenue.numeroPrenotazioni || 0), 0);
  const cac = numeroPrenotazioniTotali > 0 ? costiMarketingTotali / numeroPrenotazioniTotali : undefined;
  
  // ALOS = Average Length of Stay
  // Se non fornito esplicitamente, calcolalo da notti totali / numero prenotazioni
  let alos: number | undefined;
  if (numeroPrenotazioniTotali > 0) {
    // Prova prima a calcolare dalla media dei valori forniti
    const alosValues = revenues.filter(r => r.permanenzaMedia).map(r => r.permanenzaMedia!);
    if (alosValues.length > 0) {
      alos = alosValues.reduce((sum, val) => sum + val, 0) / alosValues.length;
    } else {
      // Calcola da notti totali / numero prenotazioni
      alos = nottiTotali / numeroPrenotazioniTotali;
    }
  }

  return {
    revpar: Math.round(revpar * 100) / 100,
    adr: Math.round(adr * 100) / 100,
    occupazione: Math.round(occupazione * 100) / 100,
    trevpar: Math.round(trevpar * 100) / 100,
    gop: Math.round(gop * 100) / 100,
    gopMargin: Math.round(gopMargin * 100) / 100,
    goppar: Math.round(goppar * 100) / 100,
    cppr: Math.round(cppr * 100) / 100,
    cpor: Math.round(cpor * 100) / 100,
    profitPerRoom: Math.round(profitPerRoom * 100) / 100,
    totaleSpese: Math.round(totaleSpese * 100) / 100,
    totaleRicavi: Math.round(totaleRicavi * 100) / 100,
    roi: roi !== undefined ? Math.round(roi * 100) / 100 : undefined,
    cac: cac !== undefined ? Math.round(cac * 100) / 100 : undefined,
    alos: alos !== undefined ? Math.round(alos * 100) / 100 : undefined,
    costiGiornalieriMedi: isStagionale ? Math.round(costiGiornalieriMedi * 100) / 100 : undefined,
    ricaviGiornalieriMedi: isStagionale ? Math.round(ricaviGiornalieriMedi * 100) / 100 : undefined,
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

  // Marketing
  if (costs.marketing) {
    totale += (costs.marketing.costiMarketing || 0);
    totale += (costs.marketing.commissioniOTA || 0);
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
  // Benchmark base per hotel medio
  const baseBenchmark = {
    ristorazione: 15000, // €/mese per hotel medio
    utenze: 5000,
    personale: 35000,
  };

  // Per hotel stagionali, i benchmark possono essere adeguati ai giorni di apertura
  // ma per ora manteniamo i valori base standard
  return baseBenchmark;
}

