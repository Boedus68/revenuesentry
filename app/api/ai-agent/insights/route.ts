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
    
    // Fetch costs data (potrebbe essere strutturato diversamente)
    if (userData?.costs) {
      // Se costs è un oggetto per mese, convertilo in array
      if (typeof userData.costs === 'object' && !Array.isArray(userData.costs)) {
        Object.keys(userData.costs).forEach(month => {
          costsData.push({ ...userData.costs[month], mese: month } as CostsData);
        });
      } else if (Array.isArray(userData.costs)) {
        costsData.push(...userData.costs);
      }
    }
    
    // Fetch historical data
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const historicalSnapshot = await adminDb
      .collection('historical_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', ninetyDaysAgo.toISOString().split('T')[0])
      .orderBy('date', 'asc')
      .get();
    
    const historicalData: HistoricalData[] = historicalSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        hotelId: data.hotelId,
        date: data.date,
        occupancy_rate: data.occupancy_rate || 0,
        adr: data.adr || 0,
        revpar: data.revpar || 0,
        total_revenue: data.total_revenue || 0,
        total_costs: data.total_costs || 0,
        is_weekend: data.is_weekend || false,
        is_holiday: data.is_holiday || false,
        day_of_week: data.day_of_week,
        month: data.month,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as HistoricalData;
    });
    
    // Determina mese corrente
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    // Costruisci contesto
    const contextBuilder = new ContextBuilder();
    const context = contextBuilder.buildContext({
      hotelId,
      currentMonth,
      hotelData,
      revenueData,
      costsData,
      historicalData
    });
    
    // Genera insights con Reasoning Engine
    const reasoningEngine = new SentryReasoningEngine(context);
    const insights = await reasoningEngine.generateInsights();
    
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
    
    return NextResponse.json({
      success: true,
      insights: insightsWithMessages,
      context: {
        currentMonth: context.currentMonth,
        kpis: context.kpis,
        trends: context.trends,
        anomaliesCount: context.anomalies.length,
        benchmarks: context.benchmarks
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
