// API Route per generazione raccomandazioni IA - Server Side
import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations, generateAlerts } from '../../../../lib/ai-recommendations';
import { analyzeCosts, calculateKPI, getBenchmarkValues } from '../../../../lib/calculations';
import { CostsData, RevenueData, HotelData, MonthlyCostsData, CostAnalysis, KPIData, Recommendation, Alert } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { costs, revenues, hotelData, userEmail, hotelName } = body;

    // Validazione input - almeno uno tra costs o revenues deve essere presente
    if (!costs && !revenues) {
      return NextResponse.json(
        { error: 'At least costs or revenues data required' },
        { status: 400 }
      );
    }
    
    // Se costs è un array vuoto o un oggetto vuoto, considera come non presente
    const hasCosts = Array.isArray(costs) 
      ? costs.length > 0 
      : costs && Object.keys(costs).length > 0;
    
    // Se revenues è un array vuoto, considera come non presente
    const hasRevenues = Array.isArray(revenues) && revenues.length > 0;
    
    if (!hasCosts && !hasRevenues) {
      return NextResponse.json(
        { error: 'At least costs or revenues data required' },
        { status: 400 }
      );
    }

    // Calcola tutti i dati necessari
    const benchmark = getBenchmarkValues(hotelData as HotelData | undefined);
    let costAnalyses: CostAnalysis[] = [];
    let kpi: KPIData | null = null;
    
    // Analizza costi solo se presenti
    if (hasCosts) {
      costAnalyses = analyzeCosts(
        costs as Partial<CostsData>,
        undefined, // previous costs - potrebbe essere passato nel body
        benchmark
      );
    }
    
    // Calcola KPI se ci sono dati sufficienti
    if (hasCosts || hasRevenues) {
      try {
        kpi = calculateKPI(
          (costs as Partial<CostsData> | MonthlyCostsData[]) || {},
          revenues as RevenueData[] || [],
          hotelData as HotelData | undefined
        );
      } catch (error) {
        console.error('Error calculating KPI:', error);
      }
    }

    // Genera raccomandazioni
    let recommendations: Recommendation[] = [];
    if (hasCosts || (hasRevenues && kpi)) {
      recommendations = generateRecommendations(
        costs as Partial<CostsData> || {},
        revenues as RevenueData[] || [],
        kpi || {} as KPIData,
        costAnalyses,
        hotelData as HotelData | undefined
      );
    }

    // Genera alert solo se abbiamo KPI
    let alerts: Alert[] = [];
    if (kpi) {
      alerts = generateAlerts(costAnalyses, kpi);
    }

    // Invia email con consigli AI se ci sono raccomandazioni ad alta priorità (in background)
    if (recommendations.length > 0 && userEmail && hotelName) {
      const highPriorityRecommendations = recommendations.filter(
        r => r.priorita === 'alta' || r.priorita === 'critica'
      );
      
      if (highPriorityRecommendations.length > 0) {
        // Invia email in background (non blocca la risposta)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/recommendations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            hotelName,
            recommendations: highPriorityRecommendations,
          }),
        }).catch(err => console.error('Errore invio email consigli:', err));
      }
    }

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

