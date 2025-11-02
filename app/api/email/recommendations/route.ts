import { NextRequest, NextResponse } from 'next/server';
import { sendAIRecommendationEmail } from '@/lib/email';

/**
 * API per inviare email con consigli AI
 * POST /api/email/recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, hotelName, recommendations } = body;

    if (!email || !hotelName || !recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json(
        { error: 'Email, hotelName e recommendations sono obbligatori' },
        { status: 400 }
      );
    }

    const result = await sendAIRecommendationEmail(email, hotelName, recommendations);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Email inviata con successo' });
    } else if (result.skipped) {
      return NextResponse.json({ success: false, skipped: true, message: 'Nessun consiglio ad alta priorità' });
    } else {
      return NextResponse.json(
        { error: 'Errore nell\'invio dell\'email', details: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Errore invio email consigli:', error);
    return NextResponse.json(
      { error: 'Errore nel server', details: error.message },
      { status: 500 }
    );
  }
}

