// Parser per file XLS/XLSX di fatture gestionale
import * as XLSX from 'xlsx';
import { CostsData, CostItem } from './types';

export interface ImportedCost {
  fornitore: string;
  importo: number;
  categoria: string;
  data?: string;
  descrizione?: string;
}

/**
 * Legge un file XLS/XLSX e estrae i costi
 */
export function parseXLSFile(file: File): Promise<ImportedCost[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Prova a leggere il primo foglio
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converti in JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        // Parse i dati
        const costs = parseExcelData(jsonData);
        resolve(costs);
      } catch (error) {
        reject(new Error(`Errore nel parsing del file: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Analizza i dati Excel e li converte in costi strutturati
 */
function parseExcelData(data: any[]): ImportedCost[] {
  const costs: ImportedCost[] = [];
  
  if (!data || data.length === 0) {
    return costs;
  }
  
  // Trova le colonne chiave analizzando l'header
  const firstRow = data[0] || {};
  const keys = Object.keys(firstRow);
  
  // Cerca colonne comuni (case insensitive)
  const findColumn = (patterns: string[]) => {
    return keys.find(key => 
      patterns.some(pattern => 
        key.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  };
  
  const fornitoreCol = findColumn(['fornitore', 'ragione sociale', 'nome', 'cliente', 'supplier', 'vendor']);
  const importoCol = findColumn(['importo', 'totale', 'ammontare', 'amount', 'total', 'prezzo', 'price']);
  const descrizioneCol = findColumn(['descrizione', 'oggetto', 'causale', 'desc', 'description', 'note', 'note']);
  const dataCol = findColumn(['data', 'date', 'data fattura', 'fattura', 'fatt.']);
  const categoriaCol = findColumn(['categoria', 'tipo', 'category', 'type', 'voce']);
  
  // Processa ogni riga
  data.forEach((row, index) => {
    // Salta righe vuote o header
    if (!row || typeof row !== 'object') return;
    
    const fornitore = (row[fornitoreCol || ''] || '').toString().trim();
    const importoStr = (row[importoCol || ''] || '').toString().trim();
    const descrizione = (row[descrizioneCol || ''] || '').toString().trim();
    const dataFattura = (row[dataCol || ''] || '').toString().trim();
    const categoria = (row[categoriaCol || ''] || '').toString().trim();
    
    // Estrai importo (rimuovi simboli e converti)
    const importo = parseFloat(importoStr.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    
    // Salta se non ci sono dati essenziali
    if (!fornitore && importo === 0) return;
    if (importo === 0) return;
    
    // Determina categoria automatica se non presente
    let categoriaFinale = categoria || categorizeByDescription(fornitore, descrizione);
    
    costs.push({
      fornitore: fornitore || `Fornitore ${index + 1}`,
      importo: Math.abs(importo), // Usa valore assoluto (le fatture possono essere negative)
      categoria: categoriaFinale,
      descrizione,
      data: dataFattura,
    });
  });
  
  return costs;
}

/**
 * Categorizza automaticamente in base a descrizione e fornitore
 */
function categorizeByDescription(fornitore: string, descrizione: string): string {
  const text = `${fornitore} ${descrizione}`.toLowerCase();
  
  // Ristorazione
  if (text.match(/ristorante|food|aliment|bevanda|wine|vino|cibo|bar|pizzeria|catering|chef|cuoco|pastry/i)) {
    return 'Ristorazione';
  }
  
  // Utenze - Energia
  if (text.match(/energia|elettric|luce|elettrica|enel|edison|edf/i)) {
    return 'Utenze - Energia';
  }
  
  // Utenze - Gas
  if (text.match(/gas|metano|gas naturale|gas liquido/i)) {
    return 'Utenze - Gas';
  }
  
  // Utenze - Acqua
  if (text.match(/acqua|idrico|acqua potabile|water|aqueduct/i)) {
    return 'Utenze - Acqua';
  }
  
  // Personale
  if (text.match(/busta paga|stipendio|personale|dipendente|lavoratore|salary|payroll/i)) {
    return 'Personale';
  }
  
  // Manutenzione
  if (text.match(/manutenzione|maintenance|riparazione|fix|elettricista|idraulico|caldaia|ascensore/i)) {
    return 'Manutenzione';
  }
  
  // Pulizie
  if (text.match(/pulizia|cleaning|detergente|detergenti|lavanderia|laundry/i)) {
    return 'Pulizie';
  }
  
  // Marketing
  if (text.match(/marketing|advertising|pubblicità|promozione|social media|seo|ppc|google ads/i)) {
    return 'Marketing';
  }
  
  // Telefono/Internet
  if (text.match(/telefono|telecom|vodafone|tim|wind|internet|fibra|wifi|connessione/i)) {
    return 'Telefono/Internet';
  }
  
  // Commercialista/Consulente
  if (text.match(/commercialista|consulente|avvocato|notaio|legale|consulting/i)) {
    return 'Commercialista/Consulente';
  }
  
  // TARI/Tasse
  if (text.match(/tari|imu|tassa|imposta|fisco|agenzia entrate|comune/i)) {
    return 'Tasse';
  }
  
  // Gestionale
  if (text.match(/gestionale|software|sistema|erp|crm|programma|licenza/i)) {
    return 'Gestionale';
  }
  
  // Default
  return 'Altri Costi';
}

/**
 * Converte i costi importati nel formato CostsData del sistema
 */
export function mapImportedCostsToCostsData(costs: ImportedCost[], mese: string): Partial<CostsData> {
  const costsData: Partial<CostsData> = {
    ristorazione: [],
    utenze: {
      energia: { fornitore: '', importo: 0 },
      gas: { fornitore: '', importo: 0 },
      acqua: { fornitore: '', importo: 0 },
    },
    personale: {
      bustePaga: 0,
      sicurezza: 0,
    },
    altriCosti: {},
  };
  
  costs.forEach(cost => {
    switch (cost.categoria) {
      case 'Ristorazione':
        if (!costsData.ristorazione) costsData.ristorazione = [];
        costsData.ristorazione.push({
          fornitore: cost.fornitore,
          importo: cost.importo,
        });
        break;
        
      case 'Utenze - Energia':
        if (costsData.utenze) {
          costsData.utenze.energia = {
            fornitore: costsData.utenze.energia?.fornitore || cost.fornitore,
            importo: (costsData.utenze.energia?.importo || 0) + cost.importo,
          };
        }
        break;
        
      case 'Utenze - Gas':
        if (costsData.utenze) {
          costsData.utenze.gas = {
            fornitore: costsData.utenze.gas?.fornitore || cost.fornitore,
            importo: (costsData.utenze.gas?.importo || 0) + cost.importo,
          };
        }
        break;
        
      case 'Utenze - Acqua':
        if (costsData.utenze) {
          costsData.utenze.acqua = {
            fornitore: costsData.utenze.acqua?.fornitore || cost.fornitore,
            importo: (costsData.utenze.acqua?.importo || 0) + cost.importo,
          };
        }
        break;
        
      case 'Personale':
        if (costsData.personale) {
          // Cerca di distinguere tra buste paga e sicurezza
          if (cost.descrizione?.toLowerCase().includes('sicurezza') || 
              cost.fornitore.toLowerCase().includes('sicurezza')) {
            costsData.personale.sicurezza += cost.importo;
          } else {
            costsData.personale.bustePaga += cost.importo;
          }
        }
        break;
        
      case 'Pulizie':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        costsData.altriCosti.pulizie = (costsData.altriCosti.pulizie || 0) + cost.importo;
        break;
        
      case 'Manutenzione':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        // Distingui tipo di manutenzione
        const desc = cost.descrizione?.toLowerCase() || '';
        if (desc.includes('elettric')) {
          costsData.altriCosti.manElettricista = (costsData.altriCosti.manElettricista || 0) + cost.importo;
        } else if (desc.includes('idraul')) {
          costsData.altriCosti.manIdraulico = (costsData.altriCosti.manIdraulico || 0) + cost.importo;
        } else if (desc.includes('caldaia') || desc.includes('aria condizionata')) {
          costsData.altriCosti.manCaldaia = (costsData.altriCosti.manCaldaia || 0) + cost.importo;
        } else if (desc.includes('piscina')) {
          costsData.altriCosti.manPiscina = (costsData.altriCosti.manPiscina || 0) + cost.importo;
        } else if (desc.includes('ascensore')) {
          costsData.altriCosti.ascensore = (costsData.altriCosti.ascensore || 0) + cost.importo;
        } else {
          costsData.altriCosti.manElettricista = (costsData.altriCosti.manElettricista || 0) + cost.importo;
        }
        break;
        
      case 'Marketing':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        if (cost.descrizione?.toLowerCase().includes('ppc') || 
            cost.descrizione?.toLowerCase().includes('google ads')) {
          costsData.altriCosti.ppc = (costsData.altriCosti.ppc || 0) + cost.importo;
        } else {
          costsData.altriCosti.marketing = (costsData.altriCosti.marketing || 0) + cost.importo;
        }
        break;
        
      case 'Telefono/Internet':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        costsData.altriCosti.telefono = (costsData.altriCosti.telefono || 0) + cost.importo;
        break;
        
      case 'Commercialista/Consulente':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        costsData.altriCosti.commercialista = (costsData.altriCosti.commercialista || 0) + cost.importo;
        break;
        
      case 'Tasse':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        costsData.altriCosti.tari = (costsData.altriCosti.tari || 0) + cost.importo;
        break;
        
      case 'Gestionale':
        if (!costsData.altriCosti) costsData.altriCosti = {};
        costsData.altriCosti.gestionale = (costsData.altriCosti.gestionale || 0) + cost.importo;
        break;
        
      default:
        // Altri costi
        if (!costsData.altriCosti) costsData.altriCosti = {};
        const key = cost.fornitore.toLowerCase().replace(/\s+/g, '');
        costsData.altriCosti[key] = (costsData.altriCosti[key] || 0) + cost.importo;
        break;
    }
  });
  
  return costsData;
}

