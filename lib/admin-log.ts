// Sistema di logging per azioni admin

import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';

export interface AdminLog {
  id?: string;
  adminUid: string;
  adminEmail?: string;
  action: string;
  details?: Record<string, any>;
  targetUserUid?: string;
  targetUserEmail?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra un'azione admin
 */
export async function logAdminAction(
  adminUid: string,
  action: string,
  details?: {
    adminEmail?: string;
    targetUserUid?: string;
    targetUserEmail?: string;
    [key: string]: any;
  }
): Promise<void> {
  try {
    await addDoc(collection(db, 'adminLogs'), {
      adminUid,
      action,
      details: details || {},
      timestamp: new Date(),
      ...details,
    });
  } catch (error) {
    console.error('Errore registrazione log admin:', error);
    // Non bloccare l'operazione se il log fallisce
  }
}

/**
 * Recupera i log admin (ultimi N)
 */
export async function getAdminLogs(count: number = 100): Promise<AdminLog[]> {
  try {
    const logsRef = collection(db, 'adminLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(count));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as AdminLog));
  } catch (error) {
    console.error('Errore recupero log admin:', error);
    return [];
  }
}

/**
 * Recupera i log per un admin specifico
 */
export async function getAdminLogsForUser(adminUid: string, count: number = 50): Promise<AdminLog[]> {
  try {
    const logsRef = collection(db, 'adminLogs');
    const q = query(
      logsRef,
      where('adminUid', '==', adminUid),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as AdminLog));
  } catch (error) {
    console.error('Errore recupero log admin per utente:', error);
    return [];
  }
}

