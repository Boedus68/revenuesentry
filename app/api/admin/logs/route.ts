import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromUID } from '@/lib/admin';
import { getAdminLogs } from '@/lib/admin-log';

// Forza rendering dinamico perché usa request.headers
export const dynamic = 'force-dynamic';

/**
 * API per recuperare log admin (solo admin)
 * GET /api/admin/logs?uid=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid') || request.nextUrl.searchParams.get('uid');
    const count = parseInt(request.nextUrl.searchParams.get('count') || '100');
    
    if (!adminUid) {
      return NextResponse.json({ error: 'Unauthorized: UID mancante' }, { status: 401 });
    }

    const isAdmin = await verifyAdminFromUID(adminUid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Non sei un admin' }, { status: 403 });
    }

    const logs = await getAdminLogs(count);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Errore recupero log admin:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei log', details: error.message },
      { status: 500 }
    );
  }
}

