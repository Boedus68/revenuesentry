// API di debug per verificare lo stato di un utente
// GET /api/admin/debug-user?uid=XXXXX
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get('uid');
    
    if (!uid) {
      return NextResponse.json({ error: 'UID mancante' }, { status: 400 });
    }

    const debugInfo: any = {
      uid,
      timestamp: new Date().toISOString(),
    };

    // Prova a leggere con Admin SDK
    if (adminDb) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        debugInfo.adminSDK = {
          available: true,
          documentExists: userDoc.exists,
          data: userDoc.exists ? userDoc.data() : null,
          role: userDoc.exists ? (userDoc.data()?.role || 'non presente') : 'documento non esiste',
          isAdmin: userDoc.exists ? (userDoc.data()?.role === 'admin') : false,
        };
      } catch (error: any) {
        debugInfo.adminSDK = {
          available: true,
          error: error.message,
          code: error.code,
        };
      }
    } else {
      debugInfo.adminSDK = {
        available: false,
        message: 'Firebase Admin SDK non inizializzato',
      };
    }

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Errore durante il debug', details: error.message },
      { status: 500 }
    );
  }
}

