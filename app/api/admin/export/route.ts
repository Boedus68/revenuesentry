import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { verifyAdminFromUID } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-log';

/**
 * API per esportare dati utenti in CSV (solo admin)
 * GET /api/admin/export?format=csv&uid=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid') || request.nextUrl.searchParams.get('uid');
    const format = request.nextUrl.searchParams.get('format') || 'csv';
    
    if (!adminUid) {
      return NextResponse.json({ error: 'Unauthorized: UID mancante' }, { status: 401 });
    }

    const isAdmin = await verifyAdminFromUID(adminUid);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Non sei un admin' }, { status: 403 });
    }

    // Log azione admin
    await logAdminAction(adminUid, 'export_data', { format });

    // Recupera tutti gli utenti
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const users: any[] = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const userId = doc.id;
      
      const userRevenue = userData.revenues?.reduce((sum: number, r: any) => sum + (r.entrateTotali || 0), 0) || 0;
      const userCosts = calculateTotalCostsForUser(userData.costs);
      
      users.push({
        id: userId,
        hotelName: userData.hotelName || 'N/A',
        email: userData.email || 'N/A',
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData.createdAt,
        rooms: userData.hotelData?.camereTotali || 0,
        hotelType: userData.hotelData?.tipoHotel || 'N/A',
        totalRevenue: userRevenue,
        totalCosts: userCosts,
        revenueDataCount: userData.revenues?.length || 0,
        recommendationsCount: userData.recommendations?.length || 0,
        hasRevenueData: !!(userData.revenues && userData.revenues.length > 0),
        hasCostsData: !!(userData.costs && Object.keys(userData.costs).length > 0),
      });
    });

    if (format === 'csv') {
      // Genera CSV
      const headers = [
        'ID', 'Hotel Name', 'Email', 'Tipo Hotel', 'Camere',
        'Ricavi Totali', 'Costi Totali', 'Dati Ricavi', 'Dati Costi',
        'Num Ricavi', 'Num Consigli', 'Data Registrazione'
      ];
      
      const rows = users.map(u => [
        u.id,
        `"${u.hotelName}"`,
        u.email,
        u.hotelType,
        u.rooms,
        u.totalRevenue.toFixed(2),
        u.totalCosts.toFixed(2),
        u.hasRevenueData ? 'Sì' : 'No',
        u.hasCostsData ? 'Sì' : 'No',
        u.revenueDataCount,
        u.recommendationsCount,
        u.createdAt
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="revenuesentry-users-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'json') {
      return NextResponse.json({ users }, {
        headers: {
          'Content-Disposition': `attachment; filename="revenuesentry-users-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Formato non supportato. Usa csv o json' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Errore export dati:', error);
    return NextResponse.json(
      { error: 'Errore nell\'export', details: error.message },
      { status: 500 }
    );
  }
}

function calculateTotalCostsForUser(costs: any): number {
  if (!costs) return 0;
  
  let total = 0;
  
  if (costs.ristorazione && Array.isArray(costs.ristorazione)) {
    total += costs.ristorazione.reduce((sum: number, item: any) => sum + (item.importo || 0), 0);
  }
  
  if (costs.utenze) {
    total += (costs.utenze.energia?.importo || 0);
    total += (costs.utenze.gas?.importo || 0);
    total += (costs.utenze.acqua?.importo || 0);
  }
  
  if (costs.personale) {
    total += (costs.personale.bustePaga || 0);
    total += (costs.personale.sicurezza || 0);
  }
  
  if (costs.marketing) {
    total += (costs.marketing.costiMarketing || 0);
    total += (costs.marketing.commissioniOTA || 0);
  }
  
  if (costs.altriCosti && typeof costs.altriCosti === 'object') {
    total += Object.values(costs.altriCosti).reduce((sum: number, val: any) => sum + (val || 0), 0);
  }
  
  return total;
}

