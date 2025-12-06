// API endpoint per rilevare cambiamenti significativi nei prezzi competitor
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { HistoricalData, CompetitorData } from '../../../../lib/types';
import { logAdmin } from '../../../../lib/admin-log';

export interface CompetitorPriceAlert {
  competitorName: string;
  date: string;
  previousPrice: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  severity: 'high' | 'medium' | 'low';
  alertType: 'price_increase' | 'price_decrease' | 'significant_change';
  message: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotelId');
    const daysToCheck = parseInt(searchParams.get('daysToCheck') || '7');

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    logAdmin(`[API] Competitor price alerts request`, { hotelId, daysToCheck });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    // Fetch competitor data degli ultimi N giorni
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToCheck);
    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    // Recupera dati competitor dalla collection competitor_data
    const competitorSnapshot = await adminDb
      .collection('competitor_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', startDateStr)
      .where('date', '<=', todayStr)
      .orderBy('date', 'asc')
      .get();

    if (competitorSnapshot.empty) {
      return NextResponse.json({
        alerts: [],
        message: 'Nessun dato competitor disponibile per il periodo selezionato.',
      }, { status: 200 });
    }

    const competitorData: CompetitorData[] = competitorSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        hotelId: data.hotelId,
        competitor_name: data.competitor_name,
        location: data.location,
        date: data.date,
        price: data.price || 0,
        price_unit: data.price_unit || 'per_camera',
        treatment: data.treatment,
        room_type: data.room_type,
        rating: data.rating,
        availability: data.availability,
        guests: data.guests,
        nights: data.nights,
        scraped_at: data.scraped_at,
        cache_ttl: data.cache_ttl,
        source: data.source,
      };
    });

    // Raggruppa per competitor e rileva cambiamenti
    const alerts: CompetitorPriceAlert[] = [];
    const competitorMap = new Map<string, CompetitorData[]>();

    // Raggruppa dati per competitor
    competitorData.forEach(data => {
      const key = data.competitor_name;
      if (!competitorMap.has(key)) {
        competitorMap.set(key, []);
      }
      competitorMap.get(key)!.push(data);
    });

    // Analizza ogni competitor per rilevare cambiamenti significativi
    competitorMap.forEach((dataPoints, competitorName) => {
      if (dataPoints.length < 2) return; // Serve almeno 2 punti per rilevare cambiamenti

      // Ordina per data
      const sorted = [...dataPoints].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Confronta ultimo prezzo con penultimo
      const latest = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];

      if (!latest.price || !previous.price || latest.price === 0 || previous.price === 0) {
        return;
      }

      const priceChange = latest.price - previous.price;
      const priceChangePercent = (priceChange / previous.price) * 100;

      // Determina severity e tipo alert
      let severity: 'high' | 'medium' | 'low' = 'low';
      let alertType: 'price_increase' | 'price_decrease' | 'significant_change' = 'significant_change';

      const absPercentChange = Math.abs(priceChangePercent);

      if (absPercentChange >= 15) {
        severity = 'high';
      } else if (absPercentChange >= 8) {
        severity = 'medium';
      } else {
        return; // Cambiamenti < 8% non generano alert
      }

      if (priceChangePercent > 0) {
        alertType = 'price_increase';
      } else {
        alertType = 'price_decrease';
      }

      // Genera messaggio
      const message = alertType === 'price_increase'
        ? `${competitorName} ha aumentato il prezzo del ${absPercentChange.toFixed(1)}% (da €${previous.price.toFixed(2)} a €${latest.price.toFixed(2)})`
        : `${competitorName} ha diminuito il prezzo del ${absPercentChange.toFixed(1)}% (da €${previous.price.toFixed(2)} a €${latest.price.toFixed(2)})`;

      alerts.push({
        competitorName,
        date: latest.date,
        previousPrice: previous.price,
        currentPrice: latest.price,
        priceChange,
        priceChangePercent,
        severity,
        alertType,
        message,
      });
    });

    // Ordina alert per severity e percentuale di cambiamento
    alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent);
    });

    // Recupera anche dati storici per contesto
    const historicalSnapshot = await adminDb
      .collection('historical_data')
      .where('hotelId', '==', hotelId)
      .where('date', '>=', startDateStr)
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    let yourCurrentPrice: number | null = null;
    if (!historicalSnapshot.empty) {
      const lastHistorical = historicalSnapshot.docs[0].data();
      yourCurrentPrice = lastHistorical.adr || null;
    }

    return NextResponse.json({
      alerts,
      yourCurrentPrice,
      period: {
        startDate: startDateStr,
        endDate: todayStr,
        daysChecked: daysToCheck,
      },
      summary: {
        totalAlerts: alerts.length,
        highSeverity: alerts.filter(a => a.severity === 'high').length,
        mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
        lowSeverity: alerts.filter(a => a.severity === 'low').length,
      },
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore competitor price alerts: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
