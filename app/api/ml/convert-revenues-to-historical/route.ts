// API endpoint per convertire dati revenue mensili in dati storici giornalieri
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { RevenueData, HotelData, HistoricalData } from '../../../../lib/types';
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

    logAdmin(`[API] Convert revenues to historical data request`, { hotelId });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    // Recupera dati utente
    const userDocRef = adminDb.collection('users').doc(hotelId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const revenues: RevenueData[] = userData?.revenues || [];
    const hotelData: HotelData | undefined = userData?.hotelData;

    if (revenues.length === 0) {
      return NextResponse.json(
        { error: 'Nessun dato revenue trovato. Inserisci prima i dati mensili nella sezione Ricavi.' },
        { status: 400 }
      );
    }

    const camereTotali = hotelData?.camereTotali || 1;
    const giorniAperturaMese = hotelData?.giorniApertura || 30; // Default per hotel annuali
    const savedDates: string[] = [];

    // Converti ogni mese in dati giornalieri
    for (const revenue of revenues) {
      const [year, month] = revenue.mese.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Calcola valori giornalieri medi
      const giorniApertura = revenue.giorniAperturaMese || giorniAperturaMese;
      const revenuePerDay = revenue.entrateTotali / giorniApertura;
      const adr = revenue.prezzoMedioCamera || 0;
      const occupancyRate = revenue.occupazione || 0;
      const roomsSoldPerDay = (occupancyRate / 100) * camereTotali;
      const revpar = adr * (occupancyRate / 100);

      // Genera dati per ogni giorno del mese
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];

        // Distribuisci i ricavi in modo uniforme (o puoi aggiungere variazioni casuali)
        const dailyRevenue = revenuePerDay;
        const dailyRoomsSold = Math.round(roomsSoldPerDay);
        const dailyOccupancy = (dailyRoomsSold / camereTotali) * 100;

        const historicalData: Partial<HistoricalData> = {
          hotelId,
          date: dateStr,
          occupancy_rate: Math.min(100, Math.max(0, dailyOccupancy)),
          adr: adr,
          revpar: revpar,
          total_revenue: dailyRevenue,
          total_costs: 0, // Non disponibile dai dati mensili
          is_weekend: date.getDay() === 0 || date.getDay() === 6,
          is_holiday: false,
          day_of_week: date.getDay(),
          month: month,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Salva in Firestore
        const docId = `${hotelId}_${dateStr}`;
        const docRef = adminDb.collection('historical_data').doc(docId);
        await docRef.set(historicalData, { merge: true });

        savedDates.push(dateStr);
      }
    }

    return NextResponse.json({
      success: true,
      converted: savedDates.length,
      monthsProcessed: revenues.length,
      message: `Convertiti ${savedDates.length} giorni di dati storici da ${revenues.length} mesi`,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore convert revenues: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
