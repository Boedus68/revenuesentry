// API endpoint per Dynamic Pricing - suggerisce prezzo ottimale
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { PricingModel } from '../../../../lib/ml/pricing-model';
import { HistoricalData } from '../../../../lib/types';
import { logAdmin } from '../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotelId');
    const date = searchParams.get('date'); // formato "YYYY-MM-DD", default oggi
    const currentPrice = parseFloat(searchParams.get('currentPrice') || '0');

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid currentPrice parameter' },
        { status: 400 }
      );
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    logAdmin(`[API] Price prediction request`, { hotelId, date: targetDate.toISOString(), currentPrice });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    // Fetch historical data ultimi 90 giorni
    const ninetyDaysAgo = new Date(targetDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const snapshot = await adminDb
      .collection('historical_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', dateStr)
      .where('date', '<=', targetDate.toISOString().split('T')[0])
      .orderBy('date', 'asc')
      .get();

    if (snapshot.empty) {
      logAdmin(`[API] Nessun dato storico trovato per ${hotelId}`);
      return NextResponse.json({
        error: 'Nessun dato storico disponibile. Aggiungi dati revenue per generare previsioni di prezzo.',
      }, { status: 400 });
    }

    const historicalData: HistoricalData[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        hotelId: data.hotelId,
        date: data.date,
        occupancy_rate: data.occupancy_rate || 0,
        adr: data.adr || 0,
        revpar: data.revpar || 0,
        total_revenue: data.total_revenue || 0,
        total_costs: data.total_costs || 0,
        weather_condition: data.weather_condition,
        weather_score: data.weather_score,
        local_events: data.local_events || [],
        event_impact_score: data.event_impact_score,
        competitor_prices: data.competitor_prices || {},
        competitor_avg_price: data.competitor_avg_price,
        competitor_min_price: data.competitor_min_price,
        competitor_max_price: data.competitor_max_price,
        is_weekend: data.is_weekend || false,
        is_holiday: data.is_holiday || false,
        day_of_week: data.day_of_week,
        month: data.month,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    // Genera raccomandazione prezzo
    const pricingModel = new PricingModel();
    const recommendation = pricingModel.recommendPrice(
      historicalData,
      targetDate,
      currentPrice
    );

    // Salva prediction in Firestore
    try {
      const predictionData = {
        hotelId,
        prediction_date: targetDate.toISOString().split('T')[0],
        predicted_occupancy: 0, // Non disponibile da pricing model
        suggested_price: recommendation.recommendedPrice,
        confidence_score: recommendation.confidence,
        reasoning: recommendation.reasoning,
        factors: {
          demand: recommendation.factors.demandLevel === 'high' ? 0.8 : 
                  recommendation.factors.demandLevel === 'medium' ? 0.5 : 0.2,
          competitor: recommendation.factors.competitorAvgPrice,
        },
        competitor_analysis: {
          avg_price: recommendation.factors.competitorAvgPrice,
          min_price: recommendation.factors.competitorPrice, // Usa competitorPrice come min
          max_price: recommendation.factors.competitorAvgPrice * 1.2, // Stima
          market_position: recommendation.recommendedPrice > recommendation.factors.competitorAvgPrice 
            ? 'above' as const 
            : recommendation.recommendedPrice < recommendation.factors.competitorAvgPrice 
            ? 'below' as const 
            : 'average' as const,
        },
        created_at: new Date(),
      };

      const docId = `${hotelId}_${targetDate.toISOString().split('T')[0]}`;
      const docRef = adminDb.collection('ml_predictions').doc(docId);
      await docRef.set(predictionData, { merge: true });
      logAdmin(`[API] Price prediction salvata in ml_predictions`);
    } catch (error: any) {
      logAdmin(`[API] Errore salvataggio prediction: ${error.message}`);
      // Non bloccare la risposta se il salvataggio fallisce
    }

    return NextResponse.json({
      recommendation,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore price prediction: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
