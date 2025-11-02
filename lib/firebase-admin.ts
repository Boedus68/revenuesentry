// Firebase Admin SDK per API routes server-side
// Questo bypassa le regole Firestore perché viene eseguito con privilegi amministrativi

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inizializza Firebase Admin solo se non è già inizializzato
let adminDb: ReturnType<typeof getFirestore> | null = null;

// Log quando il modulo viene caricato
console.log('[Firebase Admin] ========================================');
console.log('[Firebase Admin] Modulo caricato. Verifica configurazione...');
console.log('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY presente:', !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
console.log('[Firebase Admin] NODE_ENV:', process.env.NODE_ENV);
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  const keyLength = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length;
  console.log('[Firebase Admin] ✅ Lunghezza chiave:', keyLength, 'caratteri');
  // Mostra solo i primi e ultimi caratteri per sicurezza
  if (keyLength > 40) {
    const preview = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 20) + '...' + process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(keyLength - 20);
    console.log('[Firebase Admin] Preview chiave:', preview);
  }
  // Verifica se inizia con { (JSON valido)
  const startsWithBrace = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim().startsWith('{');
  console.log('[Firebase Admin] Inizia con { (JSON valido):', startsWithBrace);
} else {
  console.log('[Firebase Admin] ❌ FIREBASE_SERVICE_ACCOUNT_KEY NON TROVATA');
  console.log('[Firebase Admin] Verifica che:');
  console.log('[Firebase Admin] 1. Il file .env.local esista nella root del progetto');
  console.log('[Firebase Admin] 2. Contenga la riga: FIREBASE_SERVICE_ACCOUNT_KEY=...');
  console.log('[Firebase Admin] 3. Il server sia stato riavviato dopo aver aggiunto la variabile');
}
console.log('[Firebase Admin] ========================================');

try {
  if (getApps().length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        // Prova a parsare come JSON
        const serviceAccount = JSON.parse(serviceAccountKey);
        console.log('[Firebase Admin] JSON parsato correttamente');
        console.log('[Firebase Admin] Inizializzazione con Service Account Key');
        initializeApp({
          credential: cert(serviceAccount as any),
          projectId: 'revenuesentry',
        });
        console.log('[Firebase Admin] ✅ Inizializzato correttamente con Service Account');
      } catch (parseError: any) {
        console.error('[Firebase Admin] ❌ Errore parsing Service Account Key:', parseError.message);
        console.error('[Firebase Admin] Stack:', parseError.stack);
        console.warn('[Firebase Admin] Verifica che FIREBASE_SERVICE_ACCOUNT_KEY sia un JSON valido');
      }
    } else {
      // Fallback: usa Application Default Credentials se disponibili
      // (ad esempio su Google Cloud Platform)
      try {
        console.log('[Firebase Admin] Tentativo inizializzazione con Application Default Credentials');
        initializeApp({
          projectId: 'revenuesentry',
        });
        console.log('[Firebase Admin] ✅ Inizializzato con Application Default Credentials');
      } catch (error: any) {
        console.warn('[Firebase Admin] ❌ Inizializzazione fallita:', error.message);
        console.warn('[Firebase Admin] Le API admin useranno il fallback client SDK.');
        console.warn('[Firebase Admin] Per funzionamento completo, configura FIREBASE_SERVICE_ACCOUNT_KEY nel file .env.local');
      }
    }
  } else {
    console.log('[Firebase Admin] App già inizializzata, riutilizzo istanza esistente');
  }
  
  // Inizializza Firestore anche se l'app non è stata inizializzata (potrebbe essere già inizializzata)
  try {
    adminDb = getFirestore();
    console.log('[Firebase Admin] Firestore Admin inizializzato');
  } catch (dbError: any) {
    console.warn('[Firebase Admin] Errore inizializzazione Firestore Admin:', dbError.message);
    adminDb = null;
  }
} catch (error: any) {
  console.error('[Firebase Admin] Errore generale inizializzazione:', error.message);
  adminDb = null;
}

export { adminDb };

