// API endpoint per generare insights AI Agent
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { SentryReasoningEngine } from '../../../../lib/ai-agent/reasoning-engine';
import { ContextBuilder } from '../../../../lib/ai-agent/context-builder';
import { NaturalLanguageGenerator } from '../../../../lib/ai-agent/nlg';
import { HotelData, RevenueData, CostsData, HistoricalData } from '../../../../lib/types';
import { logAdmin } from '../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotelId');
    
    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }
    
    logAdmin(`[AI Agent] Insights request`, { hotelId });
    
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }
    
    // Fetch dati utente
    const userDoc = await adminDb.collection('users').doc(hotelId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    const hotelData: HotelData = userData?.hotelData || {};
    const revenueData: RevenueData[] = userData?.revenues || [];
    const costsData: CostsData[] = [];
    
    logAdmin(`[AI Agent] User data loaded`, { 
      hasHotelData: !!hotelData.hotelName,
      revenuesCount: revenueData.length,
      hasCosts: !!userData?.costs
    });
    
    // Fetch costs data (potrebbe essere strutturato diversamente)
    if (userData?.costs) {
      try {
        // Se costs è un array di MonthlyCostsData, estrai solo i costs
        if (Array.isArray(userData.costs)) {
          // Verifica se è array di MonthlyCostsData o CostsData
          if (userData.costs.length > 0 && 'costs' in userData.costs[0]) {
            // È MonthlyCostsData[]
            costsData.push(...userData.costs.map((mc: any) => mc.costs || mc));
          } else {
            // È CostsData[]
            costsData.push(...userData.costs);
          }
        } else if (typeof userData.costs === 'object') {
          // Se costs è un oggetto per mese, convertilo in array
          Object.keys(userData.costs).forEach(month => {
            const monthCosts = userData.costs[month];
            if (monthCosts && typeof monthCosts === 'object') {
              // Se ha campo 'costs', estrailo
              costsData.push(('costs' in monthCosts ? monthCosts.costs : monthCosts) as CostsData);
            }
          });
        }
      } catch (err: any) {
        logAdmin(`[AI Agent] Errore parsing costs: ${err.message}`);
      }
    }
    
    logAdmin(`[AI Agent] Costs data parsed`, { costsCount: costsData.length });
    
    // Fetch historical data
    let historicalData: HistoricalData[] = [];
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateStr = ninetyDaysAgo.toISOString().split('T')[0];
      
      // Prova query con orderBy, se fallisce prova senza
      try {
        const historicalSnapshot = await adminDb
          .collection('historical_data')
          .where('hotelId', '==', hotelId)
          .where('date', '>=', dateStr)
          .orderBy('date', 'asc')
          .get();
        
        historicalData = historicalSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            hotelId: data.hotelId || hotelId,
            date: data.date || '',
            occupancy_rate: data.occupancy_rate || 0,
            adr: data.adr || 0,
            revpar: data.revpar || 0,
            total_revenue: data.total_revenue || 0,
            total_costs: data.total_costs || 0,
            is_weekend: data.is_weekend || false,
            is_holiday: data.is_holiday || false,
            day_of_week: data.day_of_week ?? 0,
            month: data.month ?? 1,
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date(),
          } as HistoricalData;
        });
      } catch (queryError: any) {
        // Se fallisce per mancanza di indice, prova senza orderBy
        logAdmin(`[AI Agent] Query con orderBy fallita, provo senza: ${queryError.message}`);
        const historicalSnapshot = await adminDb
          .collection('historical_data')
          .where('hotelId', '==', hotelId)
          .get();
        
        historicalData = historicalSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              hotelId: data.hotelId || hotelId,
              date: data.date || '',
              occupancy_rate: data.occupancy_rate || 0,
              adr: data.adr || 0,
              revpar: data.revpar || 0,
              total_revenue: data.total_revenue || 0,
              total_costs: data.total_costs || 0,
              is_weekend: data.is_weekend || false,
              is_holiday: data.is_holiday || false,
              day_of_week: data.day_of_week ?? 0,
              month: data.month ?? 1,
              createdAt: data.createdAt || new Date(),
              updatedAt: data.updatedAt || new Date(),
            } as HistoricalData;
          })
          .filter(h => h.date >= dateStr)
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch (err: any) {
      logAdmin(`[AI Agent] Errore fetch historical data: ${err.message}`);
      // Continua con array vuoto
    }
    
    logAdmin(`[AI Agent] Historical data loaded`, { count: historicalData.length });
    
    // Determina mese corrente
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    // Costruisci contesto
    let context;
    try {
      const contextBuilder = new ContextBuilder();
      context = contextBuilder.buildContext({
        hotelId,
        currentMonth,
        hotelData,
        revenueData,
        costsData,
        historicalData
      });
      logAdmin(`[AI Agent] Context built successfully`);
    } catch (err: any) {
      logAdmin(`[AI Agent] Errore build context: ${err.message}`, { error: err.stack });
      throw err;
    }
    
    // Genera insights con Reasoning Engine
    let insights;
    try {
      const reasoningEngine = new SentryReasoningEngine(context);
      insights = await reasoningEngine.generateInsights();
      logAdmin(`[AI Agent] Insights generated`, { count: insights.length });
    } catch (err: any) {
      logAdmin(`[AI Agent] Errore generazione insights: ${err.message}`, { error: err.stack });
      throw err;
    }
    
    // Genera messaggi in linguaggio naturale
    const nlg = new NaturalLanguageGenerator();
    const insightsWithMessages = insights.map(insight => ({
      ...insight,
      naturalLanguage: nlg.generateMessage(insight),
      formattedMessage: nlg.generateFormattedMessage(insight),
      briefNotification: nlg.generateBriefNotification(insight)
    }));
    
    // Salva insights in Firestore (opzionale, per tracking)
    try {
      const insightsDoc = {
        hotelId,
        generatedAt: new Date(),
        insightsCount: insights.length,
        topPriority: insights.length > 0 ? insights[0].priority : 0,
        summary: {
          problems: insights.filter(i => i.category === 'problem').length,
          opportunities: insights.filter(i => i.category === 'opportunity').length,
          risks: insights.filter(i => i.category === 'risk').length,
          achievements: insights.filter(i => i.category === 'achievement').length
        }
      };
      
      await adminDb.collection('ai_insights').doc(`${hotelId}_${Date.now()}`).set(insightsDoc);
    } catch (error: any) {
      logAdmin(`[AI Agent] Errore salvataggio insights: ${error.message}`);
    }
    
    // Serializza insights rimuovendo eventuali campi non serializzabili
    const serializedInsights = insightsWithMessages.map(insight => ({
      ...insight,
      createdAt: insight.createdAt instanceof Date ? insight.createdAt.toISOString() : insight.createdAt,
      reasoning: {
        ...insight.reasoning,
        // Assicurati che tutti i campi siano serializzabili
      },
      recommendations: insight.recommendations.map(rec => ({
        ...rec,
        // Assicurati che tutti i campi siano serializzabili
      })),
      impact: {
        ...insight.impact,
        // Assicurati che tutti i campi siano numeri
      }
    }));
    
    return NextResponse.json({
      success: true,
      insights: serializedInsights,
      context: {
        currentMonth: context.currentMonth,
        kpis: {
          ...context.kpis,
          // Assicurati che tutti i campi siano serializzabili
        },
        trends: {
          revenue: { ...context.trends.revenue },
          occupancy: { ...context.trends.occupancy },
          costs: { ...context.trends.costs },
          profitability: { ...context.trends.profitability }
        },
        anomaliesCount: context.anomalies.length,
        benchmarks: {
          adr: { ...context.benchmarks.adr },
          occupancy: { ...context.benchmarks.occupancy },
          revpar: { ...context.benchmarks.revpar },
          goppar: { ...context.benchmarks.goppar },
          costRatio: { ...context.benchmarks.costRatio }
        }
      },
      generatedAt: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error: any) {
    logAdmin(`[AI Agent] Errore generazione insights: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
