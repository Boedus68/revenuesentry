// Parser per PDF buste paga
// Estrae nominativi e importi dalle buste paga e rileva duplicati

// Import dinamico per evitare problemi SSR con Next.js
let pdfjsLib: any = null;
let workerInitialized = false;

async function getPdfjsLib() {
  if (!pdfjsLib && typeof window !== 'undefined') {
    pdfjsLib = await import('pdfjs-dist');
    
    // Configura il worker solo una volta
    if (!workerInitialized) {
      // La versione viene letta dinamicamente da pdfjsLib.version
      const version = pdfjsLib.version || '4.10.38';
      
      // Per pdfjs-dist v4+, il worker è in formato .mjs
      // Prova prima con il worker locale (se presente nella cartella public)
      // Fallback a CDN se il worker locale non è disponibile
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      
      // Verifica se il worker locale esiste, altrimenti usa il CDN
      // Questo viene fatto in modo asincrono per non bloccare l'inizializzazione
      if (typeof window !== 'undefined') {
        fetch('/pdf.worker.min.mjs', { method: 'HEAD' })
          .catch(() => {
            // Worker locale non trovato, usa CDN con versione corretta
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
          });
      }
      
      workerInitialized = true;
    }
  }
  return pdfjsLib;
}

export interface PayrollEntry {
  nominativo: string;
  importo: number;
  data?: string; // Data della busta paga se disponibile
}

export interface ParsedPayrollData {
  entries: PayrollEntry[];
  totalAmount: number;
  duplicatesRemoved: number;
}

/**
 * Estrae il testo da un PDF
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjs = await getPdfjsLib();
  if (!pdfjs) {
    throw new Error('pdfjs-dist non disponibile nel browser');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

/**
 * Estrae nominativo da una sezione di testo della busta paga
 * Cerca pattern comuni nelle buste paga italiane
 */
function extractNominativo(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Pattern 1: "DIPENDENTE: Cognome Nome" o "Lavoratore: Nome Cognome"
  for (const line of lines) {
    const match1 = line.match(/(?:DIPENDENTE|LAVORATORE|NOMINATIVO|EMPLOYEE|WORKER|COGNOME\s+E\s+NOME)[:\s]+([A-ZÀÈÉÌÒÙ][A-ZÀÈÉÌÒÙa-zàèéìòù\s]{2,50})/i);
    if (match1) {
      const nome = match1[1].trim();
      // Pulisci il nome da eventuali caratteri extra
      const cleaned = nome.replace(/[^\w\sÀÈÉÌÒÙàèéìòù]/g, '').trim();
      if (cleaned.length >= 3) {
        return cleaned;
      }
    }
  }
  
  // Pattern 2: Righe con solo nome e cognome (2-4 parole, almeno una maiuscola)
  for (const line of lines) {
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 5) {
      // Verifica che almeno 2 parole inizino con maiuscola
      const capitalizedWords = words.filter(w => /^[A-ZÀÈÉÌÒÙ]/.test(w));
      if (capitalizedWords.length >= 2) {
        // Escludi parole comuni che non sono nomi
        const excludeWords = [
          'TOTALE', 'NETTO', 'LORDO', 'IMPORTO', 'EURO', 'MESE', 'ANNO', 
          'PERIODO', 'BUSTA', 'PAGA', 'BUSTA PAGA', 'DA', 'PAGARE', 
          'CODICE', 'FISCALE', 'PARTITA', 'IVA', 'MATRICOLA', 'CONTRATTO',
          'QUALIFICA', 'CATEGORIA', 'LIVELLO', 'REPARTO', 'SEDE'
        ];
        const upperWords = words.map(w => w.toUpperCase());
        if (!upperWords.some(w => excludeWords.includes(w))) {
          // Verifica che non sia solo numeri o date
          if (!/^\d+$/.test(words.join('')) && !/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
            return words.join(' ').trim();
          }
        }
      }
    }
  }
  
  // Pattern 3: Cerca nella parte superiore del documento (primi 20 righe)
  // Spesso il nome è all'inizio della busta paga
  const topLines = lines.slice(0, 20);
  for (const line of topLines) {
    // Cerca pattern tipo "COGNOME Nome" o "Nome COGNOME"
    const namePattern = /^([A-ZÀÈÉÌÒÙ]{2,20})\s+([A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,20})(?:\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,20})?$/;
    const match = line.match(namePattern);
    if (match) {
      return line.trim();
    }
  }
  
  return null;
}

