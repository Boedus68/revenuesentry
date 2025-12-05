// API endpoint per rilevare anomalie costi
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { CostAnalyzer } from '../../../../lib/ml/cost-analyzer';
import { HistoricalData, AgentAction } from '../../../../lib/types';
import { validateAgentAction } from '../../../../lib/firestore-schemas';
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

    logAdmin(`[API] Cost anomalies request`, { hotelId });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    // Fetch dati ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const snapshot = await adminDb
      .collection('historical_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', dateStr)
      .orderBy('date', 'asc')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        anomalies: [],
        avgCostPerGuest: 0,
        alerts: [],
        message: 'Nessun dato disponibile per analisi anomalie.',
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

    // Calcola cost/guest per ogni giorno
    // Per ora usiamo occupancy_rate come proxy per guests (approssimazione)
    const analyzer = new CostAnalyzer();
    const costPerGuestData = historicalData
      .filter(d => d.total_costs > 0 && d.occupancy_rate > 0)
      .map(d => {
        // Approssimazione: guests = occupancy_rate * camere_totali (se disponibile)
        // Per ora usiamo occupancy_rate come moltiplicatore
        const estimatedGuests = d.occupancy_rate; // Normalizzato come percentuale
        const costPerGuest = analyzer.calculateCostPerGuest(d.total_costs, estimatedGuests);
        
        return {
          date: d.date,
          costPerGuest,
        };
      });

    if (costPerGuestData.length === 0) {
      return NextResponse.json({
        anomalies: [],
        avgCostPerGuest: 0,
        alerts: [],
        message: 'Dati insufficienti per calcolare cost/guest.',
      }, { status: 200 });
    }

    // Rileva anomalie
    const anomalies = analyzer.detectAnomalies(costPerGuestData);
    const alerts = analyzer.generateCostAlerts(anomalies);

    // Calcola media cost/guest
    const avgCostPerGuest = costPerGuestData.reduce((sum, d) => sum + d.costPerGuest, 0) / costPerGuestData.length;

    // Salva alert high severity in agent_actions
    const highSeverityAlerts = alerts.filter(a => a.severity === 'high');
    if (highSeverityAlerts.length > 0 && adminDb) {
      try {
        const batch = adminDb.batch();
        
        highSeverityAlerts.forEach((alert, idx) => {
          if (!adminDb) return; // TypeScript guard
          
          const actionData: Partial<AgentAction> = {
            hotelId,
            action_type: 'cost_alert',
            action_data: {
              alert_type: 'cost_anomaly',
              date: alert.date,
              cost_per_guest: alert.costPerGuest,
              avg_cost_per_guest: avgCostPerGuest,
              deviation_percent: ((alert.costPerGuest - avgCostPerGuest) / avgCostPerGuest) * 100,
            },
            status: 'pending',
            reasoning: alert.suggestion,
            impact_estimate: Math.round((alert.costPerGuest - avgCostPerGuest) * 30), // Stima impatto mensile
            created_at: new Date(),
          };

          const validated = validateAgentAction(actionData);
          if (validated) {
            const actionRef = adminDb.collection('agent_actions').doc();
            batch.set(actionRef, validated);
          }
        });

        await batch.commit();
        logAdmin(`[API] ${highSeverityAlerts.length} alert salvati in agent_actions`);
      } catch (error: any) {
        logAdmin(`[API] Errore salvataggio alert: ${error.message}`);
      }
    }

    return NextResponse.json({
      anomalies: anomalies.map(a => ({
        date: a.date,
        costPerGuest: a.costPerGuest,
        avgCostPerGuest: a.avgCostPerGuest,
        deviation: a.deviation,
        severity: a.severity,
        suggestion: a.suggestion,
      })),
      avgCostPerGuest: Math.round(avgCostPerGuest * 100) / 100,
      alerts,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore cost anomalies: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
