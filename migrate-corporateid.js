// SCRIPT MIGRAZIONE DATABASE - competitorId
// Aggiunge competitorId ai documenti competitor_data vecchi che hanno solo competitor_name

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Mappatura competitor_name → competitorId
// (Questi ID vengono da competitor_configs)
const MAPPATURA = {
  "Hotel Elite": "A6F2kSMOWkeI21DlRRGG",
  "Hotel Romagna": "FPacq9RiBdn5lWpplBVx",
  "Hotel Gabbiano": "Jc0M9yGKnfiuLMJO6iNV",
  "Hotel Ninfea": "MliZ8dlGQteY4A631VwM",
  "Hotel Villa Enea": "VYMgPQgMGkVWRINYR7Wh",
  "Hotel Solmar": "WtxplebLUmXIHWLsm4wF",
  "Hotel Lucciola": "Y0dYTmPiGUhpSqbSQfLK",
  "Hotel La Rosa": "Z3kSNphVuSmKLd1vZbcS",
  "Hotel Nord Est": "hHAeqvgoOwOSosLXK5zh",
  "Hotel Principe": "rSTkdG1T2mL9nCOu3hr4",
  "Hotel Giulio Cesare": "tIYoKThcqiDxUjLQYA5f",
  "Hotel D'Annunzio": "x48U7q8hzgNdKLdPvDvO"
};

// Inizializza Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./service-account-key.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrateCompetitorData() {
  console.log('🔄 Inizio migrazione competitor_data...\n');
  
  try {
    const snapshot = await db.collection('competitor_data').get();
    console.log(`📦 Trovati ${snapshot.size} documenti totali\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip se ha già competitorId
      if (data.competitorId) {
        skipped++;
        continue;
      }
      
      // Trova competitorId dalla mappatura
      const competitorName = data.competitor_name;
      const competitorId = MAPPATURA[competitorName];
      
      if (!competitorId) {
        console.warn(`⚠️  Competitor non trovato in mappatura: "${competitorName}"`);
        errors++;
        continue;
      }
      
      try {
        // Aggiorna documento
        await doc.ref.update({ competitorId });
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`📊 Progresso: ${updated} aggiornati, ${skipped} saltati, ${errors} errori`);
        }
      } catch (err) {
        console.error(`❌ Errore aggiornando ${doc.id}:`, err.message);
        errors++;
      }
    }
    
    console.log('\n✅ Migrazione completata!');
    console.log(`   📝 Totali: ${snapshot.size}`);
    console.log(`   ✅ Aggiornati: ${updated}`);
    console.log(`   ⏭️  Saltati (già con competitorId): ${skipped}`);
    console.log(`   ❌ Errori: ${errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    process.exit(1);
  }
}

migrateCompetitorData();