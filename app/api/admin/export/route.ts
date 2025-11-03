import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { verifyAdminFromUID } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-log';
import { jsPDF } from 'jspdf';

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
    } else if (format === 'pdf') {
      // Genera PDF con logo e impaginazione accattivante
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Colori del tema
      const primaryColor: [number, number, number] = [59, 130, 246]; // blue-500
      const secondaryColor: [number, number, number] = [147, 197, 253]; // blue-300
      const darkColor: [number, number, number] = [31, 41, 55]; // gray-800
      const textColor: [number, number, number] = [17, 24, 39]; // gray-900
      const lightGray: [number, number, number] = [229, 231, 235]; // gray-200

      // Header con logo e titolo
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      // Testo logo
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Revenue', 20, 15);
      
      doc.setFontSize(18);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Sentry', 20, 22);
      
      // Titolo report
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('Report Utenti', pageWidth - 20, 18, { align: 'right' });
      
      // Data generazione
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      const dataGen = new Date().toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generato il: ${dataGen}`, pageWidth - 20, 25, { align: 'right' });

      // Separatore
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(0, 32, pageWidth, 32);

      // Statistiche riassuntive
      let yPos = 40;
      doc.setFontSize(12);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('Statistiche Riepilogative', 10, yPos);
      
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.hasRevenueData || u.hasCostsData).length;
      const totalRevenue = users.reduce((sum, u) => sum + u.totalRevenue, 0);
      const totalCosts = users.reduce((sum, u) => sum + u.totalCosts, 0);
      
      doc.text(`Utenti Totali: ${totalUsers}`, 10, yPos);
      doc.text(`Utenti Attivi: ${activeUsers}`, 80, yPos);
      doc.text(`Ricavi Totali: €${totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 150, yPos);
      
      yPos += 6;
      doc.text(`Costi Totali: €${totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 10, yPos);
      doc.text(`Media Ricavi: €${totalUsers > 0 ? (totalRevenue / totalUsers).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '0.00'}`, 150, yPos);

      // Tabella utenti
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('Dettaglio Utenti', 10, yPos);
      
      yPos += 8;
      
      // Intestazione tabella
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(10, yPos - 5, pageWidth - 20, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      
      const colWidths = [25, 35, 25, 20, 25, 25, 15, 15, 15];
      const headers = ['Hotel', 'Email', 'Tipo', 'Camere', 'Ricavi', 'Costi', 'Ricavi', 'Costi', 'Consigli'];
      let xPos = 12;
      headers.forEach((header, idx) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[idx];
      });

      yPos += 5;
      
      // Dati utenti
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      let rowCount = 0;
      const maxRowsPerPage = 12;
      
      users.forEach((user, index) => {
        if (rowCount >= maxRowsPerPage) {
          doc.addPage();
          yPos = 20;
          rowCount = 0;
          
          // Ripeti header
          doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
          doc.rect(10, yPos - 5, pageWidth - 20, 6, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          xPos = 12;
          headers.forEach((header, idx) => {
            doc.text(header, xPos, yPos);
            xPos += colWidths[idx];
          });
          yPos += 5;
        }

        // Alterna colore righe
        if (index % 2 === 0) {
          doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
          doc.rect(10, yPos - 4, pageWidth - 20, 4, 'F');
        }
        
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        xPos = 12;
        
        // Hotel Name (troncato se troppo lungo)
        const hotelName = user.hotelName.length > 20 ? user.hotelName.substring(0, 17) + '...' : user.hotelName;
        doc.text(hotelName, xPos, yPos);
        xPos += colWidths[0];
        
        // Email (troncato)
        const email = user.email.length > 25 ? user.email.substring(0, 22) + '...' : user.email;
        doc.text(email, xPos, yPos);
        xPos += colWidths[1];
        
        // Tipo Hotel
        doc.text(user.hotelType, xPos, yPos);
        xPos += colWidths[2];
        
        // Camere
        doc.text(user.rooms.toString(), xPos, yPos);
        xPos += colWidths[3];
        
        // Ricavi Totali
        doc.text(`€${user.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, xPos, yPos);
        xPos += colWidths[4];
        
        // Costi Totali
        doc.text(`€${user.totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, xPos, yPos);
        xPos += colWidths[5];
        
        // Dati Ricavi
        doc.text(user.hasRevenueData ? 'Sì' : 'No', xPos, yPos);
        xPos += colWidths[6];
        
        // Dati Costi
        doc.text(user.hasCostsData ? 'Sì' : 'No', xPos, yPos);
        xPos += colWidths[7];
        
        // Num Consigli
        doc.text(user.recommendationsCount.toString(), xPos, yPos);
        
        yPos += 5;
        rowCount++;
      });

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Pagina ${i} di ${totalPages} - RevenueSentry Report`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="revenuesentry-users-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Formato non supportato. Usa csv, json o pdf' }, { status: 400 });
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