/**
 * Estrae il valore "NETTO BUSTA" da una sezione di testo
 * Cerca SOLO "NETTO BUSTA" e prende SOLO il valore associato a quella label
 * Versione semplificata per file singoli
 */
function extractNettoBusta(text: string): number | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Cerca SOLO "NETTO BUSTA" (pattern molto specifico)
  const nettoBustaPattern = /NETTO\s+BUSTA/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Cerca SOLO la label esatta "NETTO BUSTA"
    const match = line.match(nettoBustaPattern);
    if (match) {
      // Estrai il valore dalla stessa riga, cercando il valore che viene DOPO "NETTO BUSTA"
      const value = extractValueAfterLabel(line, 'NETTO BUSTA');
      if (value !== null && value > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[PDF Parser] ✓ Trovato NETTO BUSTA nella riga ${i + 1}: €${value.toFixed(2)}`);
          console.log(`[PDF Parser] Riga completa: "${line}"`);
        }
        return value;
      }
      
      // Se non trovato nella stessa riga, cerca nella riga successiva (solo una)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Verifica che la riga successiva non contenga altre label che potrebbero confondere
        if (!/^(?:TOTALE|LORDO|IMPORTO|NETTO|DA|PAGARE|BUSTA|PAGA)/i.test(nextLine)) {
          const value = extractValueFromLine(nextLine);
          if (value !== null && value > 0 && value <= 5000) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[PDF Parser] ✓ Trovato NETTO BUSTA nella riga ${i + 2}: €${value.toFixed(2)}`);
              console.log(`[PDF Parser] Riga successiva: "${nextLine}"`);
            }
            return value;
          }
        }
      }
      
      // Debug: se ha trovato "NETTO BUSTA" ma non il valore
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[PDF Parser] ⚠ Trovato "NETTO BUSTA" nella riga ${i + 1} ma valore non estratto`);
        console.warn(`[PDF Parser] Riga: "${line}"`);
        if (i + 1 < lines.length) {
          console.warn(`[PDF Parser] Riga successiva: "${lines[i + 1]}"`);
        }
      }
    }
  }
  
  // Debug: mostra tutte le righe che contengono "NETTO" per capire cosa c'è
  if (process.env.NODE_ENV === 'development') {
    const nettoLines = lines.filter(l => /NETTO/i.test(l));
    if (nettoLines.length > 0) {
      console.warn(`[PDF Parser] ⚠ Righe con "NETTO" trovate (ma non "NETTO BUSTA"):`, nettoLines);
    } else {
      console.warn(`[PDF Parser] ⚠ Nessuna riga con "NETTO" trovata nel documento`);
    }
  }
  
  return null;
}

/**
 * Estrae un valore numerico che viene DOPO una label specifica nella stessa riga
 * Esempio: "NETTO BUSTA 1.234,56 €" -> 1234.56
 * Versione migliorata: cerca il valore IMMEDIATAMENTE dopo la label, evitando altri campi
 */
function extractValueAfterLabel(line: string, label: string): number | null {
  // Crea un pattern per trovare la label e il valore dopo
  const labelIndex = line.search(new RegExp(label, 'i'));
  if (labelIndex === -1) {
    return null;
  }
  
  // Estrai la parte della riga dopo la label (massimo 80 caratteri per evitare di prendere valori lontani)
  const afterLabel = line.substring(labelIndex + label.length, labelIndex + label.length + 80).trim();
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PDF Parser] Testo dopo "${label}": "${afterLabel.substring(0, 80)}"`);
  }
  
  // Cerca il valore IMMEDIATAMENTE dopo la label
  // Priorità: valori con virgola decimale (formato italiano standard per importi)
  // Pattern più specifici che cercano valori con virgola decimale (formato italiano)
  const patterns = [
    // Pattern 1: "NETTO BUSTA 355,00" o "NETTO BUSTA 1.234,56" (valore con virgola subito dopo)
    /^\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s|$|€|F)/,
    // Pattern 2: "NETTO BUSTA 355,00 €" o "NETTO BUSTA 1.234,56 €"
    /^\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/i,
    // Pattern 3: "NETTO BUSTA € 355,00" o "NETTO BUSTA € 1.234,56"
    /^\s*€\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
    // Pattern 4: Valore con virgola nei primi 30 caratteri (ma non parte di altre parole)
    /^[^\d]*(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s|$|€|F|[A-Z])/,
  ];
  
  // Prima cerca valori con virgola decimale (più affidabili)
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = afterLabel.match(pattern);
    if (match) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      // Filtra valori ragionevoli per NETTO BUSTA (tra 50 e 5000 euro)
      if (!isNaN(num) && num >= 50 && num <= 5000) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[PDF Parser] ✓ Valore estratto con pattern ${i + 1}: €${num.toFixed(2)}`);
        }
        return num;
      }
    }
  }
  
  // Fallback: cerca valori senza virgola (ma solo se non ci sono altri valori con virgola prima)
  const fallbackPattern = /^\s*(\d{1,3}(?:\.\d{3})*)(?:\s|$|€|[A-Z])/;
  const fallbackMatch = afterLabel.match(fallbackPattern);
  if (fallbackMatch) {
    const numStr = fallbackMatch[1].replace(/\./g, '');
    const num = parseFloat(numStr);
    // Filtra valori ragionevoli per NETTO BUSTA (tra 50 e 5000 euro)
    if (!isNaN(num) && num >= 50 && num <= 5000) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PDF Parser] ⚠ Valore estratto senza decimali: €${num.toFixed(2)}`);
      }
      return num;
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[PDF Parser] ⚠ Nessun valore valido trovato dopo "${label}"`);
    // Mostra tutti i numeri trovati per debug
    const allNumbers = afterLabel.match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g);
    if (allNumbers) {
      console.warn(`[PDF Parser] Numeri trovati dopo "${label}":`, allNumbers);
    }
  }
  
  return null;
}

/**
 * Estrae un valore numerico da una riga di testo
 * Versione semplificata: prende il primo valore ragionevole trovato
 */
function extractValueFromLine(line: string): number | null {
  // Pattern per importi italiani: "1.234,56 €" o "€ 1.234,56" o "1234,56"
  const patterns = [
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€/i,  // Formato: "1.234,56 €"
    /€\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,  // Formato: "€ 1.234,56"
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,       // Formato: "1.234,56" o "1234,56"
  ];
  
  // Prendi il PRIMO valore trovato che è ragionevole
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const numStr = match[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(numStr);
      // Filtra valori ragionevoli per NETTO BUSTA (tra 50 e 5000 euro)
      if (!isNaN(num) && num >= 50 && num <= 5000) {
        return num;
      }
    }
  }
  
  return null;
}

/**
 * Estrae tutti gli importi da una sezione di testo (per fallback)
 */
function extractImporti(text: string): number[] {
  const importi: number[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const value = extractValueFromLine(line);
    if (value !== null) {
      importi.push(value);
    }
  }
  
  return importi;
}

/**
 * Estrae la data dalla busta paga (se presente)
 */
function extractData(text: string): string | null {
  // Pattern comuni per date: "01/01/2025", "Gennaio 2025", "01-01-2025"
  const datePatterns = [
    /(\d{2}\/\d{2}\/\d{4})/g,
    /(\d{2}-\d{2}-\d{4})/g,
    /(Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre)\s+(\d{4})/gi,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Rileva e rimuove duplicati basati su nominativo e importo
 * Le buste paga sono spesso doppie (una per lavoratore, una per azienda)
 */
function removeDuplicates(entries: PayrollEntry[]): PayrollEntry[] {
  const seen = new Set<string>();
  const unique: PayrollEntry[] = [];
  let duplicatesRemoved = 0;
  
  for (const entry of entries) {
    // Crea una chiave univoca basata su nominativo normalizzato e importo
    const normalizedNominativo = entry.nominativo.toLowerCase().trim();
    const key = `${normalizedNominativo}_${entry.importo.toFixed(2)}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    } else {
      duplicatesRemoved++;
    }
  }
  
  return unique;
}

