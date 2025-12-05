"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

interface Anomaly {
  date: string;
  costPerGuest: number;
  avgCostPerGuest: number;
  deviation: number;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface Alert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  date: string;
  costPerGuest: number;
  suggestion: string;
}

export default function CostAnomaliesAlert() {
  const [user, setUser] = useState<User | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [avgCostPerGuest, setAvgCostPerGuest] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchAnomalies();
  }, [user]);

  const fetchAnomalies = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const hotelId = user.uid;
      const response = await fetch(`/api/analytics/cost-anomalies?hotelId=${hotelId}`);

      if (!response.ok) {
        throw new Error('Errore nel fetch anomalie costi');
      }

      const data = await response.json();
      setAnomalies(data.anomalies || []);
      setAlerts(data.alerts || []);
      setAvgCostPerGuest(data.avgCostPerGuest || 0);

    } catch (err: any) {
      console.error('Errore fetch anomalie:', err);
      setError(err.message || 'Errore nel caricamento anomalie costi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error && anomalies.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-2">Anomalie Costi</h3>
        <p className="text-gray-400 text-sm">{error}</p>
        <button
          onClick={fetchAnomalies}
          className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-white">Anomalie Costi</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Nessuna anomalia rilevata negli ultimi 30 giorni. Costo/guest medio: €{avgCostPerGuest.toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Anomalie Costi
        </h3>
        {avgCostPerGuest > 0 && (
          <span className="text-sm text-gray-400">
            Media: €{avgCostPerGuest.toFixed(2)}/guest
          </span>
        )}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {alerts.map((alert, idx) => {
          const anomaly = anomalies.find(a => a.date === alert.date);
          const isExpanded = expandedAnomaly === alert.date;

          return (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                alert.severity === 'high'
                  ? 'bg-red-500/10 border-red-500 hover:bg-red-500/20'
                  : alert.severity === 'medium'
                  ? 'bg-yellow-500/10 border-yellow-500 hover:bg-yellow-500/20'
                  : 'bg-blue-500/10 border-blue-500 hover:bg-blue-500/20'
              }`}
              onClick={() => setExpandedAnomaly(isExpanded ? null : alert.date)}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  alert.severity === 'high'
                    ? 'bg-red-500/20 text-red-400'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold mb-1">{alert.message}</p>
                  {isExpanded && anomaly && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-400">Costo/Guest</p>
                          <p className="text-lg font-bold text-white">€{anomaly.costPerGuest.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Media</p>
                          <p className="text-lg font-bold text-gray-300">€{anomaly.avgCostPerGuest.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Suggerimento:</p>
                        <p className="text-sm text-gray-300">{alert.suggestion}</p>
                      </div>
                    </div>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {anomalies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            Trovate {anomalies.length} anomalie negli ultimi 30 giorni. 
            Clicca su un alert per vedere i dettagli.
          </p>
        </div>
      )}
    </div>
  );
}
