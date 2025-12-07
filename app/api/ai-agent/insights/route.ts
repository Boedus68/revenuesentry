// API endpoint per generare insights AI Agent
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { SentryReasoningEngine } from '../../../../lib/ai-agent/reasoning-engine';
import { ContextBuilder } from '../../../../lib/ai-agent/context-builder';
import { NaturalLanguageGenerator } from '../../../../lib/ai-agent/nlg';
import { HotelData, RevenueData, CostsData, HistoricalData } from '../../../../lib/types';
import { logAdmin } from '../../../../lib/admin-log';

// Helper functions per calcoli safe
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

function safePercent(value: any, defaultValue: number = 0): number {
  const num = safeNumber(value, defaultValue);
  return Math.max(-100, Math.min(100, num));
}

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
      hasCosts: !!userData?.costs,
      hasMonthlyCosts: !!userData?.monthlyCosts
    });
    
    // Fetch costs data - controlla prima monthlyCosts (formato nuovo), poi costs (formato vecchio)
    try {
      if (userData?.monthlyCosts && Array.isArray(userData.monthlyCosts)) {
        // Formato nuovo: MonthlyCostsData[]
        userData.monthlyCosts.forEach((mc: any) => {
          if (mc && mc.costs) {
            costsData.push(mc.costs as CostsData);
          } else if (mc && typeof mc === 'object' && !mc.mese) {
            // Se non ha campo mese, potrebbe essere già CostsData
            costsData.push(mc as CostsData);
          }
        });
      } else if (userData?.costs) {
        // Formato vecchio: potrebbe essere array o oggetto
        if (Array.isArray(userData.costs)) {
          // Verifica se è array di MonthlyCostsData o CostsData
          if (userData.costs.length > 0 && 'costs' in userData.costs[0]) {
            // È MonthlyCostsData[]
            userData.costs.forEach((mc: any) => {
              if (mc.costs) {
                costsData.push(mc.costs as CostsData);
              }
            });
          } else {
            // È CostsData[]
            userData.costs.forEach((cost: any) => {
              if (cost && typeof cost === 'object') {
                costsData.push(cost as CostsData);
              }
            });
          }
        } else if (typeof userData.costs === 'object') {
          // Se costs è un oggetto per mese, convertilo in array
          Object.keys(userData.costs).forEach(month => {
            const monthCosts = userData.costs[month];
            if (monthCosts && typeof monthCosts === 'object') {
              // Se ha campo 'costs', estrailo
              if ('costs' in monthCosts) {
                costsData.push(monthCosts.costs as CostsData);
              } else {
                costsData.push(monthCosts as CostsData);
              }
            }
          });
        }
      }
      } catch (err: any) {
        logAdmin('[AI Agent] Errore parsing costs', { error: err.message, stack: err.stack });
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
        logAdmin('[AI Agent] Query con orderBy fallita, provo senza', { error: queryError.message });
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
      logAdmin('[AI Agent] Errore fetch historical data', { error: err.message });
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
      logAdmin('[AI Agent] Errore build context', { error: err.message, stack: err.stack });
      throw err;
    }
    
    // Genera insights con Reasoning Engine
    let insights;
    try {
      const reasoningEngine = new SentryReasoningEngine(context);
      insights = await reasoningEngine.generateInsights();
      logAdmin(`[AI Agent] Insights generated`, { count: insights.length });
    } catch (err: any) {
      logAdmin('[AI Agent] Errore generazione insights', { error: err.message, stack: err.stack });
      throw err;
    }
    
    // Genera messaggi in linguaggio naturale
    let insightsWithMessages;
    try {
      const nlg = new NaturalLanguageGenerator();
      insightsWithMessages = insights.map(insight => {
        try {
          return {
            ...insight,
            naturalLanguage: nlg.generateMessage(insight),
            formattedMessage: nlg.generateFormattedMessage(insight),
            briefNotification: nlg.generateBriefNotification(insight)
          };
        } catch (nlgErr: any) {
          logAdmin('[AI Agent] Errore NLG per insight', { error: nlgErr.message });
          // Fallback: usa solo i dati base dell'insight
          return {
            ...insight,
            naturalLanguage: insight.title || 'Insight generato',
            formattedMessage: insight.description || '',
            briefNotification: insight.title || ''
          };
        }
      });
    } catch (err: any) {
      logAdmin('[AI Agent] Errore generazione messaggi NLG', { error: err.message, stack: err.stack });
      // Fallback: usa solo i dati base degli insights
      insightsWithMessages = insights.map(insight => ({
        ...insight,
        naturalLanguage: insight.title || 'Insight generato',
        formattedMessage: insight.description || '',
        briefNotification: insight.title || ''
      }));
    }
    
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
      logAdmin('[AI Agent] Errore salvataggio insights', { error: error.message });
    }
    
    // Serializza insights rimuovendo eventuali campi non serializzabili
    const serializedInsights = insightsWithMessages.map(insight => {
      try {
        return {
          ...insight,
          priority: safeNumber(insight.priority, 5),
          confidence: safeNumber(insight.confidence, 0.5),
          createdAt: insight.createdAt instanceof Date ? insight.createdAt.toISOString() : (insight.createdAt || new Date().toISOString()),
          reasoning: {
            observation: insight.reasoning?.observation || '',
            analysis: insight.reasoning?.analysis || '',
            causes: insight.reasoning?.causes || [],
            consequences: insight.reasoning?.consequences || [],
            logic: insight.reasoning?.logic || ''
          },
          recommendations: (insight.recommendations || []).map(rec => ({
            action: rec.action || '',
            why: rec.why || '',
            how: rec.how || '',
            expectedOutcome: rec.expectedOutcome || '',
            effort: rec.effort || 'medium',
            timeToImpact: rec.timeToImpact || '',
            dependencies: rec.dependencies || []
          })),
          impact: {
            revenueChange: safeNumber(insight.impact?.revenueChange, 0),
            costChange: safeNumber(insight.impact?.costChange, 0),
            profitChange: safeNumber(insight.impact?.profitChange, 0),
            occupancyChange: safePercent(insight.impact?.occupancyChange, 0),
            confidence: safeNumber(insight.impact?.confidence, 0.5),
            timeframe: insight.impact?.timeframe || ''
          }
        };
      } catch (serErr: any) {
        logAdmin('[AI Agent] Errore serializzazione insight', { error: serErr.message });
        // Fallback: ritorna solo i campi essenziali
        return {
          id: insight.id,
          category: insight.category,
          title: insight.title || '',
          description: insight.description || '',
          priority: safeNumber(insight.priority, 5),
          confidence: safeNumber(insight.confidence, 0.5),
          createdAt: new Date().toISOString(),
          reasoning: { observation: '', analysis: '', causes: [], consequences: [], logic: '' },
          recommendations: [],
          impact: { revenueChange: 0, costChange: 0, profitChange: 0, occupancyChange: 0, confidence: 0.5, timeframe: '' },
          naturalLanguage: insight.title || '',
          formattedMessage: insight.description || '',
          briefNotification: insight.title || ''
        };
      }
    });
    
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
    logAdmin('[AI Agent] Errore generazione insights', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
