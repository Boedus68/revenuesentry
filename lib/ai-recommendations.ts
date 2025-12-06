// Sistema di Raccomandazioni IA per Ottimizzazione Costi e Profitti

import { CostsData, RevenueData, KPIData, CostAnalysis, Recommendation, HotelData, Alert } from './types';
import { calculateTotalCosts, analyzeCosts, getBenchmarkValues } from './calculations';

/**
 * Genera raccomandazioni IA avanzate basate su analisi completa dei costi, performance e KPI
 */
export function generateRecommendations(
  costs: Partial<CostsData>,
  revenues: RevenueData[],
  kpi: KPIData,
  costAnalyses: CostAnalysis[],
  hotelData?: HotelData
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const totaleSpese = calculateTotalCosts(costs);
  const isStagionale = hotelData?.tipoHotel === 'stagionale';
  const camereTotali = hotelData?.camereTotali || 1;

  // ==========================================
  // 1. ANALISI REVENUE MANAGEMENT (RevPAR, ADR, Occupazione)
  // ==========================================

  // RevPAR vs Benchmark
  const benchmarkRevpar = 60; // Benchmark settore medio-alto
  if (kpi.revpar > 0 && kpi.revpar < benchmarkRevpar * 0.7) {
    const gap = benchmarkRevpar - kpi.revpar;
    recommendations.push({
      id: 'revpar-sotto-benchmark',
      categoria: 'Revenue Management',
      titolo: `RevPAR ${((gap / kpi.revpar) * 100).toFixed(1)}% sotto il benchmark di settore`,
      descrizione: `Il tuo RevPAR (€${kpi.revpar.toFixed(2)}) indica un potenziale di miglioramento significativo. Il benchmark per strutture simili è €${benchmarkRevpar}. Analizza se il problema è nell'ADR o nell'occupazione.`,
      impattoStimato: Math.round(camereTotali * gap * 365 * 0.15), // 15% del potenziale gap annuale
      difficolta: 'media',
      priorita: 'alta',
      azioni: [
        `Se occupazione <70%: migliora strategia pricing e marketing per aumentare occupazione`,
        `Se ADR basso: rivaluta posizionamento, aggiungi servizi a valore, ottimizza mix clienti`,
        'Analizza competitor pricing nella tua area',
        'Implementa pricing dinamico basato su domanda',
        'Valuta pacchetti e offerte per aumentare valore percepito',
      ],
      evidenze: [
        `RevPAR attuale: €${kpi.revpar.toFixed(2)}`,
        `Benchmark settore: €${benchmarkRevpar}`,
        `ADR: €${kpi.adr.toFixed(2)}`,
        `Occupazione: ${kpi.occupazione.toFixed(1)}%`,
      ],
    });
  }

  // Analisi equilibrio ADR vs Occupazione
  if (kpi.adr > 0 && kpi.occupazione > 0) {
    const rapportoAdrOccupazione = kpi.adr / (kpi.occupazione / 100);
    if (rapportoAdrOccupazione > 200) {
      // ADR molto alto ma occupazione bassa - strategia premium potrebbe essere troppo aggressiva
      recommendations.push({
        id: 'strategia-pricing-aggressiva',
        categoria: 'Revenue Management',
        titolo: 'Strategia pricing troppo aggressiva: occupazione sacrificata per ADR',
        descrizione: `Hai un ADR elevato (€${kpi.adr.toFixed(2)}) ma occupazione bassa (${kpi.occupazione.toFixed(1)}%). Considera di abbassare leggermente i prezzi per aumentare occupazione e massimizzare RevPAR.`,
        impattoStimato: Math.round(kpi.totaleRicavi * 0.12), // Potenziale aumento del 12%
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'Testa riduzioni di prezzo del 5-10% nei periodi low-season',
          'Monitora RevPAR dopo ogni modifica di pricing',
          'Analizza elasticità della domanda al prezzo',
          'Crea offerte last-minute per riempire camere',
        ],
        evidenze: [
          `ADR: €${kpi.adr.toFixed(2)} (alto)`,
          `Occupazione: ${kpi.occupazione.toFixed(1)}% (bassa)`,
          `Rapporto ADR/Occupazione: ${rapportoAdrOccupazione.toFixed(0)} (target: <150)`,
        ],
      });
    } else if (rapportoAdrOccupazione < 80) {
      // Occupazione alta ma ADR basso - potenziale per aumentare prezzi
      recommendations.push({
        id: 'potenziale-aumento-prezz',
        categoria: 'Revenue Management',
        titolo: 'Potenziale per aumentare ADR: alta occupazione consente prezzi più alti',
        descrizione: `Hai una buona occupazione (${kpi.occupazione.toFixed(1)}%) ma ADR relativamente basso (€${kpi.adr.toFixed(2)}). Questo indica che potresti aumentare i prezzi senza perdere troppa occupazione.`,
        impattoStimato: Math.round(kpi.totaleRicavi * 0.08), // Potenziale aumento dell'8%
        difficolta: 'facile',
        priorita: 'media',
        azioni: [
          'Aumenta prezzi del 5-10% gradualmente',
          'Aggiungi servizi a valore (colazione, wifi premium)',
          'Riduci sconti e promozioni aggressive',
          'Migliora percezione qualità per giustificare prezzi più alti',
        ],
        evidenze: [
          `ADR: €${kpi.adr.toFixed(2)} (basso rispetto all'occupazione)`,
          `Occupazione: ${kpi.occupazione.toFixed(1)}% (buona)`,
          `Rapporto ADR/Occupazione: ${rapportoAdrOccupazione.toFixed(0)} (target: 100-150)`,
        ],
      });
    }
  }

  // ==========================================
  // 2. ANALISI TRevPAR (Total Revenue Per Available Room)
  // ==========================================

  if (kpi.trevpar && kpi.trevpar > 0) {
    const rapportoTrevparRevpar = kpi.trevpar / kpi.revpar;
    const targetTrevparRatio = 1.3; // TRevPAR dovrebbe essere ~30% superiore a RevPAR

    if (rapportoTrevparRevpar < 1.1) {
      // TRevPAR troppo vicino a RevPAR - non si stanno sfruttando altri servizi
      recommendations.push({
        id: 'trevpar-basso-servizi-aggiuntivi',
        categoria: 'Revenue Mix',
        titolo: 'Ricavi aggiuntivi sotto potenziale: sfrutta meglio F&B e servizi',
        descrizione: `Il tuo TRevPAR (€${kpi.trevpar.toFixed(2)}) è troppo vicino al RevPAR (€${kpi.revpar.toFixed(2)}). Questo indica che non stai sfruttando appieno i ricavi da ristorazione e servizi aggiuntivi. Hotel di successo generano TRevPAR del 30-50% superiore al RevPAR.`,
        impattoStimato: Math.round((kpi.trevpar * camereTotali * 365 * 0.25) * 0.3), // 30% del gap potenziale
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'Migliora proposte ristorazione (colazioni, cene, room service)',
          'Promuovi servizi spa, wellness, attività ricreative',
          'Crea pacchetti che includono servizi aggiuntivi',
          'Aumenta vendita incrociata (cross-selling) al check-in',
          'Analizza spesa media ospite per servizi aggiuntivi',
          'Valuta partnership con attività locali (escursioni, eventi)',
        ],
        evidenze: [
          `TRevPAR: €${kpi.trevpar.toFixed(2)}`,
          `RevPAR: €${kpi.revpar.toFixed(2)}`,
          `Rapporto TRevPAR/RevPAR: ${(rapportoTrevparRevpar * 100).toFixed(0)}% (target: 130-150%)`,
        ],
      });
    }
  }

  // ==========================================
  // 3. ANALISI GOPPAR (Gross Operating Profit Per Available Room)
  // ==========================================

  if (kpi.goppar && kpi.goppar > 0) {
    const benchmarkGoppar = 40; // Benchmark settore
    if (kpi.goppar < benchmarkGoppar * 0.7) {
      recommendations.push({
        id: 'goppar-sotto-benchmark',
        categoria: 'Profitability',
        titolo: `GOPPAR ${((benchmarkGoppar - kpi.goppar) / benchmarkGoppar * 100).toFixed(1)}% sotto benchmark`,
        descrizione: `Il tuo GOPPAR (€${kpi.goppar.toFixed(2)}) indica margini operativi sotto il target del settore (€${benchmarkGoppar}). Questo è l'indicatore più importante: mostra quanto profitto generi per ogni camera disponibile.`,
        impattoStimato: Math.round((benchmarkGoppar - kpi.goppar) * camereTotali * 365 * 0.2), // 20% del gap potenziale
        difficolta: 'complessa',
        priorita: kpi.goppar < benchmarkGoppar * 0.5 ? 'critica' : 'alta',
        azioni: [
          'Combina ottimizzazione ricavi (aumenta TRevPAR) e riduzione costi',
          'Analizza costi per reparto (costi camere, ristorazione, servizi)',
          'Valuta se alcuni servizi sono redditizi o devono essere ottimizzati',
          'Migliora efficienza operativa per ridurre costi senza impattare qualità',
          'Rivedi mix servizi: elimina quelli non redditizi, potenzia quelli profittevoli',
        ],
        evidenze: [
          `GOPPAR: €${kpi.goppar.toFixed(2)}`,
          `Benchmark settore: €${benchmarkGoppar}`,
          `GOP Margin: ${kpi.gopMargin.toFixed(1)}%`,
          `GOP totale: €${kpi.gop.toLocaleString('it-IT')}`,
        ],
      });
    }
  }

  // ==========================================
  // 4. ANALISI CPOR (Cost Per Occupied Room)
  // ==========================================

  if (kpi.cpor && kpi.cpor > 0) {
    const targetCporPercent = 0.25; // CPOR dovrebbe essere ~25% dell'ADR
    const rapportoCporAdr = kpi.cpor / kpi.adr;

    if (rapportoCporAdr > 0.35) {
      recommendations.push({
        id: 'cpor-alto-costi-camere',
        categoria: 'Costi Operativi',
        titolo: 'Costi per camera occupata troppo elevati',
        descrizione: `Il tuo CPOR (€${kpi.cpor.toFixed(2)}) è ${((rapportoCporAdr * 100)).toFixed(0)}% dell'ADR. Target ottimale: <25%. I costi per servire una camera occupata stanno erodendo i margini.`,
        impattoStimato: Math.round(kpi.cpor * 0.2 * (kpi.occupazione / 100) * camereTotali * 365), // 20% riduzione CPOR
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'Ottimizza costi pulizia e lavanderia (considera outsourcing o contratti migliori)',
          'Riduci sprechi di amenities (shampoo, saponi, asciugamani)',
          'Analizza costi personale housekeeping: efficienza vs. qualità',
          'Valuta uso di tecnologie (IoT) per ottimizzare consumo utenze per camera',
          'Negozia contratti migliori per fornitori reparto camere',
        ],
        evidenze: [
          `CPOR: €${kpi.cpor.toFixed(2)}`,
          `ADR: €${kpi.adr.toFixed(2)}`,
          `Rapporto CPOR/ADR: ${(rapportoCporAdr * 100).toFixed(1)}% (target: <25%)`,
        ],
      });
    }
  }

  // ==========================================
  // 5. ANALISI CAC (Cost of Customer Acquisition)
  // ==========================================

  if (kpi.cac && kpi.cac > 0) {
    const targetCacPercent = 0.15; // CAC dovrebbe essere ~15% dell'ADR
    const rapportoCacAdr = kpi.cac / kpi.adr;

    if (rapportoCacAdr > 0.25) {
      recommendations.push({
        id: 'cac-alto-acquisizione-clienti',
        categoria: 'Marketing & Sales',
        titolo: 'Costo acquisizione clienti troppo elevato',
        descrizione: `Stai spendendo €${kpi.cac.toFixed(2)} per acquisire ogni prenotazione, che rappresenta ${(rapportoCacAdr * 100).toFixed(0)}% dell'ADR. Target ottimale: <15%. Questo erode significativamente i margini.`,
        impattoStimato: Math.round(kpi.cac * 0.3 * (revenues.reduce((s, r) => s + (r.numeroPrenotazioni || 0), 0))), // 30% riduzione CAC
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'Aumenta prenotazioni dirette (website, telefono) per ridurre commissioni OTA',
          'Implementa programma fedeltà per incentivare prenotazioni dirette',
          'Ottimizza mix canali: riduci dipendenza da OTA costose, aumenta canali diretti',
          'Negozia commissioni OTA migliori o considera canali alternativi',
          'Investi in marketing digitale organico (SEO, content marketing)',
          'Crea offerte esclusive per prenotazioni dirette',
        ],
        evidenze: [
          `CAC: €${kpi.cac.toFixed(2)}`,
          `ADR: €${kpi.adr.toFixed(2)}`,
          `Rapporto CAC/ADR: ${(rapportoCacAdr * 100).toFixed(1)}% (target: <15%)`,
          `Costi marketing totali: €${((kpi.cac || 0) * revenues.reduce((s, r) => s + (r.numeroPrenotazioni || 0), 0)).toLocaleString('it-IT')}`,
        ],
      });
    } else if (rapportoCacAdr < 0.08) {
      // CAC molto basso potrebbe indicare sottosviluppo marketing
      recommendations.push({
        id: 'potenziale-sviluppo-marketing',
        categoria: 'Marketing & Sales',
        titolo: 'Potenziale per investire di più in marketing: CAC molto efficiente',
        descrizione: `Il tuo CAC (€${kpi.cac.toFixed(2)}) è molto efficiente. Potresti aumentare gli investimenti in marketing per crescere più rapidamente senza impattare negativamente i margini.`,
        impattoStimato: Math.round(kpi.totaleRicavi * 0.1), // Potenziale crescita del 10%
        difficolta: 'media',
        priorita: 'media',
        azioni: [
          'Aumenta budget marketing del 20-30% gradualmente',
          'Espandi presenza su canali digitali (social media, Google Ads)',
          'Investi in content marketing e SEO per aumentare visibilità',
          'Crea campagne stagionali mirate',
          'Monitora ROI marketing per ottimizzare continuamente',
        ],
        evidenze: [
          `CAC: €${kpi.cac.toFixed(2)} (molto efficiente)`,
          `Rapporto CAC/ADR: ${(rapportoCacAdr * 100).toFixed(1)}% (target: 15%)`,
        ],
      });
    }
  }

  // ==========================================
  // 6. ANALISI ALOS (Average Length of Stay)
  // ==========================================

  if (kpi.alos && kpi.alos > 0) {
    const targetAlos = isStagionale ? 4 : 2.5; // Hotel stagionali tipicamente hanno ALOS più alto
    
    if (kpi.alos < targetAlos * 0.7) {
      recommendations.push({
        id: 'alos-basso-permanenza',
        categoria: 'Revenue Management',
        titolo: 'Permanenza media troppo bassa: opportunità per aumentare ricavi',
        descrizione: `La tua permanenza media (${kpi.alos.toFixed(1)} notti) è sotto il target per hotel ${isStagionale ? 'stagionali' : 'annuali'} (${targetAlos} notti). Una permanenza più lunga riduce costi di acquisizione e aumenta ricavi totali per ospite.`,
        impattoStimato: Math.round(kpi.adr * (targetAlos - kpi.alos) * 0.3 * (revenues.reduce((s, r) => s + (r.numeroPrenotazioni || 0), 0))), // 30% del potenziale
        difficolta: 'media',
        priorita: 'media',
        azioni: [
          'Offri sconti per prenotazioni di 3+ notti',
          'Crea pacchetti weekend o settimanali',
          'Promuovi attività locali per incentivare estensioni soggiorno',
          'Offri upgrade o servizi gratuiti per soggiorni più lunghi',
          'Migliora esperienza ospite per aumentare soddisfazione e durata soggiorno',
          'Implementa programmi "stay another night" con offerte speciali',
        ],
        evidenze: [
          `ALOS: ${kpi.alos.toFixed(1)} notti`,
          `Target: ${targetAlos} notti`,
          `Numero prenotazioni: ${revenues.reduce((s, r) => s + (r.numeroPrenotazioni || 0), 0)}`,
        ],
      });
    }
  }

  // ==========================================
  // 7. ANALISI ROI (Return on Investment)
  // ==========================================

  if (kpi.roi !== undefined) {
    const targetRoi = 15; // ROI target per hotel di successo
    
    if (kpi.roi < targetRoi) {
      recommendations.push({
        id: 'roi-sotto-target',
        categoria: 'Profitability',
        titolo: `ROI ${(targetRoi - kpi.roi).toFixed(1)}% sotto il target`,
        descrizione: `Il tuo ROI (${kpi.roi.toFixed(1)}%) indica che la redditività rispetto all'investimento è sotto il target del settore (${targetRoi}%). ${isStagionale ? 'Per hotel stagionali, è cruciale massimizzare la redditività nei giorni di apertura.' : 'Ottimizza sia ricavi che costi per migliorare il ritorno.'}`,
        impattoStimato: Math.round(totaleSpese * ((targetRoi - kpi.roi) / 100) * 0.5), // 50% del gap potenziale
        difficolta: 'complessa',
        priorita: kpi.roi < 5 ? 'critica' : kpi.roi < 10 ? 'alta' : 'media',
        azioni: [
          'Combina tutte le ottimizzazioni: aumentare ricavi e ridurre costi',
          isStagionale ? 'Massimizza ricavi per giorno di apertura: strategia pricing aggressiva nei picchi' : 'Focus su stagioni alta/media per massimizzare ricavi',
          'Valuta investimenti con ROI positivo (automazioni, efficienza energetica)',
          'Analizza asset utilization: stai usando al meglio tutte le risorse?',
          'Considera diversificazione ricavi (nuovi servizi, partnership)',
        ],
        evidenze: [
          `ROI: ${kpi.roi.toFixed(1)}%`,
          `Target settore: ${targetRoi}%`,
          `GOP: €${kpi.gop.toLocaleString('it-IT')}`,
          `Costi totali: €${totaleSpese.toLocaleString('it-IT')}`,
          isStagionale && hotelData?.giorniApertura ? `Giorni apertura: ${hotelData.giorniApertura}` : '',
        ].filter(Boolean),
      });
    }
  }

  // ==========================================
  // 8. ANALISI COSTI DETTAGLIATA (già esistente ma espansa)
  // ==========================================

  // Analisi anomalie costi (mantenuta dalla versione precedente)
  costAnalyses.forEach((analysis) => {
    if (analysis.anomalia) {
      if (analysis.trend === 'incremento' && analysis.variazionePercentuale && analysis.variazionePercentuale > 20) {
        recommendations.push({
          id: `anomalia-${analysis.categoria.toLowerCase().replace(/\s+/g, '-')}`,
          categoria: analysis.categoria,
          titolo: `Spesa ${analysis.categoria} aumentata del ${Math.round(analysis.variazionePercentuale)}%`,
          descrizione: `Rilevato un aumento significativo nella categoria ${analysis.categoria}. Analizza le cause e valuta alternative.`,
          impattoStimato: Math.round(analysis.importoAttuale * 0.15),
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Verifica contratti con fornitori attuali',
            'Richiedi preventivi da fornitori alternativi',
            'Analizza consumo vs. periodo precedente',
            'Valuta rinegoziazione contratti',
            'Identifica se l\'aumento è dovuto a volumi o a prezzi',
          ],
          evidenze: [
            `Variazione: +${Math.round(analysis.variazionePercentuale)}% rispetto al mese precedente`,
            `Importo attuale: €${analysis.importoAttuale.toLocaleString('it-IT')}`,
            analysis.importoMesePrecedente ? `Importo precedente: €${analysis.importoMesePrecedente.toLocaleString('it-IT')}` : '',
          ].filter(Boolean),
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
          impattoStimato: Math.round(Math.abs(analysis.differenzaBenchmark) * 0.2),
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Confronta con benchmark di settore',
            'Identifica aree di inefficienza',
            'Valuta ottimizzazione processi',
            'Considera investimenti in tecnologie efficienti',
            'Analizza best practices di hotel simili',
          ],
          evidenze: [
            `Benchmark settore: €${analysis.benchmarkSettore.toLocaleString('it-IT')}`,
            `Tuo valore: €${analysis.importoAttuale.toLocaleString('it-IT')}`,
            `Differenza: €${Math.abs(analysis.differenzaBenchmark).toLocaleString('it-IT')}`,
          ],
        });
      }
    }
  });

  // Analisi GOP e margini (migliorata)
  if (kpi.gopMargin < 20) {
    recommendations.push({
      id: 'gop-margin-basso',
      categoria: 'Profitability',
      titolo: 'Margine GOP sotto il target raccomandato',
      descrizione: `Il tuo margine GOP è ${kpi.gopMargin.toFixed(1)}%. L'obiettivo per hotel di successo è >25%. Un margine basso indica che i costi stanno erodendo i ricavi o che i prezzi sono troppo bassi.`,
      impattoStimato: Math.round(kpi.totaleRicavi * 0.05),
      difficolta: 'complessa',
      priorita: kpi.gopMargin < 10 ? 'critica' : 'alta',
      azioni: [
        'Rivedi strategia pricing: c\'è spazio per aumentare prezzi?',
        'Ottimizza costi operativi: identifica e elimina sprechi',
        'Aumenta occupazione media se possibile',
        'Migliora mix di servizi offerti: focus su servizi ad alto margine',
        'Analizza costo per reparto e identifica inefficienze',
      ],
      evidenze: [
        `Margine GOP attuale: ${kpi.gopMargin.toFixed(1)}%`,
        `Target settore: 25-35%`,
        `GOP: €${kpi.gop.toLocaleString('it-IT')}`,
        `Ricavi totali: €${kpi.totaleRicavi.toLocaleString('it-IT')}`,
      ],
    });
  }

  // ==========================================
  // 11. ANALISI RISTORAZIONE DETTAGLIATA
  // ==========================================

  if (costs.ristorazione) {
    const totaleRistorazione = costs.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
    const fornitoriAttivi = costs.ristorazione.filter((item) => item.importo > 0).length;
    const ricaviRistorazione = revenues.reduce((sum, r) => sum + (r.ricaviRistorazione || 0), 0);
    
    // Analisi food cost percentage (best practice: 25-35% per hotel)
    if (ricaviRistorazione > 0 && totaleRistorazione > 0) {
      const foodCostPercent = (totaleRistorazione / ricaviRistorazione) * 100;
      
      if (foodCostPercent > 40) {
        recommendations.push({
          id: 'food-cost-alto',
          categoria: 'Ristorazione',
          titolo: `Food Cost troppo elevato: ${foodCostPercent.toFixed(1)}% (target: 25-35%)`,
          descrizione: `Il tuo food cost è del ${foodCostPercent.toFixed(1)}%, significativamente sopra il target settoriale (25-35%). Questo indica inefficienze in acquisti, sprechi o pricing inadeguato.`,
          impattoStimato: Math.round((foodCostPercent - 35) / 100 * ricaviRistorazione),
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Analizza sprechi in cucina: inventario, scadenza prodotti, porzioni eccessive',
            'Rinegozia contratti con fornitori per migliori prezzi',
            'Implementa sistema di controllo inventario rigoroso',
            'Rivedi menu: elimina piatti poco redditizi, potenzia quelli ad alto margine',
            'Forma personale su gestione inventario e riduzione sprechi',
            'Considera approvvigionamento locale o dirette (meno intermediari)',
            'Analizza pricing: c\'è spazio per aumentare prezzi mantenendo competitività?',
            'Implementa porzioni standardizzate per ridurre sprechi',
          ],
          evidenze: [
            `Food Cost: ${foodCostPercent.toFixed(1)}%`,
            `Target settore: 25-35%`,
            `Costi ristorazione: €${totaleRistorazione.toLocaleString('it-IT')}`,
            `Ricavi ristorazione: €${ricaviRistorazione.toLocaleString('it-IT')}`,
          ],
        });
      } else if (foodCostPercent < 20 && ricaviRistorazione > 0) {
        recommendations.push({
          id: 'food-cost-basso-potenziale-qualita',
          categoria: 'Ristorazione',
          titolo: 'Food Cost molto basso: valuta qualità vs. profitto',
          descrizione: `Il tuo food cost è del ${foodCostPercent.toFixed(1)}%, sotto il target. Valuta se c'è spazio per migliorare qualità ingredienti senza impattare margini, o se puoi aumentare prezzi giustificati dalla qualità.`,
          impattoStimato: Math.round(ricaviRistorazione * 0.05),
          difficolta: 'facile',
          priorita: 'media',
          azioni: [
            'Valuta upgrade ingredienti per migliorare percezione qualità',
            'Aumenta prezzi se qualità giustifica',
            'Mantieni standard attuali se margini sono soddisfacenti',
          ],
          evidenze: [`Food Cost: ${foodCostPercent.toFixed(1)}% (basso)`],
        });
      }
    }
    
    // Troppi fornitori
    if (fornitoriAttivi > 10) {
      recommendations.push({
        id: 'fornitori-troppi',
        categoria: 'Ristorazione',
        titolo: 'Troppi fornitori ristorazione: opportunità di consolidamento',
        descrizione: `Hai ${fornitoriAttivi} fornitori attivi. Best practice del settore: consolidare in 5-8 fornitori principali può ridurre costi del 5-10% grazie a volumi maggiori, semplificare gestione e migliorare condizioni contrattuali.`,
        impattoStimato: Math.round(calculateTotalCosts({ ristorazione: costs.ristorazione }) * 0.08),
        difficolta: 'facile',
        priorita: 'media',
        azioni: [
          'Analizza spesa per fornitore: identifica top 80% della spesa',
          'Valuta consolidamento con fornitori principali per volumi maggiori',
          'Rinegozia contratti: volumi maggiori = prezzi migliori',
          'Elimina fornitori marginali (<2% spesa totale)',
          'Considera fornitori one-stop shop per semplificare',
          'Documenta risparmi attesi per giustificare consolidamento',
        ],
        evidenze: [
          `Numero fornitori attivi: ${fornitoriAttivi}`,
          `Target ottimale: 5-8 fornitori`,
          `Costi ristorazione totali: €${totaleRistorazione.toLocaleString('it-IT')}`,
        ],
      });
    } else if (fornitoriAttivi > 0 && totaleRistorazione > 0) {
      // Analisi fornitori: distribuzione spesa
      const spesePerFornitore = costs.ristorazione
        .filter((item) => item.importo > 0)
        .map((item) => ({ fornitore: item.fornitore, importo: item.importo }))
        .sort((a, b) => b.importo - a.importo);
      
      const top3Totale = spesePerFornitore.slice(0, 3).reduce((sum, f) => sum + f.importo, 0);
      const concentrazioneTop3 = (top3Totale / totaleRistorazione) * 100;
      
      if (concentrazioneTop3 < 60 && fornitoriAttivi >= 5) {
        recommendations.push({
          id: 'spesa-troppo-dispersa',
          categoria: 'Ristorazione',
          titolo: 'Spesa ristorazione troppo dispersa tra fornitori',
          descrizione: `La concentrazione su top 3 fornitori è solo del ${concentrazioneTop3.toFixed(1)}%. Concentrare l'80% della spesa su 3-5 fornitori principali migliora potere contrattuale.`,
          impattoStimato: Math.round(totaleRistorazione * 0.05),
          difficolta: 'facile',
          priorita: 'media',
          azioni: [
            'Identifica fornitori strategici: qualità, affidabilità, prezzi',
            'Trasferisci volumi ai fornitori migliori',
            'Rinegozia contratti con volumi concentrati',
            'Elimina fornitori marginali',
          ],
          evidenze: [
            `Concentrazione top 3: ${concentrazioneTop3.toFixed(1)}%`,
            `Target: >60%`,
          ],
        });
      }
    }
  }

  // Analisi CPPR (migliorata)
  if (kpi.cppr > kpi.adr * 0.4) {
    recommendations.push({
      id: 'cppr-alto',
      categoria: 'Efficienza Operativa',
      titolo: 'Costo per camera venduta troppo elevato',
      descrizione: `Il tuo CPPR (€${kpi.cppr.toFixed(2)}) è troppo alto rispetto all'ADR. Target: <40% dell'ADR.`,
      impattoStimato: Math.round(kpi.totaleSpese * 0.1),
      difficolta: 'complessa',
      priorita: 'alta',
      azioni: [
        'Riduci costi fissi dove possibile',
        'Migliora efficienza energetica',
        'Ottimizza rotazione personale',
        'Automatizza processi ripetitivi',
        'Analizza costi per notte e identifica sprechi',
      ],
      evidenze: [
        `CPPR: €${kpi.cppr.toFixed(2)}`,
        `ADR: €${kpi.adr.toFixed(2)}`,
        `Rapporto: ${((kpi.cppr / kpi.adr) * 100).toFixed(1)}%`,
      ],
    });
  }

  // Analisi occupazione
  const ultimoMese = revenues[revenues.length - 1];
  if (ultimoMese && ultimoMese.occupazione < 60) {
    recommendations.push({
      id: 'occupazione-bassa',
      categoria: 'Revenue',
      titolo: 'Occupazione sotto il target ottimale',
      descrizione: `Occupazione del ${ultimoMese.occupazione.toFixed(1)}% è sotto l'obiettivo del 70%+.`,
      impattoStimato: Math.round(kpi.totaleRicavi * 0.15),
      difficolta: 'media',
      priorita: 'alta',
      azioni: [
        'Migliora strategia di pricing dinamico',
        'Ottimizza canali di distribuzione',
        'Investi in marketing mirato',
        'Rivedi offerte e pacchetti',
        'Analizza motivo bassa occupazione: prezzo, posizione, servizi?',
      ],
      evidenze: [
        `Occupazione attuale: ${ultimoMese.occupazione.toFixed(1)}%`,
        `Target settore: 70-80%`,
        `ADR: €${kpi.adr.toFixed(2)}`,
      ],
    });
  }

  // ==========================================
  // 12. ANALISI UTENZE DETTAGLIATA (Energia, Gas, Acqua)
  // ==========================================

  if (costs.utenze) {
    const energia = costs.utenze.energia?.importo || 0;
    const gas = costs.utenze.gas?.importo || 0;
    const acqua = costs.utenze.acqua?.importo || 0;
    const utenzeTotali = energia + gas + acqua;
    const benchmark = getBenchmarkValues(hotelData);
    
    // Benchmark per hotel (€/camera/mese)
    const benchmarkEnergiaPerCamera = 80; // €/camera/mese
    const benchmarkGasPerCamera = 40;
    const benchmarkAcquaPerCamera = 20;
    
    if (utenzeTotali > benchmark.utenze * 1.3) {
      recommendations.push({
        id: 'utenze-eccessive',
        categoria: 'Utenze',
        titolo: 'Consumo utenze superiore alla norma: opportunità di risparmio',
        descrizione: `Le utenze rappresentano una spesa significativa (€${utenzeTotali.toLocaleString('it-IT')}). Interventi di efficienza energetica possono ridurre costi del 15-25% secondo studi del settore.`,
        impattoStimato: Math.round(utenzeTotali * 0.2),
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'EFFETTUA AUDIT ENERGETICO PROFESSIONALE: identifica perdite e inefficienze',
          'INSTALLA TERMOSTATI INTELLIGENTI: risparmio del 10-15% su riscaldamento/AC',
          'SOSTITUISCI ILLUMINAZIONE CON LED: risparmio del 60-80% su elettricità illuminazione',
          'OTTIMIZZA SISTEMI CLIMATIZZAZIONE: manutenzione e calibrazione periodica',
          'INSTALLA FLUSSI RIDUTTORI ACQUA: riduzione consumo 20-30% senza impatto servizio',
          'IMPLEMENTA SISTEMI DI MONITORAGGIO REAL-TIME: rileva anomalie consumo',
          'FORMA PERSONALE: spegnere luci, ottimizzare temperatura, chiudere porte',
          'VALUTA INVESTIMENTI: fotovoltaico (ROI 5-8 anni), pompe di calore, isolamento',
          'RINEGOZIA CONTRATTI FORNITORI: confronta offerte, considera tariffe biorarie',
          'ANALIZZA CONSUMO PER REPARTO: identifica aree ad alto consumo',
        ],
        evidenze: [
          `Spesa utenze totale: €${utenzeTotali.toLocaleString('it-IT')}`,
          `Energia: €${energia.toLocaleString('it-IT')}`,
          `Gas: €${gas.toLocaleString('it-IT')}`,
          `Acqua: €${acqua.toLocaleString('it-IT')}`,
          `Benchmark totale: €${benchmark.utenze.toLocaleString('it-IT')}`,
          `Risparmio potenziale: €${Math.round(utenzeTotali * 0.2).toLocaleString('it-IT')}/anno`,
        ],
      });
    }
    
    // Analisi specifica energia elettrica
    if (energia > 0 && camereTotali > 0) {
      const energiaPerCameraMese = energia / camereTotali;
      if (energiaPerCameraMese > benchmarkEnergiaPerCamera * 1.2) {
        recommendations.push({
          id: 'energia-eccessiva-per-camera',
          categoria: 'Utenze - Energia',
          titolo: `Consumo energia elettrica elevato: €${energiaPerCameraMese.toFixed(2)}/camera/mese`,
          descrizione: `Il consumo energia per camera è del ${((energiaPerCameraMese / benchmarkEnergiaPerCamera) * 100).toFixed(0)}% sopra il benchmark. Focus su illuminazione LED e climatizzazione.`,
          impattoStimato: Math.round((energiaPerCameraMese - benchmarkEnergiaPerCamera) * camereTotali * 12 * 0.3),
          difficolta: 'facile',
          priorita: 'alta',
          azioni: [
            'SOSTITUISCI ILLUMINAZIONE CON LED: investimento recuperato in 1-2 anni',
            'Installazione sensori presenza per luci automatiche',
            'Ottimizza climatizzazione: manutenzione filtri, calibrazione termostati',
            'Valuta sistemi di prenotazione che gestiscono automaticamente AC',
            'Spegni apparecchi non utilizzati (minibar, TV standby)',
          ],
          evidenze: [
            `Energia per camera: €${energiaPerCameraMese.toFixed(2)}/mese`,
            `Benchmark: €${benchmarkEnergiaPerCamera}/mese`,
          ],
        });
      }
    }
  }
  
  // ==========================================
  // 13. ANALISI PERSONALE E BUSTE PAGA
  // ==========================================
  
  if (costs.personale) {
    const bustePaga = costs.personale.bustePaga || 0;
    const sicurezza = costs.personale.sicurezza || 0;
    const contributiINPS = costs.personale.contributiINPS || 0;
    const personaleTotale = bustePaga + sicurezza + contributiINPS;
    const ricaviTotali = kpi.totaleRicavi;
    
    // Benchmark: personale dovrebbe essere 35-45% dei ricavi per hotel standard
    if (ricaviTotali > 0 && personaleTotale > 0) {
      const personalePercent = (personaleTotale / ricaviTotali) * 100;
      
      if (personalePercent > 50) {
        recommendations.push({
          id: 'personale-troppo-alto-percentuale',
          categoria: 'Personale',
          titolo: `Costi personale del ${personalePercent.toFixed(1)}% dei ricavi (target: 35-45%)`,
          descrizione: `I costi del personale rappresentano ${personalePercent.toFixed(1)}% dei ricavi, sopra il target settoriale. Questo può indicare overstaffing, salari elevati o ricavi insufficienti.`,
          impattoStimato: Math.round(personaleTotale * 0.1),
          difficolta: 'complessa',
          priorita: 'alta',
          azioni: [
            'AUDIT EFFICIENZA PERSONALE: analizza produttività per reparto',
            'Ottimizza turni: allinea personale alla domanda reale (non fissa)',
            'Valuta outsourcing per servizi non core (pulizie, manutenzione)',
            'Implementa formazione per aumentare produttività',
            'Analizza salari vs. benchmark di mercato locale',
            'Considera automazioni (check-in self-service, chat bot) per ridurre front office',
            'Cross-training: personale multi-ruolo riduce necessità totale',
            'Analizza rapporto personale/camera: benchmark 0.8-1.2 dipendenti/camera',
          ],
          evidenze: [
            `Personale totale: €${personaleTotale.toLocaleString('it-IT')}`,
            `Ricavi totali: €${ricaviTotali.toLocaleString('it-IT')}`,
            `Percentuale: ${personalePercent.toFixed(1)}%`,
            `Target: 35-45%`,
          ],
        });
      } else if (personalePercent < 25 && ricaviTotali > 100000) {
        recommendations.push({
          id: 'personale-potenzialmente-sotto-staffed',
          categoria: 'Personale',
          titolo: 'Costi personale molto bassi: valuta qualità servizio',
          descrizione: `I costi del personale sono solo ${personalePercent.toFixed(1)}% dei ricavi. Valuta se il servizio è adeguato o se c'è rischio di burn-out del personale.`,
          impattoStimato: 0, // Non è un risparmio, ma un avviso
          difficolta: 'media',
          priorita: 'media',
          azioni: [
            'Valuta soddisfazione cliente: bassi costi potrebbero impattare qualità',
            'Analizza turnover personale: alto turnover può costare di più',
            'Considera se servizio è adeguato alle aspettative',
            'Mantieni se qualità servizio è alta e margini soddisfacenti',
          ],
          evidenze: [`Personale: ${personalePercent.toFixed(1)}% dei ricavi`],
        });
      }
    }
    
    // Analisi sicurezza vs. buste paga
    if (bustePaga > 0 && sicurezza > 0) {
      const rapportoSicurezza = (sicurezza / personaleTotale) * 100;
      if (rapportoSicurezza > 30) {
        recommendations.push({
          id: 'sicurezza-troppo-alta',
          categoria: 'Personale - Sicurezza',
          titolo: 'Costi sicurezza molto alti rispetto al personale totale',
          descrizione: `I costi sicurezza rappresentano ${rapportoSicurezza.toFixed(1)}% del personale totale. Valuta se il livello di sicurezza è necessario o ottimizzabile.`,
          impattoStimato: Math.round(sicurezza * 0.15),
          difficolta: 'media',
          priorita: 'media',
          azioni: [
            'Valuta necessità reale servizi sicurezza',
            'Considera sistemi di sicurezza tecnologici (CCTV, accesso)',
            'Rinegozia contratti sicurezza',
            'Analizza orari copertura: è necessaria 24/7?',
          ],
          evidenze: [`Sicurezza: ${rapportoSicurezza.toFixed(1)}% del personale`],
        });
      }
    }
  }

  // ==========================================
  // 14. ANALISI COMMISSIONI OTA E CANALI DISTRIBUZIONE
  // ==========================================
  
  if (costs.marketing?.commissioniOTA && revenues.length > 0) {
    const commissioniOTATotali = costs.marketing.commissioniOTA;
    const prenotazioniTotali = revenues.reduce((sum, r) => sum + (r.numeroPrenotazioni || 0), 0);
    const ricaviCamereTotali = revenues.reduce((sum, r) => sum + (r.entrateTotali || 0), 0);
    
    if (commissioniOTATotali > 0 && ricaviCamereTotali > 0) {
      const percentualeCommissioni = (commissioniOTATotali / ricaviCamereTotali) * 100;
      const commissioneMediaPerPrenotazione = prenotazioniTotali > 0 ? commissioniOTATotali / prenotazioniTotali : 0;
      
      // Benchmark: commissioni OTA tipicamente 15-18% per Booking.com, 18-25% per Expedia
      if (percentualeCommissioni > 20) {
        recommendations.push({
          id: 'commissioni-ota-eccessive',
          categoria: 'Marketing - Distribuzione',
          titolo: `Commissioni OTA del ${percentualeCommissioni.toFixed(1)}% dei ricavi camere: opportunità prenotazioni dirette`,
          descrizione: `Le commissioni OTA rappresentano ${percentualeCommissioni.toFixed(1)}% dei ricavi camere (€${commissioniOTATotali.toLocaleString('it-IT')}). Aumentare prenotazioni dirette può ridurre significativamente questi costi. Ogni punto percentuale di prenotazioni dirette aggiuntive = migliaia di euro risparmiati.`,
          impattoStimato: Math.round(commissioniOTATotali * 0.3), // 30% riduzione se aumenti prenotazioni dirette
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'IMPLEMENTA PROGRAMMA FEDELTÀ: incentiva prenotazioni dirette con sconti esclusivi',
            'Migliora sito web: user experience ottimale per conversioni prenotazioni',
            'Offri best rate guarantee: assicura che sito diretto abbia sempre prezzo migliore',
            'Promuovi prenotazioni dirette: comunicazione check-in, email, marketing',
            'Implementa sistema prenotazioni diretto user-friendly (calendario, pagamento facile)',
            'Crea offerte esclusive solo per prenotazioni dirette (upgrade, colazione inclusa)',
            'Analizza canali: diversifica mix per ridurre dipendenza OTA',
            'Negozia commissioni OTA: volumi alti possono permettere sconti',
            'Target: 30-40% prenotazioni dirette per hotel indipendenti',
          ],
          evidenze: [
            `Commissioni OTA: €${commissioniOTATotali.toLocaleString('it-IT')}`,
            `Percentuale su ricavi: ${percentualeCommissioni.toFixed(1)}%`,
            `Commissione media/prenotazione: €${commissioneMediaPerPrenotazione.toFixed(2)}`,
            `Prenotazioni totali: ${prenotazioniTotali}`,
            `Risparmio potenziale (30% riduzione): €${Math.round(commissioniOTATotali * 0.3).toLocaleString('it-IT')}/anno`,
          ],
        });
      }
      
      // Analisi dipendenza OTA (se commissioni sono >40% di tutti i costi marketing)
      const costiMarketingTotali = (costs.marketing?.costiMarketing || 0) + commissioniOTATotali;
      if (costiMarketingTotali > 0 && (commissioniOTATotali / costiMarketingTotali) > 0.6) {
        recommendations.push({
          id: 'dipendenza-eccessiva-ota',
          categoria: 'Marketing - Strategia',
          titolo: 'Eccessiva dipendenza da OTA: diversifica canali distribuzione',
          descrizione: `Le commissioni OTA rappresentano oltre il 60% dei costi marketing totali. Questa dipendenza può limitare controllo pricing e margini. Diversifica canali.`,
          impattoStimato: Math.round(commissioniOTATotali * 0.2),
          difficolta: 'media',
          priorita: 'alta',
          azioni: [
            'Sviluppa presenza su canali alternativi: GDS, tour operator, aziende',
            'Implementa strategia omnicanale: tutti i canali, ma controllo pricing',
            'Negozia contratti corporate per prenotazioni ricorrenti',
            'Sviluppa partnership locali (ristoranti, attività) per referral',
          ],
          evidenze: [`Commissioni OTA: ${((commissioniOTATotali / costiMarketingTotali) * 100).toFixed(1)}% dei costi marketing`],
        });
      }
    }
  }

  // ==========================================
  // 15. ANALISI TREND MENSILI (già presente, mantenuta)
  // ==========================================

  if (revenues.length >= 2) {
    // Analizza trend occupazione
    const occupazioni = revenues.map(r => r.occupazione);
    const trendOccupazione = occupazioni[occupazioni.length - 1] - occupazioni[0];
    
    if (trendOccupazione < -10) {
      recommendations.push({
        id: 'trend-occupazione-declino',
        categoria: 'Revenue',
        titolo: 'Trend occupazione in declino: azione urgente necessaria',
        descrizione: `L'occupazione è diminuita di ${Math.abs(trendOccupazione).toFixed(1)} punti percentuali nell'ultimo periodo. Questo è un segnale critico che richiede intervento immediato.`,
        impattoStimato: Math.round(kpi.totaleRicavi * 0.2),
        difficolta: 'media',
        priorita: 'critica',
        azioni: [
          'Analizza cause del declino: competitor, stagionalità, servizi?',
          'Implementa strategia pricing aggressiva per recuperare occupazione',
          'Rivedi strategia marketing e comunicazione',
          'Migliora esperienza cliente per aumentare soddisfazione',
          'Considera promozioni temporanee per riempire camere',
        ],
        evidenze: [
          `Occupazione ultimo periodo: ${occupazioni[occupazioni.length - 1].toFixed(1)}%`,
          `Occupazione primo periodo: ${occupazioni[0].toFixed(1)}%`,
          `Variazione: ${trendOccupazione.toFixed(1)} punti percentuali`,
        ],
      });
    } else if (trendOccupazione > 10) {
      recommendations.push({
        id: 'trend-occupazione-crescita',
        categoria: 'Revenue',
        titolo: 'Trend occupazione positivo: capitalizza sulla crescita',
        descrizione: `L'occupazione è aumentata di ${trendOccupazione.toFixed(1)} punti percentuali. Ottimo! Considera di aumentare gradualmente i prezzi per massimizzare i ricavi.`,
        impattoStimato: Math.round(kpi.totaleRicavi * 0.08),
        difficolta: 'facile',
        priorita: 'media',
        azioni: [
          'Aumenta prezzi del 3-5% gradualmente',
          'Mantieni strategia che ha portato alla crescita',
          'Capitalizza sulla domanda aumentata',
          'Riduci promozioni aggressive ora che hai più occupazione',
        ],
        evidenze: [
          `Occupazione ultimo periodo: ${occupazioni[occupazioni.length - 1].toFixed(1)}%`,
          `Occupazione primo periodo: ${occupazioni[0].toFixed(1)}%`,
          `Crescita: +${trendOccupazione.toFixed(1)} punti percentuali`,
        ],
      });
    }

    // Analizza trend ADR
    const adrs = revenues.map(r => r.prezzoMedioCamera);
    const trendAdr = adrs[adrs.length - 1] - adrs[0];
    
    if (trendAdr < -20) {
      recommendations.push({
        id: 'trend-adr-declino',
        categoria: 'Pricing',
        titolo: 'ADR in forte declino: rivaluta strategia pricing',
        descrizione: `L'ADR è diminuito di €${Math.abs(trendAdr).toFixed(2)} nell'ultimo periodo. Questo può indicare pressione competitiva o strategia pricing errata.`,
        impattoStimato: Math.round(Math.abs(trendAdr) * (kpi.occupazione / 100) * camereTotali * 30 * 0.5),
        difficolta: 'media',
        priorita: 'alta',
        azioni: [
          'Analizza competitor pricing',
          'Rivedi valore percepito: servizi, posizione, qualità',
          'Considera di aumentare ADR gradualmente se occupazione è stabile',
          'Aggiungi servizi a valore per giustificare prezzi più alti',
        ],
        evidenze: [
          `ADR ultimo periodo: €${adrs[adrs.length - 1].toFixed(2)}`,
          `ADR primo periodo: €${adrs[0].toFixed(2)}`,
          `Variazione: €${trendAdr.toFixed(2)}`,
        ],
      });
    }
  }

  // ==========================================
  // 10. ANALISI SPECIFICHE PER HOTEL STAGIONALI
  // ==========================================

  if (isStagionale && hotelData?.giorniApertura) {
    const giorniApertura = hotelData.giorniApertura;
    const ricaviGiornalieri = kpi.ricaviGiornalieriMedi || 0;
    const costiGiornalieri = kpi.costiGiornalieriMedi || 0;
    
    if (ricaviGiornalieri > 0 && costiGiornalieri > 0) {
      const margineGiornaliero = ricaviGiornalieri - costiGiornalieri;
      
      if (margineGiornaliero < costiGiornalieri * 0.3) {
        recommendations.push({
          id: 'stagionale-margine-giornaliero-basso',
          categoria: 'Profitability Stagionale',
          titolo: 'Margine giornaliero per hotel stagionale sotto ottimale',
          descrizione: `Il tuo margine giornaliero (€${margineGiornaliero.toFixed(2)}) è sotto il 30% dei costi giornalieri. Per hotel stagionali, è cruciale massimizzare la redditività nei ${giorniApertura} giorni di apertura.`,
          impattoStimato: Math.round((costiGiornalieri * 0.3 - margineGiornaliero) * giorniApertura),
          difficolta: 'complessa',
          priorita: 'alta',
          azioni: [
            'Massimizza prezzi durante alta stagione: domanda concentrata consente prezzi più alti',
            'Ottimizza occupazione nei periodi di punta',
            'Minimizza costi nei giorni di bassa occupazione',
            'Considera chiusura temporanea se margini sono negativi',
            'Focus su servizi ad alto margine nei giorni di apertura',
          ],
          evidenze: [
            `Giorni apertura: ${giorniApertura}`,
            `Ricavi giornalieri medi: €${ricaviGiornalieri.toFixed(2)}`,
            `Costi giornalieri medi: €${costiGiornalieri.toFixed(2)}`,
            `Margine giornaliero: €${margineGiornaliero.toFixed(2)}`,
          ],
        });
      }
    }
  }

  // Se non ci sono raccomandazioni specifiche, genera raccomandazioni generali
  if (recommendations.length === 0 && costs && Object.keys(costs).length > 0) {
    recommendations.push({
      id: 'monitoraggio-continuo',
      categoria: 'Gestione',
      titolo: 'Monitoraggio continuo dei costi',
      descrizione: 'Continua a monitorare regolarmente i tuoi costi per identificare trend e opportunità di ottimizzazione.',
      impattoStimato: Math.round(totaleSpese * 0.03),
      difficolta: 'facile',
      priorita: 'media',
      azioni: [
        'Analizza mensilmente le variazioni dei costi',
        'Confronta con i benchmark di settore',
        'Identifica fornitori con miglior rapporto qualità/prezzo',
        'Documenta tutte le spese per analisi future',
      ],
      evidenze: [
        `Spese totali monitorate: €${totaleSpese.toLocaleString('it-IT')}`,
      ],
    });
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
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // Alert per anomalie critiche
  costAnalyses.forEach((analysis) => {
    if (analysis.anomalia && analysis.variazionePercentuale && Math.abs(analysis.variazionePercentuale) > 30) {
      alerts.push({
        id: `alert-anomalia-${analysis.categoria.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        tipo: 'anomalia',
        categoria: analysis.categoria,
        messaggio: `${analysis.categoria}: variazione del ${Math.round(analysis.variazionePercentuale)}%`,
        severita: 'critica',
        data: now,
        risolto: false,
      });
    }
  });

  // Alert per GOP negativo
  if (kpi.gop < 0) {
    alerts.push({
      id: `alert-gop-negativo-${Date.now()}`,
      tipo: 'soglia',
      categoria: 'Redditività',
      messaggio: 'GOP negativo: hotel in perdita',
      severita: 'critica',
      data: now,
      risolto: false,
    });
  }

  // Alert per margine critico
  if (kpi.gopMargin < 5) {
    alerts.push({
      id: `alert-margine-critico-${Date.now()}`,
      tipo: 'soglia',
      categoria: 'Redditività',
      messaggio: `Margine GOP critico: ${kpi.gopMargin.toFixed(1)}%`,
      severita: 'alta',
      data: now,
      risolto: false,
    });
  }

  return alerts;
}