/**
 * Estrae dati dalle buste paga da un PDF
 * Versione semplificata: analizza TUTTE le pagine e cerca SOLO "NETTO BUSTA"
 */
export async function parsePayrollPDF(file: File): Promise<ParsedPayrollData> {
  const pdfjs = await getPdfjsLib();
  if (!pdfjs) {
    throw new Error('pdfjs-dist non disponibile nel browser');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  
  // Debug: log informazioni
  if (process.env.NODE_ENV === 'development') {
    console.log('[PDF Parser] Totale pagine:', totalPages);
    console.log('[PDF Parser] Analizzando TUTTE le pagine per cercare "NETTO BUSTA"');
  }
  
  const allEntries: PayrollEntry[] = [];
  
  // Estrai testo da TUTTE le pagine
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Migliora l'estrazione del testo mantenendo la struttura delle righe
    // Questo aiuta a trovare meglio i valori associati alle label
    const pageText = textContent.items
      .map((item: any) => {
        // Mantieni gli spazi tra le parole ma aggiungi newline per separare meglio le righe
        if (item.hasEOL) {
          return item.str + '\n';
        }
        return item.str + ' ';
      })
      .join('')
      .replace(/\s+/g, ' ') // Normalizza spazi multipli
      .replace(/\n\s+/g, '\n') // Rimuovi spazi all'inizio riga
      .trim();
    
    if (pageText.trim().length < 50) continue; // Salta pagine troppo corte
    
    // Debug: mostra il testo estratto per le prime pagine
    if (process.env.NODE_ENV === 'development' && pageNum <= 3) {
      console.log(`[PDF Parser] Pagina ${pageNum} testo (prime 500 caratteri):`, pageText.substring(0, 500));
    }
    
    // Cerca SOLO "NETTO BUSTA" in questa pagina
    const nettoBusta = extractNettoBusta(pageText);
    
    if (nettoBusta !== null) {
      // Trovato NETTO BUSTA, cerca il nominativo nella stessa pagina
      const nominativo = extractNominativo(pageText);
      const data = extractData(pageText);
      
      if (nominativo) {
        allEntries.push({
          nominativo,
          importo: nettoBusta,
          data: data || undefined,
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[PDF Parser] ✓ Pagina ${pageNum}: ${nominativo} - €${nettoBusta.toFixed(2)}`);
        }
      } else {
        // Se non trova il nominativo ma ha trovato NETTO BUSTA, usa un nome generico
        allEntries.push({
          nominativo: `Dipendente ${allEntries.length + 1}`,
          importo: nettoBusta,
          data: data || undefined,
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[PDF Parser] ⚠ Pagina ${pageNum}: Trovato NETTO BUSTA (€${nettoBusta.toFixed(2)}) ma nominativo non trovato - usando nome generico`);
        }
      }
    } else {
      // Debug: se non trova NETTO BUSTA
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[PDF Parser] ⚠ Pagina ${pageNum}: "NETTO BUSTA" non trovato`);
      }
    }
  }
  
  // Calcola il totale
  const totalAmount = allEntries.reduce((sum, entry) => sum + entry.importo, 0);
  
  // Debug: log dei risultati
  if (process.env.NODE_ENV === 'development') {
    console.log('[PDF Parser] ========================================');
    console.log('[PDF Parser] Trovate', allEntries.length, 'buste paga');
    console.log('[PDF Parser] Entries:', allEntries.map(e => `${e.nominativo}: €${e.importo.toFixed(2)}`));
    console.log('[PDF Parser] Totale importo:', totalAmount.toFixed(2));
    console.log('[PDF Parser] ========================================');
  }
  
  return {
    entries: allEntries,
    totalAmount,
    duplicatesRemoved: 0,
  };
}
