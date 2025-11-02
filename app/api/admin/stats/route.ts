import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { verifyAdminFromUID } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-log';
import { calculateKPI } from '@/lib/calculations';

/**
 * API per recuperare statistiche degli utenti (solo admin)
 * GET /api/admin/stats
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica admin - l'uid viene passato come query param o header
    const adminUid = request.headers.get('x-admin-uid') || request.nextUrl.searchParams.get('uid');
    
    if (!adminUid) {
      return NextResponse.json({ error: 'Unauthorized: UID mancante' }, { status: 401 });
    }

    const isAdmin = await verifyAdminFromUID(adminUid);
    if (!isAdmin) {
      console.error('[API Admin Stats] Verifica admin fallita per uid:', adminUid);
      return NextResponse.json({ error: 'Unauthorized: Non sei un admin' }, { status: 403 });
    }

    // Log azione admin (non bloccare se fallisce)
    try {
      await logAdminAction(adminUid, 'view_stats', {});
    } catch (logError) {
      console.warn('[API Admin Stats] Errore nel log admin action (non critico):', logError);
    }

    // Recupera tutti gli utenti
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const users: any[] = [];
    let totalRevenue = 0;
    let totalCosts = 0;
    let hotelsWithData = 0;
    let hotelsWithRecommendations = 0;
    let totalRooms = 0;
    const registrationsByMonth: Record<string, number> = {};
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const userId = doc.id;
      
      // Calcola statistiche per utente
      const userRevenue = userData.revenues?.reduce((sum: number, r: any) => sum + (r.entrateTotali || 0), 0) || 0;
      
      // Gestisci costi: possono essere in formato costs (vecchio) o monthlyCosts (nuovo)
      let userCosts = 0;
      if (userData.monthlyCosts && Array.isArray(userData.monthlyCosts)) {
        // Nuovo formato: somma tutti i costi mensili
        userCosts = userData.monthlyCosts.reduce((sum: number, mc: any) => {
          return sum + calculateTotalCostsForUser(mc.costs || {});
        }, 0);
      } else {
        // Vecchio formato
        userCosts = calculateTotalCostsForUser(userData.costs);
      }
      
      const hasRevenueData = userData.revenues && userData.revenues.length > 0;
      const hasCostsData = (userData.costs && Object.keys(userData.costs).length > 0) || 
                           (userData.monthlyCosts && userData.monthlyCosts.length > 0);
      const hasData = hasRevenueData || hasCostsData;
      const hasRecommendations = userData.recommendations && userData.recommendations.length > 0;
      
      if (hasData) hotelsWithData++;
      if (hasRecommendations) hotelsWithRecommendations++;
      
      totalRevenue += userRevenue;
      totalCosts += userCosts;
      totalRooms += userData.hotelData?.camereTotali || 0;
      
      // Statistiche registrazioni per mese
      if (userData.createdAt) {
        const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
        const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
        registrationsByMonth[monthKey] = (registrationsByMonth[monthKey] || 0) + 1;
      }
      
      users.push({
        id: userId,
        hotelName: userData.hotelName || 'N/A',
        email: userData.email || 'N/A',
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData.createdAt,
        updatedAt: userData.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : userData.updatedAt,
        hasRevenueData,
        hasCostsData,
        hasRecommendations,
        revenueDataCount: userData.revenues?.length || 0,
        recommendationsCount: userData.recommendations?.length || 0,
        totalRevenue: userRevenue,
        totalCosts: userCosts,
        rooms: userData.hotelData?.camereTotali || 0,
        hotelType: userData.hotelData?.tipoHotel || 'N/A',
      });
    });

    // Calcola statistiche aggregate
    const totalUsers = users.length;
    const activeUsers = hotelsWithData;
    const avgRevenue = activeUsers > 0 ? totalRevenue / activeUsers : 0;
    const avgCosts = activeUsers > 0 ? totalCosts / activeUsers : 0;
    const avgRooms = totalUsers > 0 ? totalRooms / totalUsers : 0;

    // Calcola KPI aggregati per tutti gli utenti
    let totalRevPAR = 0;
    let totalADR = 0;
    let totalOccupancy = 0;
    let totalTrevPAR = 0;
    let totalGOP = 0;
    let totalGOPMargin = 0;
    let kpiCount = 0;

    users.forEach((user) => {
      const userData = usersSnapshot.docs.find(d => d.id === user.id)?.data();
      if (userData?.kpi) {
        const kpi = userData.kpi;
        totalRevPAR += kpi.revpar || 0;
        totalADR += kpi.adr || 0;
        totalOccupancy += kpi.occupazione || 0;
        totalTrevPAR += kpi.trevpar || 0;
        totalGOP += kpi.gop || 0;
        totalGOPMargin += kpi.gopMargin || 0;
        kpiCount++;
      }
    });

    const avgRevPAR = kpiCount > 0 ? totalRevPAR / kpiCount : 0;
    const avgADR = kpiCount > 0 ? totalADR / kpiCount : 0;
    const avgOccupancy = kpiCount > 0 ? totalOccupancy / kpiCount : 0;
    const avgTrevPAR = kpiCount > 0 ? totalTrevPAR / kpiCount : 0;
    const avgGOP = kpiCount > 0 ? totalGOP / kpiCount : 0;
    const avgGOPMargin = kpiCount > 0 ? totalGOPMargin / kpiCount : 0;

    // Calcola trend (confronta ultimi 2 mesi)
    const sortedMonths = Object.keys(registrationsByMonth).sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const registrationTrend = prevMonth 
      ? registrationsByMonth[lastMonth] - registrationsByMonth[prevMonth]
      : 0;

    return NextResponse.json({
      summary: {
        totalUsers,
        activeUsers,
        hotelsWithData,
        hotelsWithRecommendations,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCosts: Math.round(totalCosts * 100) / 100,
        avgRevenue: Math.round(avgRevenue * 100) / 100,
        avgCosts: Math.round(avgCosts * 100) / 100,
        avgRooms: Math.round(avgRooms * 100) / 100,
        registrationsByMonth,
        registrationTrend,
        // KPI aggregati
        kpi: {
          avgRevPAR: Math.round(avgRevPAR * 100) / 100,
          avgADR: Math.round(avgADR * 100) / 100,
          avgOccupancy: Math.round(avgOccupancy * 100) / 100,
          avgTrevPAR: Math.round(avgTrevPAR * 100) / 100,
          avgGOP: Math.round(avgGOP * 100) / 100,
          avgGOPMargin: Math.round(avgGOPMargin * 100) / 100,
          hotelsWithKPI: kpiCount,
        },
      },
      users: users.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Più recenti prima
      }),
    });
  } catch (error: any) {
    console.error('[API Admin Stats] Errore recupero statistiche admin:', error);
    console.error('[API Admin Stats] Stack trace:', error.stack);
    return NextResponse.json(
      { 
        error: 'Errore nel recupero delle statistiche', 
        details: error.message,
        code: error.code || 'UNKNOWN',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Helper per calcolare il totale dei costi di un utente
 */
function calculateTotalCostsForUser(costs: any): number {
  if (!costs) return 0;
  
  let total = 0;
  
  // Ristorazione
  if (costs.ristorazione && Array.isArray(costs.ristorazione)) {
    total += costs.ristorazione.reduce((sum: number, item: any) => sum + (item.importo || 0), 0);
  }
  
  // Utenze
  if (costs.utenze) {
    total += (costs.utenze.energia?.importo || 0);
    total += (costs.utenze.gas?.importo || 0);
    total += (costs.utenze.acqua?.importo || 0);
  }
  
  // Personale
  if (costs.personale) {
    total += (costs.personale.bustePaga || 0);
    total += (costs.personale.sicurezza || 0);
  }
  
  // Marketing
  if (costs.marketing) {
    total += (costs.marketing.costiMarketing || 0);
    total += (costs.marketing.commissioniOTA || 0);
  }
  
  // Altri costi
  if (costs.altriCosti && typeof costs.altriCosti === 'object') {
    total += Object.values(costs.altriCosti).reduce((sum: number, val: any) => sum + (val || 0), 0);
  }
  
  return total;
}

