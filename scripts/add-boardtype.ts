import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// NOTA: Questo script supporta:
// 1. Variabile d'ambiente FIREBASE_SERVICE_ACCOUNT_KEY (JSON)
// 2. Variabile d'ambiente FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 (Base64)
// 3. File service-account-key.json nella root del progetto
// 4. File revenuesentry-firebase-key.json nella root del progetto (legacy)
//
// Per eseguirlo: npx tsx scripts/add-boardtype.ts

let serviceAccount: any = null;

// 1. Prova variabile d'ambiente JSON
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('✅ Service Account caricato da FIREBASE_SERVICE_ACCOUNT_KEY');
  } catch (error: any) {
    console.error('❌ Errore parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
  }
}

// 2. Prova variabile d'ambiente Base64
if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
  try {
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decoded);
    console.log('✅ Service Account caricato da FIREBASE_SERVICE_ACCOUNT_KEY_BASE64');
  } catch (error: any) {
    console.error('❌ Errore decodifica Base64:', error.message);
  }
}

// 3. Prova file service-account-key.json
if (!serviceAccount) {
  const serviceAccountPath = join(process.cwd(), 'service-account-key.json');
  if (existsSync(serviceAccountPath)) {
    try {
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
      console.log('✅ Service Account caricato da service-account-key.json');
    } catch (error: any) {
      console.error('❌ Errore lettura service-account-key.json:', error.message);
    }
  }
}

// 4. Prova file revenuesentry-firebase-key.json (legacy)
if (!serviceAccount) {
  const legacyPath = join(process.cwd(), 'revenuesentry-firebase-key.json');
  if (existsSync(legacyPath)) {
    try {
      serviceAccount = JSON.parse(readFileSync(legacyPath, 'utf-8'));
      console.log('✅ Service Account caricato da revenuesentry-firebase-key.json');
    } catch (error: any) {
      console.error('❌ Errore lettura revenuesentry-firebase-key.json:', error.message);
    }
  }
}

if (!serviceAccount) {
  console.error('\n❌ ERRORE: Nessuna credenziale Firebase trovata!');
  console.error('\n💡 Soluzione:');
  console.error('   Configura una delle seguenti opzioni:');
  console.error('   1. Variabile d\'ambiente FIREBASE_SERVICE_ACCOUNT_KEY (JSON)');
  console.error('   2. Variabile d\'ambiente FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 (Base64)');
  console.error('   3. File service-account-key.json nella root del progetto');
  console.error('   4. File revenuesentry-firebase-key.json nella root del progetto');
  process.exit(1);
}

try {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || 'revenuesentry',
  });
  console.log('✅ Firebase Admin inizializzato');
} catch (error: any) {
  console.error('❌ Errore inizializzazione Firebase Admin:', error.message);
  process.exit(1);
}

const db = getFirestore();

async function addBoardType() {
  try {
    console.log('\n🔍 Connessione a Firestore...');
    const snapshot = await db.collection('competitor_configs').get();
    
    console.log(`📊 Trovati ${snapshot.size} competitors totali`);
    
    if (snapshot.empty) {
      console.log('ℹ️  Nessun competitor trovato');
      return;
    }
    
    const batch = db.batch();
    let count = 0;
    let alreadyHasBoardType = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.boardType) {
        batch.update(doc.ref, { boardType: 'breakfast' });
        count++;
        console.log(`  - ${data.competitor_name || doc.id}: aggiunto boardType: 'breakfast'`);
      } else {
        alreadyHasBoardType++;
      }
    });
    
    if (count > 0) {
      console.log(`\n💾 Salvataggio di ${count} aggiornamenti...`);
      await batch.commit();
      console.log(`✅ Aggiornati ${count} competitors`);
      console.log(`ℹ️  ${alreadyHasBoardType} competitors avevano già boardType`);
    } else {
      console.log(`✅ Tutti i ${snapshot.size} competitors hanno già boardType`);
    }
  } catch (error: any) {
    console.error('❌ Errore:', error.message);
    throw error;
  }
}

addBoardType()
  .then(() => {
    console.log('\n✅ Migrazione completata con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore durante la migrazione:', error);
    process.exit(1);
  });
