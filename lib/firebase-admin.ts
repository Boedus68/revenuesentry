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
    
    // Alternativa: prova a leggere da file JSON diretto (per sviluppo locale)
    let serviceAccount: any = null;
    
    if (serviceAccountKey) {
      try {
        // Prova a parsare come JSON
        serviceAccount = JSON.parse(serviceAccountKey);
        console.log('[Firebase Admin] JSON parsato correttamente da variabile d\'ambiente');
        console.log('[Firebase Admin] Inizializzazione con Service Account Key');
      } catch (parseError: any) {
        console.error('[Firebase Admin] ❌ Errore parsing Service Account Key:', parseError.message);
        console.warn('[Firebase Admin] Verifica che FIREBASE_SERVICE_ACCOUNT_KEY sia un JSON valido');
      }
    }
    
    // Se non c'è la variabile, prova a leggere da file (solo sviluppo, NON in produzione)
    if (!serviceAccount && process.env.NODE_ENV !== 'production') {
      try {
        const fs = require('fs');
        const path = require('path');
        const cwd = process.cwd();
        const serviceAccountPath = path.join(cwd, 'service-account-key.json');
        
        console.log('[Firebase Admin] Tentativo lettura da file...');
        console.log('[Firebase Admin] Working directory (cwd):', cwd);
        console.log('[Firebase Admin] Percorso completo file:', serviceAccountPath);
        console.log('[Firebase Admin] File esiste?', fs.existsSync(serviceAccountPath));
        
        // Prova anche percorsi alternativi comuni
        const alternativePaths = [
          path.join(cwd, '..', 'service-account-key.json'),
          path.join(__dirname, '..', 'service-account-key.json'),
          path.join(__dirname, '..', '..', 'service-account-key.json'),
        ];
        
        console.log('[Firebase Admin] Percorsi alternativi da controllare:');
        alternativePaths.forEach((altPath, idx) => {
          console.log(`[Firebase Admin]   ${idx + 1}. ${altPath} - Esiste: ${fs.existsSync(altPath)}`);
        });
        
        if (fs.existsSync(serviceAccountPath)) {
          console.log('[Firebase Admin] ✅ File trovato! Lettura in corso...');
          const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
          console.log('[Firebase Admin] ✅ Service Account caricato da file');
        } else {
          // Prova percorsi alternativi
          for (const altPath of alternativePaths) {
            if (fs.existsSync(altPath)) {
              console.log('[Firebase Admin] ✅ File trovato in percorso alternativo:', altPath);
              const fileContent = fs.readFileSync(altPath, 'utf8');
              serviceAccount = JSON.parse(fileContent);
              console.log('[Firebase Admin] ✅ Service Account caricato da file alternativo');
              break;
            }
          }
          
          if (!serviceAccount) {
            console.warn('[Firebase Admin] ⚠️ File service-account-key.json non trovato in nessun percorso');
            console.warn('[Firebase Admin] Percorso atteso:', serviceAccountPath);
            console.warn('[Firebase Admin] Verifica che il file esista nella root del progetto (stessa cartella di package.json)');
          }
        }
      } catch (fileError: any) {
        // Ignora errore se il file non esiste
        if (fileError.code !== 'ENOENT') {
          console.error('[Firebase Admin] ❌ Errore lettura file service-account-key.json:', fileError.message);
          console.error('[Firebase Admin] Stack:', fileError.stack);
        }
      }
    }
    
    if (serviceAccount) {
      try {
        initializeApp({
          credential: cert(serviceAccount as any),
          projectId: 'revenuesentry',
        });
        console.log('[Firebase Admin] ✅ Inizializzato correttamente con Service Account');
      } catch (initError: any) {
        console.error('[Firebase Admin] ❌ Errore inizializzazione app:', initError.message);
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
  
  // Inizializza Firestore solo se l'app è stata inizializzata correttamente
  try {
    const apps = getApps();
    if (apps.length > 0) {
      adminDb = getFirestore();
      // Configura Firestore per ignorare valori undefined (solo se non già configurato)
      // Evita errore "settings() can only be called once"
      try {
        adminDb.settings({ ignoreUndefinedProperties: true });
        console.log('[Firebase Admin] ✅ Firestore Admin inizializzato correttamente');
      } catch (settingsError: any) {
        // Se settings() è già stato chiamato, ignora l'errore (è normale in hot reload)
        if (settingsError.message?.includes('already been initialized') || 
            settingsError.message?.includes('settings()')) {
          console.log('[Firebase Admin] ✅ Firestore Admin già inizializzato (hot reload)');
        } else {
          throw settingsError;
        }
      }
    } else {
      console.warn('[Firebase Admin] ⚠️ App non inizializzata, Firestore Admin non disponibile');
      adminDb = null;
    }
  } catch (dbError: any) {
    console.warn('[Firebase Admin] ❌ Errore inizializzazione Firestore Admin:', dbError.message);
    adminDb = null;
  }
} catch (error: any) {
  console.error('[Firebase Admin] Errore generale inizializzazione:', error.message);
  adminDb = null;
}

/**
 * Funzione helper per ottenere adminDb, inizializzandolo se necessario
 * Usa questa funzione invece di importare direttamente adminDb nelle API routes
 */
export function getAdminDb() {
  // Se già inizializzato, ritorna
  if (adminDb) {
    return adminDb;
  }

  // Prova a inizializzare se l'app esiste
  try {
    const apps = getApps();
    if (apps.length > 0) {
      adminDb = getFirestore();
      // Configura settings solo se non già configurato (evita errore in hot reload)
      try {
        adminDb.settings({ ignoreUndefinedProperties: true });
        console.log('[Firebase Admin] ✅ Firestore Admin inizializzato (lazy)');
      } catch (settingsError: any) {
        // Se settings() è già stato chiamato, ignora (normale in hot reload)
        if (settingsError.message?.includes('already been initialized') || 
            settingsError.message?.includes('settings()')) {
          console.log('[Firebase Admin] ✅ Firestore Admin già inizializzato (lazy, hot reload)');
        } else {
          throw settingsError;
        }
      }
      return adminDb;
    }
  } catch (error: any) {
    console.error('[Firebase Admin] ❌ Errore inizializzazione lazy:', error.message);
  }

  return null;
}

export { adminDb };

