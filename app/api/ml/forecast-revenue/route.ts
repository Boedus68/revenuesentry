// API endpoint per revenue forecast
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { SimpleForecast } from '../../../../lib/ml/simple-forecaster';
import { HistoricalData, MLPrediction } from '../../../../lib/types';
import { validateMLPrediction, getMLPredictionDocId } from '../../../../lib/firestore-schemas';
import { logAdmin } from '../../../../lib/admin-log';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotelId');
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30');

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    logAdmin(`[API] Revenue forecast request`, { hotelId, daysAhead });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    // Fetch historical data ultimi 90 giorni
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const snapshot = await adminDb
      .collection('historical_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', dateStr)
      .orderBy('date', 'asc')
      .get();

    if (snapshot.empty) {
      logAdmin(`[API] Nessun dato storico trovato per ${hotelId}`);
      return NextResponse.json({
        forecast: [],
        totalRevenue30d: 0,
        avgOccupancy: 0,
        minRevenue: 0,
        maxRevenue: 0,
        confidenceInterval: { min: 0, max: 0 },
        message: 'Nessun dato storico disponibile. Aggiungi dati revenue per generare previsioni.',
      }, { status: 200 });
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

    // Genera forecast
    const forecaster = new SimpleForecast();
    const forecast = forecaster.forecastRevenue(historicalData, daysAhead);
    const stats = forecaster.calculateForecastStats(forecast);

    // Salva prediction in Firestore (solo per oggi)
    const today = new Date().toISOString().split('T')[0];
    const todayForecast = forecast.find(f => f.date === today);
    
    if (todayForecast && adminDb) {
      try {
        const predictionData: Partial<MLPrediction> = {
          hotelId,
          prediction_date: today,
          predicted_occupancy: todayForecast.predictedOccupancy,
          suggested_price: 0, // Non abbiamo pricing model ancora
          confidence_score: todayForecast.confidence,
          reasoning: `Previsione basata su media mobile 7 giorni e stagionalità settimanale. Trend: ${stats.avgOccupancy > historicalData[historicalData.length - 1]?.occupancy_rate ? 'positivo' : 'negativo'}.`,
          created_at: new Date(),
        };

        const validated = validateMLPrediction(predictionData);
        if (validated) {
          const docId = getMLPredictionDocId(hotelId, today);
          const docRef = adminDb.collection('ml_predictions').doc(docId);
          await docRef.set(validated, { merge: true });
          logAdmin(`[API] Prediction salvata in ml_predictions`);
        }
      } catch (error: any) {
        logAdmin(`[API] Errore salvataggio prediction: ${error.message}`);
        // Non bloccare la risposta se il salvataggio fallisce
      }
    }

    return NextResponse.json({
      forecast,
      totalRevenue30d: stats.totalRevenue30d,
      avgOccupancy: stats.avgOccupancy,
      minRevenue: stats.minRevenue,
      maxRevenue: stats.maxRevenue,
      confidenceInterval: stats.confidenceInterval,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore revenue forecast: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
