// API endpoint per salvare dati storici giornalieri
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { HistoricalData } from '../../../../lib/types';
import { logAdmin } from '../../../../lib/admin-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hotelId, entries } = body;

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: hotelId' },
        { status: 400 }
      );
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty entries array' },
        { status: 400 }
      );
    }

    logAdmin(`[API] Save historical data request`, { hotelId, entriesCount: entries.length });

    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    const savedEntries: string[] = [];
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        // Valida entry
        if (!entry.date) {
          errors.push(`Entry senza data: ${JSON.stringify(entry)}`);
          continue;
        }

        // Calcola campi derivati se non presenti
        const adr = entry.adr || (entry.total_revenue && entry.rooms_sold && entry.rooms_sold > 0
          ? entry.total_revenue / entry.rooms_sold
          : 0);

        const revpar = adr && entry.occupancy_rate
          ? adr * (entry.occupancy_rate / 100)
          : (entry.total_revenue && entry.rooms_sold && entry.rooms_sold > 0
            ? entry.total_revenue / entry.rooms_sold
            : 0);

        // Prepara dati storici
        const date = new Date(entry.date);
        const historicalData: Partial<HistoricalData> = {
          hotelId,
          date: entry.date,
          occupancy_rate: entry.occupancy_rate || 0,
          adr: adr || 0,
          revpar: revpar || 0,
          total_revenue: entry.total_revenue || 0,
          total_costs: entry.total_costs || 0,
          is_weekend: date.getDay() === 0 || date.getDay() === 6,
          is_holiday: false, // TODO: implementare logica festività
          day_of_week: date.getDay(),
          month: date.getMonth() + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Salva in Firestore (usa date come parte dell'ID per evitare duplicati)
        const docId = `${hotelId}_${entry.date}`;
        const docRef = adminDb.collection('historical_data').doc(docId);
        await docRef.set(historicalData, { merge: true });

        savedEntries.push(entry.date);
      } catch (err: any) {
        errors.push(`Errore salvataggio ${entry.date}: ${err.message}`);
        logAdmin(`[API] Errore salvataggio entry ${entry.date}: ${err.message}`);
      }
    }

    if (savedEntries.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'Nessun dato salvato', errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      saved: savedEntries.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Salvati ${savedEntries.length} giorni di dati storici`,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore save historical data: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
