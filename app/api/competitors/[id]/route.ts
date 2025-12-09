// API per gestire singolo competitor
// PUT: aggiorna competitor
// DELETE: elimina competitor

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebase-admin';
import { validateCompetitorConfig } from '../../../../lib/firestore-schemas';
import { logAdmin } from '../../../../lib/admin-log';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const competitorId = params.id;
    const body = await request.json();
    const { competitor_name, location, bookingUrl, bookingId, isActive, priority, boardType, notes } = body;

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per PUT competitor`, { competitorId });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      );
    }

    logAdmin(`[API] Update competitor request`, { competitorId });

    const docRef = adminDb.collection('competitor_configs').doc(competitorId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Competitor non trovato' },
        { status: 404 }
      );
    }

    const existingData = doc.data() as any;
    const updatedData: any = {
      ...existingData,
      updated_at: new Date(),
    };

    if (competitor_name !== undefined) updatedData.competitor_name = competitor_name;
    if (location !== undefined) updatedData.location = location;
    if (bookingUrl !== undefined) updatedData.bookingUrl = bookingUrl;
    if (bookingId !== undefined) updatedData.bookingId = bookingId;
    if (isActive !== undefined) updatedData.isActive = isActive;
    if (priority !== undefined) updatedData.priority = priority;
    if (boardType !== undefined) updatedData.boardType = boardType;
    if (notes !== undefined) updatedData.notes = notes;

    const validated = validateCompetitorConfig(updatedData);
    if (!validated) {
      return NextResponse.json(
        { error: 'Invalid competitor data' },
        { status: 400 }
      );
    }

    // Converti in oggetto plain per Firebase Admin SDK
    const updateData: any = {
      hotelId: validated.hotelId,
      competitor_name: validated.competitor_name,
      location: validated.location,
      isActive: validated.isActive,
      priority: validated.priority,
      boardType: validated.boardType || 'breakfast',
      updated_at: validated.updated_at,
    };
    
    if (validated.bookingUrl !== undefined) updateData.bookingUrl = validated.bookingUrl;
    if (validated.bookingId !== undefined) updateData.bookingId = validated.bookingId;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.created_at) updateData.created_at = validated.created_at;

    await docRef.update(updateData);

    logAdmin(`[API] Competitor aggiornato: ${competitorId}`);

    return NextResponse.json({
      success: true,
      competitor: { ...validated, id: competitorId },
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore update competitor: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const competitorId = params.id;

    const adminDb = getAdminDb();
    if (!adminDb) {
      logAdmin(`[API] Errore: Firebase Admin non inizializzato per DELETE competitor`, { competitorId });
      return NextResponse.json(
        { error: 'Firebase Admin non inizializzato. Verifica la configurazione FIREBASE_SERVICE_ACCOUNT_KEY.' },
        { status: 500 }
      );
    }

    logAdmin(`[API] Delete competitor request`, { competitorId });

    const docRef = adminDb.collection('competitor_configs').doc(competitorId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Competitor non trovato' },
        { status: 404 }
      );
    }

    await docRef.delete();

    logAdmin(`[API] Competitor eliminato: ${competitorId}`);

    return NextResponse.json({
      success: true,
    }, { status: 200 });

  } catch (error: any) {
    logAdmin(`[API] Errore delete competitor: ${error.message}`, { error: error.stack });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
