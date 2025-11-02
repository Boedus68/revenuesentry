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
    if (!uid) return false;
    
    // Prova prima con Admin SDK (bypassa regole Firestore)
    if (adminDb) {
      try {
        console.log('[Admin Verify] Usa Firebase Admin SDK per verificare ruolo admin');
        const userDoc = await adminDb.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
          console.log('[Admin Verify] Documento utente non trovato');
          return false;
        }
        
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin';
        console.log('[Admin Verify] Ruolo utente:', userData?.role, '-> Admin:', isAdmin);
        return isAdmin;
      } catch (adminError: any) {
        console.error('[Admin Verify] Errore con Admin SDK:', adminError);
        // Fallback al client SDK
      }
    }
    
    // Fallback: usa client SDK (rispetta regole Firestore, potrebbe fallire se non autenticato)
    console.log('[Admin Verify] Usa Firebase Client SDK (fallback)');
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      console.log('[Admin Verify] Documento utente non trovato (client SDK)');
      return false;
    }
    
    const userData = userDocSnap.data();
    const isAdmin = userData?.role === 'admin';
    console.log('[Admin Verify] Ruolo utente:', userData?.role, '-> Admin:', isAdmin);
    return isAdmin;
  } catch (error: any) {
    console.error('[Admin Verify] Errore verifica admin:', error);
    console.error('[Admin Verify] Error code:', error.code);
    console.error('[Admin Verify] Error message:', error.message);
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
  if (!uid) return false;
  return await isAdmin(uid);
}

