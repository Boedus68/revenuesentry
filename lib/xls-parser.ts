// Parser per file XLS/XLSX di fatture gestionale
import * as XLSX from 'xlsx';
import { CostsData, CostItem } from './types';

export interface ImportedCost {
  id: string; // ID univoco per ogni costo importato
  fornitore: string;
  importo: number;
  categoria?: string; // Categoria assegnata dall'utente (opzionale)
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
        const workbook = XLSX.read(data, { 
          type: 'binary',
          cellDates: true,
          cellNF: false,
          cellText: false
        });
        
        console.log('File Excel letto. Fogli:', workbook.SheetNames);
        
        // Prova a leggere tutti i fogli fino a trovare dati
        let costs: ImportedCost[] = [];
        
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          
          // Prova prima con header normalizzato
          let jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: '',
            blankrows: false
          });
          
          console.log(`Foglio "${sheetName}":`, jsonData.length, 'righe');
          
          if (jsonData.length === 0) {
            // Prova senza header (array di array)
            const arrayData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              defval: '',
              blankrows: false
            });
            
            if (arrayData.length > 0) {
              console.log('Formato array rilevato');
              costs = parseExcelAsArray(arrayData);
            }
          } else {
            costs = parseExcelData(jsonData);
          }
          
          // Se trova costi, interrompi
          if (costs.length > 0) {
            console.log(`Trovati ${costs.length} costi nel foglio "${sheetName}"`);
            break;
          }
        }
        
        if (costs.length === 0) {
          // Ultimo tentativo: prova con tutte le opzioni di parsing
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Prova con range dinamico
          const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1:Z100');
          console.log('Range foglio:', range);
          
          // Prova diversi formati
          const formats = [
            { header: 1, raw: false },
            { header: 0, raw: false },
            { header: 'A', raw: false },
          ];
          
          for (const format of formats) {
            try {
              const testData = XLSX.utils.sheet_to_json(firstSheet, format as any);
              if (Array.isArray(testData) && testData.length > 0) {
                costs = parseExcelData(testData);
                if (costs.length > 0) break;
              }
            } catch (e) {
              // Continua
            }
          }
        }
        
        resolve(costs);
      } catch (error: any) {
        console.error('Errore parsing:', error);
        reject(new Error(`Errore nel parsing del file: ${error.message || error}`));
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
    console.warn('Nessun dato trovato nel file Excel');
    return costs;
  }
  
  console.log('Dati Excel ricevuti:', data.length, 'righe');
  console.log('Prima riga:', data[0]);
  
  // Trova le colonne chiave analizzando l'header
  const firstRow = data[0] || {};
  const keys = Object.keys(firstRow);
  
  console.log('Colonne trovate:', keys);
  
  // Se non ci sono chiavi nominate, prova a usare gli indici (A, B, C, etc.)
  if (keys.length === 0 && Array.isArray(data)) {
    // Prova a leggere come array di array
    return parseExcelAsArray(data);
  }
  
  // Cerca colonne comuni (case insensitive)
  const findColumn = (patterns: string[]) => {
    // Prima cerca nei nomi delle colonne (chiavi)
    const found = keys.find(key => {
      const keyLower = key.toLowerCase().trim();
      // Rimuovi spazi e caratteri speciali per matching più flessibile
      const keyNormalized = keyLower.replace(/[_\s-]/g, '');
      return patterns.some(pattern => {
        const patternLower = pattern.toLowerCase().trim();
        const patternNormalized = patternLower.replace(/[_\s-]/g, '');
        // Match esatto o contiene
        return keyNormalized === patternNormalized || 
               keyNormalized.includes(patternNormalized) ||
               patternNormalized.includes(keyNormalized);
      });
    });
    
    // Se non trova nei nomi delle colonne, cerca nei valori della prima riga
    // (potrebbe essere che la prima riga contenga gli header)
    if (!found) {
      for (let i = 0; i < Math.min(keys.length, 15); i++) {
        const key = keys[i];
        const value = (firstRow[key] || '').toString().trim().toLowerCase();
        if (value) {
          const valueNormalized = value.replace(/[_\s-]/g, '');
          const foundPattern = patterns.find(pattern => {
            const patternLower = pattern.toLowerCase().trim();
            const patternNormalized = patternLower.replace(/[_\s-]/g, '');
            return valueNormalized === patternNormalized ||
                   valueNormalized.includes(patternNormalized) ||
                   patternNormalized.includes(valueNormalized);
          });
          if (foundPattern) {
            console.log(`Colonna trovata tramite valore header: "${key}" con valore "${value}" corrisponde a pattern "${foundPattern}"`);
            return key;
          }
        }
      }
    }
    
    if (found) {
      console.log(`Colonna trovata: "${found}" per pattern: ${patterns[0]}`);
    }
    
    return found;
  };
  
  // Pattern italiani più comuni per file fatture
  const fornitoreCol = findColumn([
    'fornitore', 'ragione sociale', 'ragione_sociale', 'ragionesociale',
    'nome', 'cliente', 'supplier', 'vendor', 'beneficiario', 'denominazione',
    'beneficiario pagamento', 'anagrafica', 'azienda', 'società'
  ]);
  const importoCol = findColumn([
    'imponibile', 'totale', 'importo', 'ammontare', 'amount', 'total',
    'prezzo', 'price', 'euro', '€', 'valore', 'euro totale', 'eurototale',
    'importo netto', 'netto', 'totale fattura', 'totalefattura',
    'importo fattura', 'importofattura'
  ]);
  const descrizioneCol = findColumn([
    'descrizione', 'oggetto', 'causale', 'desc', 'description', 'note',
    'dettaglio', 'causale pagamento', 'causalepagamento', 'voce', 'descrizione pagamento'
  ]);
  const dataCol = findColumn([
    'data', 'date', 'data fattura', 'datafattura', 'fattura', 'fatt.',
    'data documento', 'datadocumento', 'data emissione', 'dataemissione',
    'data scadenza', 'datascadenza'
  ]);
  const categoriaCol = findColumn([
    'categoria', 'tipo', 'category', 'type', 'voce', 'tipo movimento',
    'tipomovimento', 'categoria spesa', 'categoriaspesa'
  ]);
  
  console.log('Colonne identificate:', {
    fornitore: fornitoreCol,
    importo: importoCol,
    descrizione: descrizioneCol,
    data: dataCol,
    categoria: categoriaCol
  });
  
  // Se non trova importo, cerca la colonna numerica con valori medi più alti (solitamente imponibile/totale)
  let finalImportoCol = importoCol;
  if (!finalImportoCol) {
    console.log('Colonna importo non trovata tramite nomi, cercando colonna con valori più alti...');
    
    // Cerca colonne numeriche e trova quella con valori medi più alti
    const numericColsWithValues: Array<{key: string, avg: number, max: number, count: number}> = [];
    
    keys.forEach(key => {
      // Salta colonne testuali evidenti
      const keyLower = key.toLowerCase();
      if (keyLower.includes('fornitore') || keyLower.includes('ragione') || 
          keyLower.includes('descrizione') || keyLower.includes('oggetto') || 
          keyLower.includes('causale') || keyLower.includes('data') ||
          keyLower.includes('fattura') || keyLower.includes('numero')) {
        return;
      }
      
      let sum = 0;
      let count = 0;
      let max = 0;
      let min = Infinity;
      
      // Analizza le prime 50 righe per statistiche
      for (let i = 1; i < Math.min(data.length, 50); i++) {
        const val = data[i]?.[key];
        if (val !== undefined && val !== null && val !== '') {
          const str = val.toString().trim();
          // Gestisci formato numerico
          let cleaned = str.replace(/[€$£]/g, '').trim();
          if (cleaned.includes(',') && cleaned.includes('.')) {
            const lastComma = cleaned.lastIndexOf(',');
            const lastDot = cleaned.lastIndexOf('.');
            if (lastComma > lastDot) {
              cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
              cleaned = cleaned.replace(/,/g, '');
            }
          } else if (cleaned.includes(',')) {
            cleaned = cleaned.replace(',', '.');
          }
          cleaned = cleaned.replace(/[^\d.-]/g, '');
          const num = parseFloat(cleaned);
          
          if (!isNaN(num) && num !== 0) {
            const absNum = Math.abs(num);
            // Ignora valori molto piccoli (probabilmente quantitativi o percentuali)
            if (absNum >= 1) {
              sum += absNum;
              count++;
              max = Math.max(max, absNum);
              min = Math.min(min, absNum);
            }
          }
        }
      }
      
      // Filtra colonne con valori troppo piccoli o troppo grandi (probabilmente errori)
      // Limite massimo: 100.000€ per evitare colonne con errori di formato
      if (count > 0) {
        const averageValue = sum / count;
        if (max >= 10 && max < 100000 && averageValue < 50000) {
          numericColsWithValues.push({
            key,
            avg: averageValue,
            max,
            count
          });
          console.log(`Colonna "${key}": media=${averageValue.toFixed(2)}, max=${max.toFixed(2)}, count=${count}`);
        } else {
          console.log(`Colonna "${key}" scartata: media=${averageValue.toFixed(2)}, max=${max.toFixed(2)} (troppo alta/bassa)`);
        }
      }
    });
    
    if (numericColsWithValues.length > 0) {
      // Ordina per media decrescente e prendi la colonna con valori medi più alti
      numericColsWithValues.sort((a, b) => b.avg - a.avg);
      finalImportoCol = numericColsWithValues[0].key;
      console.log(`✅ Colonna importo identificata automaticamente: "${finalImportoCol}" (media: ${numericColsWithValues[0].avg.toFixed(2)}, max: ${numericColsWithValues[0].max.toFixed(2)})`);
    } else {
      console.warn('⚠️ Nessuna colonna numerica valida trovata!');
    }
  } else {
    console.log(`✅ Colonna importo trovata tramite nome: "${finalImportoCol}"`);
  }
  
  // Se non trova fornitore, cerca la prima colonna di testo (escludi date e numeri)
  let finalFornitoreCol = fornitoreCol;
  
  // Log per debug
  console.log(`Ricerca colonna fornitore: trovata="${fornitoreCol}", colonne disponibili=`, keys.slice(0, 10));
  
  if (!finalFornitoreCol && keys.length > 0) {
    // Cerca colonne con valori testuali (non date, non numeri)
    for (const key of keys) {
      // Salta colonne numeriche
      const keyLower = key.toLowerCase();
      if (keyLower.includes('importo') || keyLower.includes('totale') || 
          keyLower.includes('prezzo') || keyLower.includes('quantità') ||
          keyLower.includes('qty') || keyLower.includes('amount')) {
        continue;
      }
      
      // Verifica che contenga testo (non solo date)
      let hasText = false;
      let hasDateOnly = true;
      for (let i = 1; i < Math.min(data.length, 10); i++) {
        const val = data[i]?.[key];
        if (val !== undefined && val !== null && val !== '') {
          const str = val.toString().trim();
          // Verifica se è una data (formato MM/DD/YY o simili)
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
          if (datePattern.test(str)) {
            hasDateOnly = hasDateOnly && true;
          } else if (str.length > 5 && !/^\d+[,.]?\d*$/.test(str)) {
            // Ha testo significativo (non solo numeri)
            hasText = true;
            hasDateOnly = false;
          }
        }
      }
      
      if (hasText || (!hasDateOnly && keys.length < 5)) {
        finalFornitoreCol = key;
        console.log(`Colonna fornitore identificata: "${key}"`);
        break;
      }
    }
    
    // Se ancora non trovato, usa la prima colonna NON numerica
    if (!finalFornitoreCol) {
      for (const key of keys) {
        const keyLower = key.toLowerCase();
        if (!keyLower.includes('importo') && !keyLower.includes('totale') && 
            !keyLower.includes('prezzo') && !keyLower.includes('quantità')) {
          finalFornitoreCol = key;
          break;
        }
      }
      if (!finalFornitoreCol && keys.length > 0) {
        finalFornitoreCol = keys[0];
      }
    }
  }
  
  // Verifica se la prima riga è un header (contiene solo label, no numeri)
  const firstRowIsHeader = (() => {
    const rowValues = Object.values(data[0] || {});
    const hasSignificantNumbers = rowValues.some(val => {
      const str = val?.toString() || '';
      const num = parseFloat(str.replace(/[^\d.,-]/g, '').replace(',', '.'));
      return !isNaN(num) && Math.abs(num) > 1; // Numeri significativi (>1)
    });
    const hasHeaderKeywords = rowValues.some(v => {
      const str = (v?.toString() || '').toLowerCase();
      return str.includes('importo') || str.includes('fornitore') || 
             str.includes('imponibile') || str.includes('totale') ||
             str.includes('ragione') || str.includes('descrizione');
    });
    return hasHeaderKeywords && !hasSignificantNumbers;
  })();
  
  if (firstRowIsHeader) {
    console.log('✅ Prima riga identificata come header, verrà saltata');
  }
  
  // Processa ogni riga
  data.forEach((row, index) => {
    // Salta righe vuote o header
    if (!row || typeof row !== 'object') return;
    
    // Se la prima riga è un header, saltala
    if (index === 0 && firstRowIsHeader) {
      return;
    }
    
    // Se la prima riga contiene solo header testuali senza numeri, saltala
    if (index === 0 && !firstRowIsHeader) {
      const rowValues = Object.values(row);
      const hasNumbers = rowValues.some(val => {
        const str = val?.toString() || '';
        return !isNaN(parseFloat(str.replace(/[^\d.,-]/g, '').replace(',', '.')));
      });
      if (!hasNumbers && rowValues.some(v => {
        const str = (v?.toString() || '').toLowerCase();
        return str.includes('importo') || str.includes('fornitore') || 
               str.includes('imponibile') || str.includes('totale');
      })) {
        console.log('Prima riga identificata come header (contiene keywords ma no numeri)');
        return; // È una riga header
      }
    }
    
    let fornitore = '';
    if (finalFornitoreCol) {
      fornitore = (row[finalFornitoreCol] || '').toString().trim();
    } else {
      // Se non troviamo la colonna fornitore, prova a cercare in tutte le colonne testuali
      for (const key of keys) {
        const val = row[key];
        if (val && typeof val === 'string' && val.length > 2) {
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
          const isNumeric = !isNaN(parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.')));
          // Non è una data, non è un numero, e ha almeno 3 caratteri
          if (!datePattern.test(val) && !isNumeric && val.length >= 3) {
            // Verifica che non sia un'etichetta di header comune
            const lowerVal = val.toLowerCase();
            if (!lowerVal.includes('importo') && !lowerVal.includes('totale') && 
                !lowerVal.includes('imponibile') && !lowerVal.includes('data') &&
                !lowerVal.includes('fattura') && !lowerVal.includes('descrizione')) {
              fornitore = val.trim();
              if (!finalFornitoreCol) {
                finalFornitoreCol = key; // Salva per prossime iterazioni
                console.log(`Fornitore identificato nella colonna "${key}"`);
              }
              break;
            }
          }
        }
      }
    }
    
    // Se ancora non abbiamo il fornitore, prova con la prima colonna non numerica
    if (!fornitore || fornitore.length < 2) {
      for (const key of keys) {
        if (key === finalImportoCol || key === descrizioneCol || key === dataCol) continue;
        const val = row[key];
        if (val && typeof val === 'string' && val.trim().length >= 2) {
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
          if (!datePattern.test(val.trim())) {
            fornitore = val.toString().trim();
            console.log(`Fornitore trovato in colonna fallback "${key}": "${fornitore}"`);
            break;
          }
        }
      }
    }
    
    const importoStr = (row[finalImportoCol || ''] || '').toString().trim();
    const descrizione = (row[descrizioneCol || ''] || '').toString().trim();
    const dataFattura = (row[dataCol || ''] || '').toString().trim();
    const categoria = (row[categoriaCol || ''] || '').toString().trim();
    
    // Log per debug se fornitore è ancora vuoto
    if (!fornitore || fornitore.length < 2) {
      console.warn(`⚠️ Riga ${index + 1}: Fornitore non trovato. Righe disponibili:`, Object.keys(row));
      console.warn(`   Valori riga:`, row);
    }
    
    // Estrai importo (rimuovi simboli e converti)
    let importo = 0;
    if (importoStr) {
      // Gestisci diversi formati numerici
      let cleaned = importoStr.toString().trim();
      // Rimuovi simboli di valuta ma mantieni segno negativo
      cleaned = cleaned.replace(/[€$£]/g, '').trim();
      // Gestisci formato italiano (1.234,56) e inglese (1,234.56)
      if (cleaned.includes(',') && cleaned.includes('.')) {
        // Determina quale è il separatore decimale
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) {
          // Formato italiano: 1.234,56
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // Formato inglese: 1,234.56
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (cleaned.includes(',')) {
        // Potrebbe essere separatore decimale o migliaia
        cleaned = cleaned.replace(',', '.');
      }
      // Rimuovi tutto tranne numeri, punto e meno
      cleaned = cleaned.replace(/[^\d.-]/g, '');
      importo = parseFloat(cleaned) || 0;
    }
    
    // Se ancora non ha importo, cerca in tutte le colonne numeriche (escludi la prima che è solitamente testo)
    if (importo === 0 || importo < 1) {
      const numericKeys = keys.filter(key => {
        // Salta colonne testuali evidenti
        const keyLower = key.toLowerCase();
        if (keyLower.includes('fornitore') || keyLower.includes('ragione') || keyLower.includes('descrizione') || 
            keyLower.includes('oggetto') || keyLower.includes('causale')) {
          return false;
        }
        return true;
      });
      
      for (const key of numericKeys) {
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          let str = val.toString().trim();
          // Stesso trattamento del valore importo
          str = str.replace(/[€$£]/g, '').trim();
          if (str.includes(',') && str.includes('.')) {
            const lastComma = str.lastIndexOf(',');
            const lastDot = str.lastIndexOf('.');
            if (lastComma > lastDot) {
              str = str.replace(/\./g, '').replace(',', '.');
            } else {
              str = str.replace(/,/g, '');
            }
          } else if (str.includes(',')) {
            str = str.replace(',', '.');
          }
          str = str.replace(/[^\d.-]/g, '');
          const num = parseFloat(str);
          if (!isNaN(num) && Math.abs(num) > 1) { // Ignora valori molto piccoli
            importo = Math.abs(num);
            if (!finalImportoCol) {
              finalImportoCol = key; // Salva quale colonna ha funzionato
            }
            break;
          }
        }
      }
    }
    
    // Salta se non ci sono dati essenziali
    if (importo === 0 || importo < 1) {
      // Ultimo tentativo: cerca in tutte le colonne tranne quelle testuali
      for (const key of keys) {
        if (key === finalFornitoreCol || key === descrizioneCol) continue;
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          const num = parseFloat(val.toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
          if (!isNaN(num) && Math.abs(num) > 1 && Math.abs(num) < 1000000) { // Limite ragionevole
            importo = Math.abs(num);
            break;
          }
        }
      }
      if (importo === 0 || importo < 1) {
        console.log('Riga saltata - importo non trovato o troppo piccolo:', row);
        return;
      }
    }
    
    // Validazione importo: se è troppo grande, probabilmente è un errore di parsing
    // Filtra valori sopra 100.000€ (probabilmente errore di formato)
    // Nota: alcuni hotel possono avere costi molto alti, ma valori sopra 100k sono sospetti
    if (importo > 100000) {
      console.warn(`⚠️ Riga ${index + 1}: Importo molto alto (€${importo.toFixed(2)}), potrebbe essere errore di formato. Saltando...`);
      console.warn(`   Valore originale dalla colonna "${finalImportoCol}": "${importoStr}"`);
      console.warn(`   Righe intera:`, row);
      return; // Salta questa riga
    }
    
    // Valida anche il fornitore: non deve essere una data
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
    if (datePattern.test(fornitore.trim())) {
      console.warn(`⚠️ Riga ${index + 1}: Fornitore sembra essere una data (${fornitore}), cercando colonna corretta...`);
      // Prova a trovare una colonna testuale migliore
      for (const key of keys) {
        const val = row[key];
        if (val && typeof val === 'string' && val.length > 5 && !datePattern.test(val.trim()) &&
            !key.toLowerCase().includes('data') && !key.toLowerCase().includes('date')) {
          const testVal = val.trim();
          // Verifica che non sia numerico
          if (isNaN(parseFloat(testVal.replace(/[^\d.,-]/g, '').replace(',', '.')))) {
            console.log(`  Usando colonna "${key}" come fornitore: "${testVal.substring(0, 30)}"`);
            // Non cambiamo qui per non rompere il flusso, ma logghiamo
            break;
          }
        }
      }
      // Continua comunque, ma logghiamo
    }
    
    // NON categorizziamo automaticamente - lasciamo all'utente la scelta
    // Genera un ID univoco per ogni costo
    const costId = `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Usa il fornitore trovato o prova a estrarlo dalle altre colonne
    let finalFornitore = fornitore && fornitore.length >= 2 ? fornitore : '';
    
    // Se ancora non abbiamo fornitore, prova a cercare in tutte le colonne della riga
    if (!finalFornitore || finalFornitore.length < 2) {
      // Prova tutte le colonne in ordine, escludendo quelle già usate
      for (const key of keys) {
        if (key === finalImportoCol || key === descrizioneCol || key === dataCol) continue;
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          const str = val.toString().trim();
          // Non è vuoto, non è un numero, non è una data
          if (str.length >= 2) {
            const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
            const isNumeric = !isNaN(parseFloat(str.replace(/[^\d.,-]/g, '').replace(',', '.')));
            if (!datePattern.test(str) && !isNumeric) {
              // Verifica che non sia una label di header
              const lowerStr = str.toLowerCase();
              if (!lowerStr.includes('importo') && !lowerStr.includes('totale') && 
                  !lowerStr.includes('imponibile') && !lowerStr.includes('data') &&
                  !lowerStr.includes('fattura') && !lowerStr.includes('descrizione') &&
                  !lowerStr.includes('fornitore') && !lowerStr.includes('ragione')) {
                finalFornitore = str;
                console.log(`Fornitore trovato in colonna "${key}": "${finalFornitore}"`);
                if (!finalFornitoreCol) {
                  finalFornitoreCol = key;
                }
                break;
              }
            }
          }
        }
      }
    }
    
    // Se ancora non abbiamo fornitore, usa placeholder
    if (!finalFornitore || finalFornitore.length < 2) {
      console.error(`❌ ERRORE: Fornitore non trovato per riga ${index + 1}`);
      console.error(`   Colonne disponibili:`, Object.keys(row));
      console.error(`   Valori:`, Object.entries(row).map(([k, v]) => `"${k}": "${v}"`).join(', '));
      finalFornitore = `Fornitore Mancante ${index + 1}`;
    }
    
    console.log(`✓ Costo ${index + 1}: Fornitore="${finalFornitore}", Importo=€${importo.toFixed(2)}`);
    
    costs.push({
      id: costId,
      fornitore: finalFornitore,
      importo: Math.abs(importo), // Usa valore assoluto (le fatture possono essere negative)
      categoria: undefined, // L'utente dovrà categorizzare manualmente
      descrizione: descrizione || '',
      data: dataFattura,
    });
  });
  
  console.log('Costi estratti:', costs.length);
  
  return costs;
}

/**
 * Parse Excel come array di array (formato alternativo)
 */
function parseExcelAsArray(data: any[]): ImportedCost[] {
  const costs: ImportedCost[] = [];
  
  // Trova la riga header
  let headerRow = 0;
  for (let i = 0; i < Math.min(data.length, 5); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      const rowStr = row.join(' ').toLowerCase();
      if (rowStr.includes('importo') || rowStr.includes('fornitore') || rowStr.includes('totale')) {
        headerRow = i;
        break;
      }
    }
  }
  
  // Se trova header, usa quella riga come riferimento
  if (Array.isArray(data[headerRow])) {
    const headers = data[headerRow] as string[];
    
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      
      // Cerca colonne
      const fornitoreIdx = headers.findIndex(h => h?.toLowerCase().includes('fornitore') || h?.toLowerCase().includes('ragione'));
      const importoIdx = headers.findIndex(h => h?.toLowerCase().includes('importo') || h?.toLowerCase().includes('totale'));
      
      const fornitore = (row[fornitoreIdx] || '').toString().trim();
      const importoStr = (row[importoIdx] || '').toString().trim();
      const importo = parseFloat(importoStr.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      
      if (importo > 0) {
        const costId = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`;
        costs.push({
          id: costId,
          fornitore: fornitore || `Fornitore ${i}`,
          importo: Math.abs(importo),
          categoria: undefined, // L'utente dovrà categorizzare manualmente
          descrizione: '',
        });
      }
    }
  }
  
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
  console.log('Mapping', costs.length, 'costi importati per il mese', mese);
  
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
  
  console.log('Costi da processare:', costs.map(c => ({ 
    fornitore: c.fornitore, 
    importo: c.importo, 
    categoria: c.categoria 
  })));
  
  console.log('Inizio mapping costi...');
  
  costs.forEach((cost, index) => {
    console.log(`Processando costo ${index + 1}/${costs.length}:`, {
      fornitore: cost.fornitore,
      importo: cost.importo,
      categoria: cost.categoria
    });
    
    switch (cost.categoria) {
      case 'Ristorazione':
        if (!costsData.ristorazione) costsData.ristorazione = [];
        costsData.ristorazione.push({
          fornitore: cost.fornitore,
          importo: cost.importo,
        });
        console.log(`Aggiunto a ristorazione. Totale items: ${costsData.ristorazione.length}`);
        break;
        
      case 'Utenze - Energia':
        if (costsData.utenze) {
          if (!costsData.utenze.energia || costsData.utenze.energia.importo === 0) {
            costsData.utenze.energia = { fornitore: cost.fornitore, importo: 0 };
          }
          costsData.utenze.energia.importo += cost.importo;
          if (!costsData.utenze.energia.fornitore || costsData.utenze.energia.fornitore === '') {
            costsData.utenze.energia.fornitore = cost.fornitore;
          }
          console.log(`Aggiunto a utenze energia. Totale: ${costsData.utenze.energia.importo}`);
        }
        break;
        
      case 'Utenze - Gas':
        if (costsData.utenze) {
          if (!costsData.utenze.gas || costsData.utenze.gas.importo === 0) {
            costsData.utenze.gas = { fornitore: cost.fornitore, importo: 0 };
          }
          costsData.utenze.gas.importo += cost.importo;
          if (!costsData.utenze.gas.fornitore || costsData.utenze.gas.fornitore === '') {
            costsData.utenze.gas.fornitore = cost.fornitore;
          }
          console.log(`Aggiunto a utenze gas. Totale: ${costsData.utenze.gas.importo}`);
        }
        break;
        
      case 'Utenze - Acqua':
        if (costsData.utenze) {
          if (!costsData.utenze.acqua || costsData.utenze.acqua.importo === 0) {
            costsData.utenze.acqua = { fornitore: cost.fornitore, importo: 0 };
          }
          costsData.utenze.acqua.importo += cost.importo;
          if (!costsData.utenze.acqua.fornitore || costsData.utenze.acqua.fornitore === '') {
            costsData.utenze.acqua.fornitore = cost.fornitore;
          }
          console.log(`Aggiunto a utenze acqua. Totale: ${costsData.utenze.acqua.importo}`);
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
        console.log(`Aggiunto a pulizie. Totale: ${costsData.altriCosti.pulizie}`);
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
        // Usa un nome più leggibile per la chiave
        const key = cost.categoria 
          ? cost.categoria.toLowerCase().replace(/\s+/g, '')
          : cost.fornitore.toLowerCase().replace(/\s+/g, '').substring(0, 20);
        costsData.altriCosti[key] = (costsData.altriCosti[key] || 0) + cost.importo;
        break;
    }
  });
  
  // Pulisci valori vuoti o zero
  if (costsData.ristorazione && costsData.ristorazione.length === 0) {
    delete costsData.ristorazione;
  }
  
  // Rimuovi utenze con importo zero
  if (costsData.utenze) {
    if (costsData.utenze.energia?.importo === 0) {
      costsData.utenze.energia = { fornitore: '', importo: 0 };
    }
    if (costsData.utenze.gas?.importo === 0) {
      costsData.utenze.gas = { fornitore: '', importo: 0 };
    }
    if (costsData.utenze.acqua?.importo === 0) {
      costsData.utenze.acqua = { fornitore: '', importo: 0 };
    }
  }
  
  // Rimuovi personale con valori zero
  if (costsData.personale) {
    if (costsData.personale.bustePaga === 0 && costsData.personale.sicurezza === 0) {
      costsData.personale = { bustePaga: 0, sicurezza: 0 };
    }
  }
  
  // Rimuovi altri costi con valori zero
  if (costsData.altriCosti) {
    Object.keys(costsData.altriCosti).forEach(key => {
      if (!costsData.altriCosti![key] || costsData.altriCosti![key] === 0) {
        delete costsData.altriCosti![key];
      }
    });
    if (Object.keys(costsData.altriCosti).length === 0) {
      costsData.altriCosti = {};
    }
  }
  
  console.log('Costi mappati finali:', costsData);
  
  return costsData;
}

