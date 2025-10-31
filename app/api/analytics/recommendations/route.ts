// API Route per generazione raccomandazioni IA - Server Side
import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations, generateAlerts } from '../../../../lib/ai-recommendations';
import { analyzeCosts, calculateKPI, getBenchmarkValues } from '../../../../lib/calculations';
import { CostsData, RevenueData, HotelData, MonthlyCostsData } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { costs, revenues, hotelData } = body;

    // Validazione input
    if (!costs || !revenues) {
      return NextResponse.json(
        { error: 'Costs and revenues data required' },
        { status: 400 }
      );
    }

    // Calcola tutti i dati necessari
    const benchmark = getBenchmarkValues(hotelData as HotelData | undefined);
    const costAnalyses = analyzeCosts(
      costs as Partial<CostsData>,
      undefined, // previous costs - potrebbe essere passato nel body
      benchmark
    );
    const kpi = calculateKPI(
      costs as Partial<CostsData>,
      revenues as RevenueData[],
      hotelData as HotelData | undefined
    );

    // Genera raccomandazioni
    const recommendations = generateRecommendations(
      costs as Partial<CostsData>,
      revenues as RevenueData[],
      kpi,
      costAnalyses,
      hotelData as HotelData | undefined
    );

    // Genera alert
    const alerts = generateAlerts(costAnalyses, kpi);

    return NextResponse.json(
      { recommendations, alerts, kpi, analyses: costAnalyses },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

