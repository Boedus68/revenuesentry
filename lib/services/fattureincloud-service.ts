// Servizio per integrazione Fatture in Cloud API
// Documentazione: https://developers.fattureincloud.it/api-reference/

import { getAdminDb } from '../firebase-admin';
import { logAdmin } from '../admin-log';
import { ImportedCost } from '../xls-parser';

const FIC_API_BASE_URL = 'https://api-v2.fattureincloud.it';
const FIC_OAUTH_BASE_URL = 'https://api-v2.fattureincloud.it';

export interface FattureInCloudConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  companyId?: string;
  expiresAt?: number; // Timestamp quando scade l'access token
  enabled: boolean;
}

export interface FICExpense {
  id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  description?: string;
  category?: string;
  supplier_name?: string;
  payment_account?: {
    name: string;
  };
  payment_method?: {
    name: string;
  };
  type?: string; // 'expense', 'receipt', etc.
}

export interface FICReceivedDocument {
  id: number;
  date: string;
  amount_net: number;
  amount_vat: number;
  amount_gross: number; // Totale con IVA (amount_net + amount_vat)
  entity?: {
    id: number;
    name: string;
  };
  supplier_name?: string; // Per retrocompatibilità
  items?: Array<{
    name: string;
    amount: number;
  }>;
  type?: string; // 'expense', 'receipt', etc.
}

/**
 * Ottiene l'URL di autorizzazione OAuth per Fatture in Cloud
 */
export function getFICOAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Scope corretti per Fatture in Cloud:
    // - received_documents:r per documenti ricevuti (fatture di acquisto)
    // - cashbook:r per prima nota (spese)
    scope: 'received_documents:r cashbook:r',
    state: state || Math.random().toString(36).substring(7),
  });

  return `${FIC_OAUTH_BASE_URL}/oauth/authorize?${params.toString()}`;
}

/**
 * Scambia il codice di autorizzazione per un access token
 */
