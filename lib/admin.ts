// Utilities per verifica e gestione admin

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Verifica se un utente è admin lato server
 */
export async function isAdmin(uid: string): Promise<boolean> {
  try {
    if (!uid) return false;
    
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      return false;
    }
    
    const userData = userDocSnap.data();
    return userData?.role === 'admin';
  } catch (error) {
    console.error('Errore verifica admin:', error);
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

