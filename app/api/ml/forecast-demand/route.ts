// API endpoint per forecast domanda (occupazione)
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { SimpleForecast } from '../../../../lib/ml/simple-forecaster';
import { FeatureEngineer } from '../../../../lib/ml/feature-engineering';
import { HistoricalData } from '../../../../lib/types';
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

    logAdmin(`[API] Demand forecast request`, { hotelId, daysAhead });

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

    // Genera forecast usando SimpleForecast
    const forecaster = new SimpleForecast();
    const forecast = forecaster.forecastRevenue(historicalData, daysAhead);
    const stats = forecaster.calculateForecastStats(forecast);

    // Estrai features per ogni giorno forecast usando FeatureEngineer
    const featureEngineer = new FeatureEngineer();
    const today = new Date();
    const featuresByDate = new Map<string, any>();

    forecast.forEach(f => {
      const forecastDate = new Date(f.date);
      const features = featureEngineer.extractFeatures(historicalData, forecastDate);
      featuresByDate.set(f.date, features);
    });

    // Prepara risposta con forecast e features
    const forecastWithFeatures = forecast.map(f => ({
      date: f.date,
      predictedRevenue: f.predictedRevenue,
      predictedOccupancy: f.predictedOccupancy,
      confidence: f.confidence,
      features: featuresByDate.get(f.date) || null,
    }));

    return NextResponse.json({
      forecast: forecastWithFeatures,
      stats: {
        totalRevenue30d: stats.totalRevenue30d,
        avgOccupancy: stats.avgOccupancy,
        minRevenue: stats.minRevenue,
        maxRevenue: stats.maxRevenue,
        confidenceInterval: stats.confidenceInterval,
      },
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore demand forecast: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
