// Firebase Admin SDK per API routes server-side
// Questo bypassa le regole Firestore perché viene eseguito con privilegi amministrativi

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inizializza Firebase Admin solo se non è già inizializzato
let adminDb: ReturnType<typeof getFirestore> | null = null;

try {
  if (getApps().length === 0) {
    // Per ora, usa le credenziali del progetto direttamente
    // In produzione, dovresti usare un service account JSON
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount as any),
        projectId: 'revenuesentry',
      });
    } else {
      // Fallback: usa Application Default Credentials se disponibili
      // (ad esempio su Google Cloud Platform)
      try {
        initializeApp({
          projectId: 'revenuesentry',
        });
      } catch (error) {
        console.warn('[Firebase Admin] Inizializzazione fallita. Le API admin potrebbero non funzionare.');
        console.warn('[Firebase Admin] Configura FIREBASE_SERVICE_ACCOUNT_KEY o usa Application Default Credentials.');
      }
    }
  }
  
  adminDb = getFirestore();
} catch (error) {
  console.error('[Firebase Admin] Errore inizializzazione:', error);
}

export { adminDb };

