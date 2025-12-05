"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

interface CompetitorPrice {
  hotel_name: string;
  price: number;
  rating?: number;
  availability?: boolean;
}

interface CompetitorStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  count: number;
}

interface Alert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  competitorStats?: CompetitorStats;
  competitor?: string;
  competitorPrice?: number;
  yourPrice?: number;
}

export default function CompetitorAlerts() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorPrice[]>([]);
  const [stats, setStats] = useState<CompetitorStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchCompetitorData();
    
    // Refresh automatico ogni 6 ore
    const interval = setInterval(() => {
      fetchCompetitorData();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const fetchCompetitorData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Ottieni hotelId (usa UID come hotelId per ora)
      const hotelId = user.uid;
      
      // Ottieni location e prezzo corrente dal profilo (se disponibile)
      // Per ora usa valori di default
      const location = 'Cattolica'; // TODO: prendere da hotelData
      const currentPrice = 130; // TODO: prendere da dati hotel attuali

      const checkinDate = new Date();
      checkinDate.setDate(checkinDate.getDate() + 1); // Domani
      const checkoutDate = new Date(checkinDate);
      checkoutDate.setDate(checkoutDate.getDate() + 1); // Dopodomani

      const response = await fetch('/api/scraper/competitor-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location,
          checkinDate: checkinDate.toISOString(),
          checkoutDate: checkoutDate.toISOString(),
          hotelId,
          currentPrice,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nel fetch competitor prices');
      }

      const data = await response.json();
      setCompetitors(data.competitors || []);
      setStats(data.stats || null);
      setAlerts(data.alerts || []);
      setLastUpdate(new Date());

    } catch (err: any) {
      console.error('Errore fetch competitor data:', err);
      setError(err.message || 'Errore nel caricamento dati competitor');
    } finally {
      setLoading(false);
    }
  };

  if (loading && competitors.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error && competitors.length === 0) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold">Errore caricamento dati competitor</p>
        </div>
        <p className="text-red-300 text-sm mt-2">{error}</p>
        <button
          onClick={fetchCompetitorData}
          className="mt-4 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Monitoraggio Competitor
        </h2>
        {lastUpdate && (
          <span className="text-xs text-gray-400">
            Aggiornato: {lastUpdate.toLocaleTimeString('it-IT')}
          </span>
        )}
      </div>

      {/* Alert Section */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                alert.severity === 'high'
                  ? 'bg-red-500/10 border-red-500'
                  : alert.severity === 'medium'
                  ? 'bg-yellow-500/10 border-yellow-500'
                  : 'bg-blue-500/10 border-blue-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <svg
                  className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    alert.severity === 'high' ? 'text-red-400' : alert.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-white font-semibold">{alert.message}</p>
                  {alert.competitorStats && (
                    <p className="text-gray-300 text-sm mt-1">
                      Prezzo medio mercato: €{alert.competitorStats.avgPrice.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Competitor Table */}
      {competitors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Confronto Prezzi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-300 font-semibold">Hotel</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Rating</th>
                  <th className="text-center py-2 px-3 text-gray-300 font-semibold">Disponibilità</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor, idx) => {
                  const priceDiff = stats && stats.avgPrice > 0
                    ? ((competitor.price - stats.avgPrice) / stats.avgPrice) * 100
                    : 0;

                  return (
                    <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 px-3 text-white">{competitor.hotel_name}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-white font-semibold">€{competitor.price.toFixed(2)}</span>
                        {priceDiff !== 0 && (
                          <span className={`ml-2 text-xs ${priceDiff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300">
                        {competitor.rating ? (
                          <span className="flex items-center justify-end gap-1">
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {competitor.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {competitor.availability !== undefined ? (
                          <span className={`px-2 py-1 rounded text-xs ${
                            competitor.availability
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {competitor.availability ? 'Disponibile' : 'Esaurito'}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Statistics Summary */}
          {stats && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Prezzo Medio</p>
                <p className="text-lg font-bold text-white">€{stats.avgPrice.toFixed(2)}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Prezzo Min</p>
                <p className="text-lg font-bold text-green-400">€{stats.minPrice.toFixed(2)}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Prezzo Max</p>
                <p className="text-lg font-bold text-red-400">€{stats.maxPrice.toFixed(2)}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Competitor</p>
                <p className="text-lg font-bold text-white">{stats.count}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 && !loading && (
        <p className="text-gray-400 text-center py-4">Nessun dato competitor disponibile</p>
      )}
    </div>
  );
}
