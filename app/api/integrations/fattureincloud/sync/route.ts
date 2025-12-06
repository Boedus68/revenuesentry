// API route per sincronizzare i costi da Fatture in Cloud
import { NextRequest, NextResponse } from 'next/server';
import { 
  getFICConfig, 
  getValidAccessToken, 
  getFICExpenses, 
  getFICReceivedDocuments,
  convertFICExpensesToImportedCosts,
  convertFICDocumentsToImportedCosts,
  saveFICConfig
} from '../../../../../lib/services/fattureincloud-service';
import { getAdminDb } from '../../../../../lib/firebase-admin';
import { logAdmin } from '../../../../../lib/admin-log';
import { ImportedCost } from '../../../../../lib/xls-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, month, includeExpenses = true, includeDocuments = true } = body;

    if (!userId || !month) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, month' },
        { status: 400 }
      );
    }

    // Valida formato mese (YYYY-MM)
    if (!month.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json(
        { error: 'Invalid month format. Expected YYYY-MM' },
        { status: 400 }
      );
    }

    // Recupera configurazione
    const config = await getFICConfig(userId);
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: 'Fatture in Cloud non configurato o disabilitato' },
        { status: 400 }
      );
    }

    if (!config.companyId) {
      return NextResponse.json(
        { error: 'Company ID non configurato' },
        { status: 400 }
      );
    }

    // Ottieni access token valido (rinnova se necessario)
    let accessToken = config.accessToken || '';
    try {
      accessToken = await getValidAccessToken(config);
      
      // Se il token è stato rinnovato, salvalo
      if (accessToken !== config.accessToken) {
        const expiresAt = Date.now() + (3600 * 1000); // 1 ora
        await saveFICConfig(userId, {
          ...config,
          accessToken,
          expiresAt,
        });
      }
    } catch (error: any) {
      logAdmin(`[FIC] Errore refresh token: ${error.message}`);
      return NextResponse.json(
        { error: 'Errore autenticazione Fatture in Cloud. Riconnetti l\'account.' },
        { status: 401 }
      );
    }

    // Calcola date inizio/fine mese
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    logAdmin(`[FIC] Sincronizzazione costi per mese ${month} (${startDate} - ${endDate})`);

    const allCosts: ImportedCost[] = [];

    // Recupera spese
    if (includeExpenses) {
      try {
        logAdmin(`[FIC] Inizio recupero spese da cashbook...`);
        const expenses = await getFICExpenses(accessToken, config.companyId, startDate, endDate);
        logAdmin(`[FIC] Spese recuperate: ${expenses.length}`);
        if (expenses.length > 0) {
          logAdmin(`[FIC] Prima spesa esempio:`, { id: expenses[0].id, date: expenses[0].date, amount: expenses[0].amount, fornitore: expenses[0].supplier_name });
        }
        const expenseCosts = convertFICExpensesToImportedCosts(expenses, month);
        logAdmin(`[FIC] Costi convertiti da spese: ${expenseCosts.length}`);
        allCosts.push(...expenseCosts);
        logAdmin(`[FIC] Trovate ${expenses.length} spese, convertite in ${expenseCosts.length} costi`);
      } catch (error: any) {
        logAdmin(`[FIC] Errore recupero spese: ${error.message}`, { error: error.stack });
        // Continua anche se c'è un errore
      }
    }

    // Recupera documenti ricevuti (fatture di acquisto)
    if (includeDocuments) {
      try {
        logAdmin(`[FIC] Inizio recupero documenti ricevuti...`);
        const documents = await getFICReceivedDocuments(accessToken, config.companyId, startDate, endDate);
        logAdmin(`[FIC] Documenti recuperati: ${documents.length}`);
        if (documents.length > 0) {
          logAdmin(`[FIC] Primo documento esempio:`, { 
            id: documents[0].id, 
            date: documents[0].date, 
            amount_gross: documents[0].amount_gross,
            amount_net: documents[0].amount_net,
            amount_vat: documents[0].amount_vat,
            supplier: documents[0].entity?.name || documents[0].supplier_name 
          });
        }
        const docCosts = convertFICDocumentsToImportedCosts(documents, month);
        logAdmin(`[FIC] Costi convertiti da documenti: ${docCosts.length}`);
        allCosts.push(...docCosts);
        logAdmin(`[FIC] Trovati ${documents.length} documenti ricevuti, convertiti in ${docCosts.length} costi`);
      } catch (error: any) {
        logAdmin(`[FIC] Errore recupero documenti: ${error.message}`, { error: error.stack });
        // Continua anche se c'è un errore
      }
    }

    // Rimuovi duplicati (basati su ID)
    const uniqueCosts = Array.from(
      new Map(allCosts.map(cost => [cost.id, cost])).values()
    );

    logAdmin(`[FIC] Totale costi sincronizzati: ${uniqueCosts.length}`);

    return NextResponse.json({
      success: true,
      costs: uniqueCosts,
      count: uniqueCosts.length,
      month,
      syncedAt: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[FIC] Errore sync: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
