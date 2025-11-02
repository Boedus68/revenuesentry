import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * API per inviare email di benvenuto
 * POST /api/email/welcome
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, hotelName } = body;

    if (!email || !hotelName) {
      return NextResponse.json(
        { error: 'Email e hotelName sono obbligatori' },
        { status: 400 }
      );
    }

    const result = await sendWelcomeEmail(email, hotelName);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Email inviata con successo' });
    } else {
      return NextResponse.json(
        { error: 'Errore nell\'invio dell\'email', details: result.error },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Errore invio email benvenuto:', error);
    return NextResponse.json(
      { error: 'Errore nel server', details: error.message },
      { status: 500 }
    );
  }
}

