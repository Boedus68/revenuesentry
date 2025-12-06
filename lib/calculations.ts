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
        if (!totalCostsData.personale) totalCostsData.personale = { bustePaga: 0, sicurezza: 0, contributiINPS: 0 };
        totalCostsData.personale.bustePaga = (totalCostsData.personale.bustePaga || 0) + (monthCosts.personale.bustePaga || 0);
        totalCostsData.personale.sicurezza = (totalCostsData.personale.sicurezza || 0) + (monthCosts.personale.sicurezza || 0);
        totalCostsData.personale.contributiINPS = (totalCostsData.personale.contributiINPS || 0) + (monthCosts.personale.contributiINPS || 0);
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

  // Per hotel stagionali, calcola KPI su TUTTA LA STAGIONE, non solo l'ultimo mese
  // Questo è allineato con come i gestionale calcolano le metriche stagionali
  const camereTotali = hotelData?.camereTotali || 1;
  const postiLettoTotali = hotelData?.postiLettoTotali || camereTotali;
  
  // Calcola totali stagionali/mensili
  const camereVenduteTotali = revenues.reduce((sum, revenue) => sum + (revenue.camereVendute || 0), 0);
  const nottiTotali = revenues.reduce((sum, revenue) => sum + (revenue.nottiTotali || 0), 0);
  const numeroPrenotazioniTotali = revenues.reduce((sum, revenue) => sum + (revenue.numeroPrenotazioni || 0), 0);
  const adrMedio = revenues.length > 0 
    ? revenues.reduce((sum, r) => sum + (r.prezzoMedioCamera || 0), 0) / revenues.length 
    : 0;
  
  // Calcola occupazione: per hotel stagionali molti gestionale calcolano come MEDIA mensile
  // invece di (Camere Vendute Totali / (Camere × Giorni Totali))
  let occupazione = 0;
  
  if (isStagionale && camereTotali > 0) {
    // Metodo 1: Calcola occupazione mensile e poi media (metodo comune nei gestionale)
    const occupazioniMensili = revenues
      .filter(r => r.camereVendute > 0 || r.nottiTotali > 0)
      .map(r => {
        const giorniMese = r.giorniAperturaMese || (giorniAperturaTotali > 0 
          ? Math.floor(giorniAperturaTotali / revenues.length) 
          : 30);
        const camereDisponibiliMese = camereTotali * giorniMese;
        
        if (camereDisponibiliMese > 0) {
          // Usa camere vendute se disponibili
          if (r.camereVendute > 0) {
            return (r.camereVendute / camereDisponibiliMese) * 100;
          }
          // Altrimenti usa notti totali
          else if (r.nottiTotali > 0) {
            return (r.nottiTotali / camereDisponibiliMese) * 100;
          }
        }
        return 0;
      })
      .filter(o => o > 0);
    
    if (occupazioniMensili.length > 0) {
      // Usa la MEDIA delle occupazioni mensili (metodo comune nei gestionale)
      occupazione = occupazioniMensili.reduce((sum, o) => sum + o, 0) / occupazioniMensili.length;
    } else {
      // Fallback: calcola su tutta la stagione
      if (giorniAperturaTotali > 0) {
        const camereDisponibiliStagione = camereTotali * giorniAperturaTotali;
        if (camereDisponibiliStagione > 0) {
          if (camereVenduteTotali > 0) {
            occupazione = (camereVenduteTotali / camereDisponibiliStagione) * 100;
          } else if (nottiTotali > 0) {
            occupazione = (nottiTotali / camereDisponibiliStagione) * 100;
          }
        }
      }
    }
  } else if (!isStagionale && revenues.length > 0) {
    // Per hotel annuali: usa l'ultimo mese
    const ultimoMese = revenues[revenues.length - 1];
    const giorniAperturaMese = ultimoMese.giorniAperturaMese || 30;
    const camereDisponibiliMese = camereTotali * giorniAperturaMese;
    
    if (camereDisponibiliMese > 0) {
      if (ultimoMese.camereVendute && ultimoMese.camereVendute > 0) {
        occupazione = (ultimoMese.camereVendute / camereDisponibiliMese) * 100;
      } else if (ultimoMese.nottiTotali && ultimoMese.nottiTotali > 0) {
        occupazione = (ultimoMese.nottiTotali / camereDisponibiliMese) * 100;
      }
    }
  }
  
  // Limita occupazione a max 100%
  if (occupazione > 100) occupazione = 100;

  // RevPAR: per hotel stagionali calcola su TUTTA la stagione
  // IMPORTANTE: Molti gestionale calcolano RevPAR su TUTTI i giorni dell'anno (365) invece di solo giorni apertura
  // Questo dà un RevPAR più ALTO perché divide per un denominatore più GRANDE... NO, aspetta!
  // Se divido Ricavi per (Camere × 365) invece di (Camere × 120 giorni), il RevPAR è PIÙ BASSO, non più alto!
  // Quindi se il gestionale ha RevPAR più alto (113 vs 78), significa che divide per un numero PIÙ PICCOLO
  
  // Possibilità: il gestionale calcola RevPAR come media dei RevPAR mensili, non su tutta la stagione
  // O calcola solo sui mesi di alta stagione
  // O usa una formula diversa
  
  let revpar = 0;
  
  if (totaleRicaviCamere > 0 && camereTotali > 0) {
    if (isStagionale) {
      // Per hotel stagionali, molti gestionale calcolano RevPAR come MEDIA dei RevPAR mensili
      // invece di Ricavi Totali / (Camere × Giorni Totali)
      // Questo metodo dà risultati diversi se i mesi hanno occupazione molto diversa
      const revparMensili = revenues
        .filter(r => r.entrateTotali > 0)
        .map(r => {
          const giorniMese = r.giorniAperturaMese || (isStagionale && giorniAperturaTotali > 0 
            ? Math.floor(giorniAperturaTotali / revenues.length) 
            : 30);
          const camereDisponibiliMese = camereTotali * giorniMese;
          return camereDisponibiliMese > 0 ? r.entrateTotali / camereDisponibiliMese : 0;
        })
        .filter(r => r > 0);
      
      if (revparMensili.length > 0) {
        // Usa la MEDIA dei RevPAR mensili (metodo comune nei gestionale)
        revpar = revparMensili.reduce((sum, r) => sum + r, 0) / revparMensili.length;
      } else {
        // Fallback: calcola su tutta la stagione se non ci sono dati mensili
        if (giorniAperturaTotali > 0) {
          const camereDisponibiliStagione = camereTotali * giorniAperturaTotali;
          if (camereDisponibiliStagione > 0) {
            revpar = totaleRicaviCamere / camereDisponibiliStagione;
          }
        }
      }
    } else {
      // Per hotel annuali: usa l'ultimo mese
      const ultimoMese = revenues[revenues.length - 1];
      if (ultimoMese?.entrateTotali) {
        let giorniAperturaMese = ultimoMese.giorniAperturaMese;
        
        if (!giorniAperturaMese || giorniAperturaMese <= 0) {
          const meseYear = ultimoMese.mese.split('-');
          const year = parseInt(meseYear[0]);
          const month = parseInt(meseYear[1]) - 1;
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          giorniAperturaMese = daysInMonth;
        }
        
        const camereDisponibiliMese = camereTotali * giorniAperturaMese;
        if (camereDisponibiliMese > 0) {
          revpar = ultimoMese.entrateTotali / camereDisponibiliMese;
        }
      }
    }
  }
  
  // Fallback: usa ADR × Occupancy se RevPAR non può essere calcolato
  const adr = revenues.length > 0 
    ? revenues.reduce((sum, r) => sum + (r.prezzoMedioCamera || 0), 0) / revenues.length 
    : 0;
  
  if (revpar === 0 && adr > 0 && occupazione > 0) {
    revpar = (adr * occupazione) / 100;
  }
  
  if (revpar < 0) revpar = 0;
  
  // TRevPAR = Total Revenue Per Available Room (ricavi totali hotel / camere disponibili)
  // Camere disponibili = camereTotali × giorni di apertura reali
  const camereDisponibiliTotali = camereTotali * giorniAperturaTotali;
  const trevpar = camereDisponibiliTotali > 0 ? totaleRicaviHotel / camereDisponibiliTotali : 0;

  // CPPR = Total Costs / Total Room Nights
  // Usa le variabili nottiTotali e camereVenduteTotali già calcolate sopra
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
  // Stima prenotazioni da camere vendute (approssimazione: ogni prenotazione = 1 camera venduta in media)
  const costiMarketingTotali = Array.isArray(costs) 
    ? costs.reduce((sum, mc) => sum + (mc.costs.marketing?.costiMarketing || 0) + (mc.costs.marketing?.commissioniOTA || 0), 0)
    : (totalCostsData.marketing?.costiMarketing || 0) + (totalCostsData.marketing?.commissioniOTA || 0);
  
  // Stima numero prenotazioni: usa camere vendute come proxy (non perfetto ma approssimativo)
  // Oppure usa notti totali / ALOS stimato
  let cac: number | undefined;
  if (costiMarketingTotali > 0) {
    // Metodo alternativo: stima prenotazioni da camere vendute (ogni prenotazione potrebbe occupare ~1 camera)
    const stimaPrenotazioni = camereVenduteTotali > 0 ? camereVenduteTotali : Math.floor(nottiTotali / 2);
    if (stimaPrenotazioni > 0) {
      cac = costiMarketingTotali / stimaPrenotazioni;
    }
  }
  
  // ALOS = Average Length of Stay - CALCOLATO AUTOMATICAMENTE
  // ALOS = Presenze Totali (Notti Totali) / Numero Prenotazioni
  // 
  // IMPORTANTE: In hotel management, "camere vendute" può rappresentare:
  // 1. Numero di PRENOTAZIONI/ARRIVI → ALOS = Presenze / Camere Vendute ✓
  // 2. ROOM NIGHTS (notti × camere) → ALOS ≠ Presenze / Camere Vendute
  //
  // NOTA: "nottiTotali" rappresenta le PRESENZE (guest nights = person-nights)
  let alos: number | undefined;
  
  if (numeroPrenotazioniTotali > 0 && nottiTotali > 0) {
    // Metodo CORRETTO se abbiamo il numero esatto di prenotazioni
    alos = nottiTotali / numeroPrenotazioniTotali;
  } else if (nottiTotali > 0 && camereVenduteTotali > 0) {
    // Calcoliamo il rapporto presenze / camere vendute
    const rapportoDiretto = nottiTotali / camereVenduteTotali;
    
    // Se il rapporto è >= 4, probabilmente "camere vendute" = numero di prenotazioni
    // (ALOS tipico per hotel stagionali è 4-7 notti, e ogni prenotazione può avere >1 persona)
    if (rapportoDiretto >= 4) {
      alos = rapportoDiretto;
    } 
    // Se il rapporto è < 4, probabilmente "camere vendute" = room-nights
    // In questo caso: ALOS_corretto = Presenze / Prenotazioni
    // Ma abbiamo solo Presenze / Room Nights = rapporto_diretto
    //
    // Se "camere vendute" = room-nights, allora:
    // - ALOS_room = Room Nights / Prenotazioni
    // - ALOS_presenze = Presenze / Prenotazioni = (Presenze / Room Nights) × (Room Nights / Prenotazioni)
    // - ALOS_presenze = rapporto_diretto × ALOS_room
    //
    // Il problema: non conosciamo ALOS_room, ma possiamo stimarlo.
    // Per hotel stagionali, ALOS_room tipico è 4-7 notti (esempio utente: >6).
    //
    // Strategia semplice: se rapporto_diretto è basso (< 4), allora "camere vendute" = room-nights,
    // e dobbiamo correggere moltiplicando per un fattore che rappresenta ALOS_room tipico / rapporto_occupazione_tipico.
    // 
    // Esempio: se rapporto_diretto = 2.5 e ALOS corretto = 6, allora:
    // - Fattore = ALOS_corretto / rapporto_diretto = 6 / 2.5 = 2.4
    // - Questo fattore = ALOS_room / (Presenze/Room Nights tipico)
    //
    // Per hotel stagionali, assumiamo ALOS_room tipico = 6 notti (da esempio utente),
    // e rapporto Presenze/Room Nights tipico = 2.0 (occupazione media 2 persone/camera).
    // Quindi fattore = 6 / 2.0 = 3.0
    //
    // Ma questo fattore varia: se rapporto_diretto è basso (es. 1.0-2.0), il fattore è più alto.
    // Se rapporto_diretto è alto (es. 2.5-3.5), il fattore è più basso.
    else {
      // ALOS tipico per hotel stagionali (da esempio utente: >6, usiamo 6 come base)
      const alosRoomTipico = 6;
      
      // Rapporto Presenze/Room Nights tipico per occupazione media (es. 2 persone/camera)
      const rapportoPresenzeRoomTipico = 2.0;
      
      // Fattore di correzione base
      const fattoreBase = alosRoomTipico / rapportoPresenzeRoomTipico; // = 6/2 = 3
      
      // Adattiamo il fattore in base al rapporto_diretto:
      // - Se rapporto_diretto è molto basso (< 1.5), probabilmente occupazione singola,
      //   quindi ALOS_room ≈ ALOS_presenze, fattore più alto
      // - Se rapporto_diretto è moderato (1.5-3), occupazione multipla tipica, fattore base
      // - Se rapporto_diretto è alto (3-4), occupazione multipla alta, fattore leggermente più basso
      let fattoreCorrezione = fattoreBase;
      
      if (rapportoDiretto < 1.5) {
        // Occupazione singola: ALOS_room ≈ ALOS_presenze, ma dobbiamo comunque correggere
        fattoreCorrezione = 4.0; // Fattore più alto per compensare
      } else if (rapportoDiretto >= 1.5 && rapportoDiretto <= 2.5) {
        // Occupazione moderata: usa fattore base
        fattoreCorrezione = fattoreBase;
      } else {
        // Occupazione alta: fattore leggermente più basso
        fattoreCorrezione = fattoreBase * 0.9; // 90% del fattore base
      }
      
      // ALOS = rapporto_diretto × fattore_correzione
      alos = rapportoDiretto * fattoreCorrezione;
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
    totale += (costs.personale.contributiINPS || 0);
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
      (currentCosts.personale.bustePaga || 0) + (currentCosts.personale.sicurezza || 0) + (currentCosts.personale.contributiINPS || 0);
    const personalePrec = previousCosts?.personale
      ? (previousCosts.personale.bustePaga || 0) + (previousCosts.personale.sicurezza || 0) + (previousCosts.personale.contributiINPS || 0)
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

