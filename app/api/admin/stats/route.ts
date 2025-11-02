import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin';
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

    console.log('[API Admin Stats] UID ricevuto:', adminUid);
    console.log('[API Admin Stats] Inizio verifica admin...');
    
    const isAdmin = await verifyAdminFromUID(adminUid);
    console.log('[API Admin Stats] Risultato verifica admin:', isAdmin);
    
    if (!isAdmin) {
      console.error('[API Admin Stats] Verifica admin fallita per uid:', adminUid);
      console.error('[API Admin Stats] Controlla che:');
      console.error('[API Admin Stats] 1. Il documento users/' + adminUid + ' esista in Firestore');
      console.error('[API Admin Stats] 2. Il campo "role" sia impostato su "admin"');
      console.error('[API Admin Stats] 3. Firebase Admin SDK sia inizializzato correttamente');
      return NextResponse.json({ 
        error: 'Unauthorized: Non sei un admin',
        details: `UID: ${adminUid}`,
        hint: 'Verifica che il documento users/' + adminUid + ' abbia role: "admin" in Firestore'
      }, { status: 403 });
    }

    // Log azione admin (non bloccare se fallisce)
    try {
      await logAdminAction(adminUid, 'view_stats', {});
    } catch (logError) {
      console.warn('[API Admin Stats] Errore nel log admin action (non critico):', logError);
    }

    // Recupera tutti gli utenti
    console.log('[API Admin Stats] Tentativo di recuperare tutti gli utenti...');
    
    // Usa adminDb se disponibile (bypassa le regole), altrimenti usa db normale
    let usersSnapshot;
    try {
      if (adminDb) {
        // Usa Firebase Admin SDK (bypassa regole Firestore)
        console.log('[API Admin Stats] Usa Firebase Admin SDK');
        const usersCollection = adminDb.collection('users');
        usersSnapshot = await usersCollection.get();
        console.log('[API Admin Stats] Documenti trovati (admin):', usersSnapshot.size);
      } else {
        // Fallback: usa client SDK (rispetta regole Firestore)
        console.log('[API Admin Stats] Usa Firebase Client SDK (fallback)');
        const usersRef = collection(db, 'users');
        usersSnapshot = await getDocs(usersRef);
        console.log('[API Admin Stats] Documenti trovati (client):', usersSnapshot.size);
      }
    } catch (firestoreError: any) {
      console.error('[API Admin Stats] Errore Firestore getDocs:', firestoreError);
      console.error('[API Admin Stats] Errore code:', firestoreError.code);
      console.error('[API Admin Stats] Errore message:', firestoreError.message);
      throw firestoreError;
    }
    
    const users: any[] = [];
    let totalRevenue = 0;
    let totalCosts = 0;
    let hotelsWithData = 0;
    let hotelsWithRecommendations = 0;
    let totalRooms = 0;
    const registrationsByMonth: Record<string, number> = {};
    
    // Entrambi gli SDK restituiscono docs come array
    const docs = usersSnapshot.docs || [];
    
    docs.forEach((doc: any) => {
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
      const userDoc = docs.find((d: any) => d.id === user.id);
      const userData = userDoc ? userDoc.data() : null;
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

