"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { ImportedCost } from '../../../lib/xls-parser';

interface FattureInCloudIntegrationProps {
  selectedMonth: string;
  onImport: (costs: ImportedCost[]) => void;
}

interface FICConfig {
  clientId?: string;
  accessToken?: string;
  companyId?: string;
  enabled: boolean;
}

export default function FattureInCloudIntegration({
  selectedMonth,
  onImport,
}: FattureInCloudIntegrationProps) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<FICConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchConfig();
      }
    });

    return () => unsubscribe();
  }, []);

  // Controlla se c'è un messaggio di successo/errore nell'URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ficSuccess = params.get('fic_success');
    const ficError = params.get('fic_error');

    if (ficSuccess && user) {
      setSuccess('Connessione a Fatture in Cloud completata con successo!');
      fetchConfig();
      // Rimuovi il parametro dall'URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (ficError) {
      const errorMsg = decodeURIComponent(ficError);
      let userFriendlyError = errorMsg;
      
      // Messaggi di errore più chiari per l'utente
      if (errorMsg.includes('access_denied') || errorMsg.includes('no app with the given client_id')) {
        userFriendlyError = 'Client ID non valido. Verifica di aver copiato correttamente il Client ID da Fatture in Cloud e che l\'applicazione sia stata creata correttamente.';
      } else if (errorMsg.includes('invalid_client')) {
        userFriendlyError = 'Credenziali non valide. Verifica Client ID e Client Secret.';
      } else if (errorMsg.includes('redirect_uri_mismatch')) {
        userFriendlyError = 'Redirect URI non corrispondente. Verifica che il Redirect URI configurato in Fatture in Cloud corrisponda esattamente a quello mostrato nelle istruzioni.';
      }
      
      setError(userFriendlyError);
      // Rimuovi il parametro dall'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  const fetchConfig = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/integrations/fattureincloud/config?userId=${user.uid}`);
      
      if (!response.ok) {
        throw new Error('Errore nel recupero configurazione');
      }

      const data = await response.json();
      console.log('[FIC] Config caricata:', data.config);
      setConfig(data.config || null);
      // Mostra setup solo se non c'è configurazione o se è disabilitata
      setShowSetup(!data.config || !data.config.enabled);
    } catch (err: any) {
      console.error('Errore fetch config:', err);
      setError(err.message);
      // Se c'è un errore, mostra il form di setup
      setConfig(null);
      setShowSetup(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOAuth = async () => {
    if (!user || !clientId || !clientSecret) {
      setError('Inserisci Client ID e Client Secret');
      return;
    }

    // Verifica che non ci siano spazi iniziali/finali
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();

    if (!trimmedClientId || !trimmedClientSecret) {
      setError('Client ID e Client Secret non possono essere vuoti');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[FIC] Salvataggio credenziali...', { 
        userId: user.uid, 
        clientIdLength: trimmedClientId.length,
        clientSecretLength: trimmedClientSecret.length 
      });

      // Salva temporaneamente le credenziali (verifica che il salvataggio sia completato)
      const saveResponse = await fetch('/api/integrations/fattureincloud/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          clientId: trimmedClientId,
          clientSecret: trimmedClientSecret,
          enabled: false, // Non abilitare ancora, solo salva credenziali
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nel salvataggio delle credenziali');
      }

      console.log('[FIC] Credenziali salvate, richiesta URL OAuth...');

      // Ottieni URL di autorizzazione (ora recupera le credenziali dal database)
      const authResponse = await fetch(
        `/api/integrations/fattureincloud/auth?userId=${user.uid}`
      );

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({}));
        console.error('[FIC] Errore risposta auth:', errorData);
        throw new Error(errorData.error || 'Errore nell\'avvio del flusso OAuth');
      }

      const authData = await authResponse.json();
      console.log('[FIC] URL OAuth ottenuto:', authData.authUrl?.substring(0, 100));
      
      // Reindirizza all'URL di autorizzazione
      window.location.href = authData.authUrl;

    } catch (err: any) {
      console.error('[FIC] Errore OAuth:', err);
      setError(err.message || 'Errore nell\'avvio del flusso OAuth');
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!user || !selectedMonth) {
      setError('Seleziona un mese prima di sincronizzare');
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      console.log('[FIC] Inizio sincronizzazione:', { userId: user.uid, month: selectedMonth });

      const response = await fetch('/api/integrations/fattureincloud/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          month: selectedMonth,
          includeExpenses: true,
          includeDocuments: true,
        }),
      });

      console.log('[FIC] Risposta HTTP:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[FIC] Errore risposta:', errorData);
        throw new Error(errorData.error || 'Errore nella sincronizzazione');
      }

      const data = await response.json();
      console.log('[FIC] Dati ricevuti:', { 
        success: data.success, 
        count: data.count, 
        costsLength: data.costs?.length,
        month: data.month,
        syncedAt: data.syncedAt 
      });
      
      if (data.costs && data.costs.length > 0) {
        console.log('[FIC] Importazione costi:', data.costs.length, 'costi');
        setSuccess(`Sincronizzati ${data.costs.length} costi da Fatture in Cloud`);
        // Passa i costi al componente padre per l'importazione
        onImport(data.costs);
      } else {
        // Mostra informazioni più dettagliate
        const message = data.count === 0 
          ? 'Nessun costo trovato per il mese selezionato in Fatture in Cloud. Verifica che ci siano spese o documenti ricevuti nel periodo.'
          : `Sincronizzazione completata ma nessun costo importato.`;
        setSuccess(message);
        console.log('[FIC] Nessun costo importato. Risposta completa:', data);
      }

    } catch (err: any) {
      console.error('[FIC] Errore sync:', err);
      setError(err.message || 'Errore nella sincronizzazione');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    if (!confirm('Sei sicuro di voler disconnettere Fatture in Cloud?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/integrations/fattureincloud/config?userId=${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore nella disconnessione');
      }

      setConfig(null);
      setShowSetup(true);
      setSuccess('Disconnessione completata');
    } catch (err: any) {
      console.error('Errore disconnect:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Fatture in Cloud</h3>
            <p className="text-sm text-gray-400">Importa costi automaticamente</p>
          </div>
        </div>
        {config?.enabled && (
          <span className="px-3 py-1 bg-green-900/30 text-green-300 text-xs rounded-full border border-green-700">
            Connesso
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
          <p className="text-sm text-green-300">{success}</p>
        </div>
      )}

      {/* Mostra form di setup solo se config è null (non ancora caricato) o se è esplicitamente disabilitato */}
      {loading ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">Caricamento configurazione...</p>
        </div>
      ) : !config || !config.enabled || showSetup ? (
        <div className="space-y-4">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-300 mb-4">
              Per utilizzare l'integrazione con Fatture in Cloud:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400 mb-4">
              <li>Vai su <a href="https://www.fattureincloud.it/app/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Fatture in Cloud</a></li>
              <li>Accedi al tuo account e vai in <strong>Impostazioni → API</strong></li>
              <li>Crea una nuova applicazione e ottieni <strong>Client ID</strong> e <strong>Client Secret</strong></li>
              <li>Imposta il <strong>Redirect URI</strong> come: <code className="bg-gray-800 px-1 rounded text-xs">{typeof window !== 'undefined' ? `${window.location.origin}/api/integrations/fattureincloud/callback` : '...'}</code></li>
              <li>Incolla le credenziali qui sotto e clicca "Connetti"</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Inserisci Client ID"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Inserisci Client Secret"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleStartOAuth}
              disabled={loading || !clientId || !clientSecret}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Caricamento...' : 'Connetti Fatture in Cloud'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Stato:</strong> Connesso a Fatture in Cloud
            </p>
            {config.companyId && (
              <p className="text-xs text-gray-400">
                Azienda ID: {config.companyId}
              </p>
            )}
          </div>

          {/* Mostra sempre il pulsante se selectedMonth è valido, altrimenti mostra il messaggio */}
          {selectedMonth && selectedMonth.trim() !== '' ? (
            <button
              onClick={() => {
                console.log('[FIC] Click su sincronizza, selectedMonth:', selectedMonth);
                handleSync();
              }}
              disabled={syncing}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sincronizzazione in corso...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizza costi per {selectedMonth}
                </>
              )}
            </button>
          ) : (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
              <p className="text-sm text-yellow-300">
                Seleziona un mese nella sezione Costi per sincronizzare
              </p>
            </div>
          )}

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Caricamento...' : 'Disconnetti'}
          </button>
        </div>
      )}
    </div>
  );
}
