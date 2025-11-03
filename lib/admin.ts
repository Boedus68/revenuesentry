// Utilities per verifica e gestione admin

import { db } from './firebase';
import { adminDb } from './firebase-admin';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Verifica se un utente è admin lato server
 * Usa Firebase Admin SDK se disponibile (bypassa regole Firestore), altrimenti usa client SDK
 */
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    if (!uid) {
      console.warn('[Admin Verify] UID mancante');
      return false;
    }
    
    console.log('[Admin Verify] Verifica admin per UID:', uid);
    console.log('[Admin Verify] Admin SDK disponibile:', !!adminDb);
    console.log('[Admin Verify] NODE_ENV:', process.env.NODE_ENV);
    
    // Prova prima con Admin SDK (bypassa regole Firestore)
    if (adminDb) {
      try {
        console.log('[Admin Verify] Tentativo con Firebase Admin SDK...');
        const userDoc = await adminDb.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
          console.warn('[Admin Verify] Documento utente non trovato con Admin SDK');
          return false;
        }
        
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin';
        console.log('[Admin Verify] ✅ Risultato Admin SDK:', {
          role: userData?.role,
          isAdmin,
          email: userData?.email
        });
        return isAdmin;
      } catch (adminError: any) {
        console.error('[Admin Verify] ❌ Errore con Admin SDK:', {
          message: adminError.message,
          code: adminError.code,
          stack: adminError.stack
        });
        // Fallback al client SDK
      }
    } else {
      console.warn('[Admin Verify] ⚠️ Admin SDK non disponibile. Fallback al Client SDK.');
      console.warn('[Admin Verify] Per funzionamento ottimale, configura FIREBASE_SERVICE_ACCOUNT_KEY in produzione.');
    }
    
    // Fallback: usa client SDK (rispetta regole Firestore)
    // NOTA: Questo potrebbe fallire se le regole Firestore non permettono la lettura
    console.log('[Admin Verify] Tentativo con Firebase Client SDK (fallback)...');
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.warn('[Admin Verify] Documento utente non trovato con Client SDK');
        return false;
      }
      
      const userData = userDocSnap.data();
      const isAdmin = userData?.role === 'admin';
      console.log('[Admin Verify] ✅ Risultato Client SDK:', {
        role: userData?.role,
        isAdmin,
        email: userData?.email
      });
      return isAdmin;
    } catch (clientError: any) {
      console.error('[Admin Verify] ❌ Errore con Client SDK:', {
        message: clientError.message,
        code: clientError.code
      });
      console.error('[Admin Verify] Questo potrebbe essere causato da:');
      console.error('[Admin Verify] 1. Regole Firestore che bloccano l\'accesso');
      console.error('[Admin Verify] 2. Utente non autenticato correttamente');
      console.error('[Admin Verify] 3. Problemi di rete o connessione');
      throw clientError; // Rilancia per gestione superiore
    }
  } catch (error: any) {
    console.error('[Admin Verify] ❌ Errore generale verifica admin:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Verifica admin da token Firebase (per API routes)
 */
export async function verifyAdminFromToken(authToken?: string | null): Promise<{ isAdmin: boolean; uid?: string }> {
  try {
    if (!authToken) {
      return { isAdmin: false };
    }

    // In Next.js API routes, dobbiamo verificare il token Firebase
    // Per ora, assumiamo che il token sia passato nell'header Authorization
    // In produzione, usa firebase-admin per verificare il token
    
    // TODO: Implementare verifica token con firebase-admin
    // Per ora, questa funzione deve essere chiamata con l'uid già verificato
    return { isAdmin: false };
  } catch (error) {
    console.error('Errore verifica admin da token:', error);
    return { isAdmin: false };
  }
}

/**
 * Verifica admin da UID (metodo principale)
 */
export async function verifyAdminFromUID(uid: string | null | undefined): Promise<boolean> {
  if (!uid) {
    console.warn('[Admin Verify] verifyAdminFromUID chiamato con UID null/undefined');
    return false;
  }
  
  try {
    const result = await isAdmin(uid);
    console.log('[Admin Verify] Risultato finale verifyAdminFromUID:', result);
    return result;
  } catch (error: any) {
    console.error('[Admin Verify] Errore in verifyAdminFromUID:', error);
    return false;
  }
}