export async function exchangeFICCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch(`${FIC_OAUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Fatture in Cloud OAuth error: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Aggiorna l'access token usando il refresh token
 */
export async function refreshFICAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch(`${FIC_OAUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Fatture in Cloud refresh token error: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Ottiene un access token valido (rinnova se necessario)
 */
export async function getValidAccessToken(
  config: FattureInCloudConfig
): Promise<string> {
  if (!config.accessToken || !config.refreshToken) {
    throw new Error('Fatture in Cloud non configurato. Completa l\'autenticazione OAuth.');
  }

  // Se il token è ancora valido (con margine di 5 minuti)
  if (config.expiresAt && config.expiresAt > Date.now() + 5 * 60 * 1000) {
    return config.accessToken;
  }

  // Rinnova il token
  logAdmin('[FIC] Rinnovo access token');
  const tokenData = await refreshFICAccessToken(
    config.refreshToken,
    config.clientId,
    config.clientSecret
  );

  // Salva il nuovo token (questo sarà fatto dall'API route che chiama questa funzione)
  return tokenData.access_token;
}

/**
 * Recupera la lista delle aziende associate all'account
 */
export async function getFICCompanies(accessToken: string): Promise<Array<{ id: number; name: string }>> {
  const response = await fetch(`${FIC_API_BASE_URL}/user/companies`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Fatture in Cloud API error: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  return data.data?.companies || [];
}

/**
 * Recupera le spese da Fatture in Cloud per un periodo specifico
 * Usa l'endpoint cashbook per recuperare le voci di prima nota (spese)
 */
export async function getFICExpenses(
  accessToken: string,
  companyId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<FICExpense[]> {
  // Usa l'endpoint cashbook per recuperare le spese
  // Filtra per tipo "out" (uscite) e per periodo
  // L'API richiede date_from e date_to invece di start_date e end_date
  
  // Gestiamo la paginazione: recuperiamo tutte le pagine
  let allCashbookEntries: any[] = [];
  let currentPage = 1;
  const perPage = 100; // Massimo consentito dall'API
  let hasMorePages = true;
  
  while (hasMorePages) {
    const url = `${FIC_API_BASE_URL}/c/${companyId}/cashbook?date_from=${startDate}&date_to=${endDate}&type=out&page=${currentPage}&per_page=${perPage}`;
    logAdmin(`[FIC] Chiamata API cashbook pagina ${currentPage}: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logAdmin(`[FIC] Errore API cashbook: ${response.status} - ${errorText}`);
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Fatture in Cloud API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    // Il cashbook può restituire i dati in diversi formati:
    // 1. Direttamente come array: [{...}, {...}]
    // 2. In data.data: { data: [{...}, {...}] }
    // 3. In data.data.items: { data: { items: [{...}, {...}] } }
    // 4. In data.items: { items: [{...}, {...}] }
    let pageCashbookEntries: any[] = [];
    if (Array.isArray(data)) {
      pageCashbookEntries = data;
    } else if (Array.isArray(data.data)) {
      pageCashbookEntries = data.data;
    } else if (Array.isArray(data.data?.items)) {
      pageCashbookEntries = data.data.items;
    } else if (Array.isArray(data.items)) {
      pageCashbookEntries = data.items;
    } else if (data.data && typeof data.data === 'object') {
      // Cerca qualsiasi proprietà che sia un array
      const arrayProp = Object.values(data.data).find((v: any) => Array.isArray(v));
      if (arrayProp) {
        pageCashbookEntries = arrayProp as any[];
      }
    }
    
    allCashbookEntries = allCashbookEntries.concat(pageCashbookEntries);
    
    // Verifica se ci sono più pagine
    const lastPage = data.last_page || data.pagination?.last_page || Math.ceil((data.total || pageCashbookEntries.length) / perPage);
    hasMorePages = currentPage < lastPage && pageCashbookEntries.length === perPage;
    
    logAdmin(`[FIC] Pagina ${currentPage} cashbook: ${pageCashbookEntries.length} voci (totale: ${allCashbookEntries.length})`);
    
    if (hasMorePages) {
      currentPage++;
    } else {
      break;
    }
  }
  
  logAdmin(`[FIC] Trovate ${allCashbookEntries.length} voci cashbook totali (${currentPage} pagina/e)`);
  
  const cashbookEntries = allCashbookEntries;
  
  if (cashbookEntries.length > 0) {
    logAdmin(`[FIC] Prima voce cashbook esempio:`, { id: cashbookEntries[0].id, date: cashbookEntries[0].date, amount: cashbookEntries[0].amount, keys: Object.keys(cashbookEntries[0]) });
  }
  
  // Mappa le voci cashbook nel formato corretto
  const mappedExpenses = cashbookEntries
    .map((entry: any) => {
      // Gestisci l'importo in modo sicuro
      const rawAmount = entry.amount;
      let amount = 0;
      if (rawAmount != null && !isNaN(Number(rawAmount))) {
        amount = Math.abs(Number(rawAmount)); // Le uscite sono negative, convertiamo in positivo
      }
      
      return {
        id: entry.id,
        date: entry.date,
        amount: amount,
        description: entry.description || entry.notes || entry.note || '',
        category: entry.category?.name || entry.category_name || entry.category || undefined,
        supplier_name: entry.entity_name || entry.supplier_name || entry.entity?.name || entry.supplier?.name || undefined,
        payment_account: entry.payment_account ? { name: entry.payment_account.name || entry.payment_account } : undefined,
        payment_method: entry.payment_method ? { name: entry.payment_method.name || entry.payment_method } : undefined,
        type: 'expense',
      };
    })
    .filter((expense) => expense.amount > 0); // Filtra solo le spese con importo valido

  // Filtra le spese per assicurarsi che siano nel periodo richiesto
  // (l'API potrebbe restituire spese fuori dal range)
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999); // Fine del giorno
  
  const filteredExpenses = mappedExpenses.filter((expense) => {
    if (!expense.date) return false;
    const expenseDate = new Date(expense.date);
    return expenseDate >= startDateObj && expenseDate <= endDateObj;
  });

  if (filteredExpenses.length !== mappedExpenses.length) {
    logAdmin(`[FIC] Filtro periodo cashbook: ${mappedExpenses.length} spese totali, ${filteredExpenses.length} nel periodo ${startDate} - ${endDate}`);
  }

  return filteredExpenses;
}

/**
 * Recupera i documenti ricevuti (fatture di acquisto) da Fatture in Cloud
 */
export async function getFICReceivedDocuments(
  accessToken: string,
  companyId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<FICReceivedDocument[]> {
  // L'API di Fatture in Cloud usa il parametro 'q' per filtrare i documenti
  // Formato: date >= 'YYYY-MM-DD' AND date <= 'YYYY-MM-DD'
  const query = `date >= '${startDate}' AND date <= '${endDate}'`;
  
  // Gestiamo la paginazione: recuperiamo tutte le pagine
  let allDocuments: any[] = [];
  let currentPage = 1;
  const perPage = 100; // Massimo consentito dall'API
  let hasMorePages = true;
  
  while (hasMorePages) {
    const url = `${FIC_API_BASE_URL}/c/${companyId}/received_documents?q=${encodeURIComponent(query)}&page=${currentPage}&per_page=${perPage}`;
    logAdmin(`[FIC] Chiamata API received_documents pagina ${currentPage}: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logAdmin(`[FIC] Errore API received_documents: ${response.status} - ${errorText}`);
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Fatture in Cloud API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    // Estrai i documenti dalla risposta
    let pageDocuments: any[] = [];
    if (Array.isArray(data)) {
      pageDocuments = data;
    } else if (Array.isArray(data.data)) {
      pageDocuments = data.data;
    } else if (Array.isArray(data.data?.items)) {
      pageDocuments = data.data.items;
    } else if (Array.isArray(data.items)) {
      pageDocuments = data.items;
    } else if (data.data && typeof data.data === 'object') {
      // Cerca qualsiasi proprietà che sia un array
      const arrayProp = Object.values(data.data).find((v: any) => Array.isArray(v));
      if (arrayProp) {
        pageDocuments = arrayProp as any[];
      }
    }
    
    allDocuments = allDocuments.concat(pageDocuments);
    
    // Verifica se ci sono più pagine
    const lastPage = data.last_page || data.pagination?.last_page || Math.ceil((data.total || pageDocuments.length) / perPage);
    hasMorePages = currentPage < lastPage && pageDocuments.length === perPage;
    
    logAdmin(`[FIC] Pagina ${currentPage}: ${pageDocuments.length} documenti (totale: ${allDocuments.length})`);
    
    if (hasMorePages) {
      currentPage++;
    } else {
      break;
    }
  }
  
  logAdmin(`[FIC] Trovati ${allDocuments.length} documenti ricevuti totali (${currentPage} pagina/e)`);
  
  const documents = allDocuments;
  
  if (documents.length > 0) {
    logAdmin(`[FIC] Primo documento esempio:`, { 
      id: documents[0].id, 
      date: documents[0].date, 
      amount_gross: documents[0].amount_gross,
      amount_net: documents[0].amount_net,
      amount_vat: documents[0].amount_vat,
      entity: documents[0].entity,
      keys: Object.keys(documents[0]) 
    });
  }
  
  // Mappa i documenti nel formato corretto
  const mappedDocuments = documents.map((doc: any): FICReceivedDocument => ({
    id: doc.id,
    date: doc.date,
    amount_net: doc.amount_net || 0,
    amount_vat: doc.amount_vat || 0,
    amount_gross: doc.amount_gross || (doc.amount_net || 0) + (doc.amount_vat || 0), // Se amount_gross non esiste, calcolalo
    entity: doc.entity ? {
      id: doc.entity.id,
      name: doc.entity.name || '',
    } : undefined,
    supplier_name: doc.entity?.name || doc.supplier_name, // Per retrocompatibilità
    items: doc.items,
    type: doc.type,
  }));

  // Filtra i documenti per assicurarsi che siano nel periodo richiesto
  // (l'API potrebbe restituire documenti fuori dal range)
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999); // Fine del giorno
  
  const filteredDocuments = mappedDocuments.filter((doc) => {
    if (!doc.date) return false;
    const docDate = new Date(doc.date);
    return docDate >= startDateObj && docDate <= endDateObj;
  });

  if (filteredDocuments.length !== mappedDocuments.length) {
    logAdmin(`[FIC] Filtro periodo: ${mappedDocuments.length} documenti totali, ${filteredDocuments.length} nel periodo ${startDate} - ${endDate}`);
  }

  return filteredDocuments;
}

/**
 * Converte le spese di Fatture in Cloud nel formato ImportedCost
 */
export function convertFICExpensesToImportedCosts(
  expenses: FICExpense[],
  month: string // YYYY-MM
): ImportedCost[] {
  return expenses
    .filter((expense) => {
      // Filtra le spese con importo valido (non null, non undefined, non NaN)
      const amount = expense.amount;
      return amount != null && !isNaN(Number(amount)) && Number(amount) !== 0;
    })
    .map((expense, index) => {
      // Assicurati che l'importo sia sempre un numero valido
      const amount = expense.amount;
      const importo = amount != null && !isNaN(Number(amount)) 
        ? Math.abs(Number(amount)) 
        : 0;
      
      return {
        id: `fic-expense-${expense.id}-${index}`,
        fornitore: expense.supplier_name || expense.payment_account?.name || 'Fornitore sconosciuto',
        importo: importo,
        categoria: expense.category || undefined,
        data: expense.date,
        descrizione: expense.description || `Spesa Fatture in Cloud #${expense.id}`,
      };
    });
}

/**
 * Converte i documenti ricevuti di Fatture in Cloud nel formato ImportedCost
 */
export function convertFICDocumentsToImportedCosts(
  documents: FICReceivedDocument[],
  month: string // YYYY-MM
): ImportedCost[] {
  return documents
    .filter((doc) => {
      // Filtra i documenti con importo totale valido (non null, non undefined, non NaN)
      // Usa amount_gross (totale con IVA) invece di amount_total
      const amountGross = doc.amount_gross;
      return amountGross != null && !isNaN(Number(amountGross)) && Number(amountGross) !== 0;
    })
    .map((doc, index) => {
      // Assicurati che l'importo sia sempre un numero valido
      // Usa amount_gross (totale con IVA) invece di amount_total
      const amountGross = doc.amount_gross;
      const importo = amountGross != null && !isNaN(Number(amountGross))
        ? Math.abs(Number(amountGross))
        : 0;
      
      // Usa entity.name se disponibile, altrimenti supplier_name
      const fornitore = doc.entity?.name || doc.supplier_name || 'Fornitore sconosciuto';
      
      return {
        id: `fic-doc-${doc.id}-${index}`,
        fornitore: fornitore,
        importo: importo, // Usa il totale con IVA (amount_gross)
        categoria: undefined, // I documenti ricevuti non hanno categoria predefinita
        data: doc.date,
        descrizione: `Fattura acquisto #${doc.id}${doc.items && doc.items.length > 0 ? ` - ${doc.items.map(i => i.name).join(', ')}` : ''}`,
      };
    });
}

/**
 * Salva la configurazione Fatture in Cloud in Firestore
 */
export async function saveFICConfig(
  userId: string,
  config: Partial<FattureInCloudConfig>
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Firebase Admin non inizializzato');
  }

  const userDocRef = adminDb.collection('users').doc(userId);
  await userDocRef.set(
    {
      fattureInCloudConfig: config,
    },
    { merge: true }
  );

  logAdmin(`[FIC] Configurazione salvata per utente ${userId}`);
}

/**
 * Recupera la configurazione Fatture in Cloud da Firestore
 */
export async function getFICConfig(userId: string): Promise<FattureInCloudConfig | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Firebase Admin non inizializzato');
  }

  const userDocRef = adminDb.collection('users').doc(userId);
  const userDocSnap = await userDocRef.get();

  if (!userDocSnap.exists) {
    return null;
  }

  const userData = userDocSnap.data();
  return userData?.fattureInCloudConfig || null;
}
