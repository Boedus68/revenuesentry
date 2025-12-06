"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { RevenueData } from '../../../lib/types';

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
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  // Date di riferimento per il confronto prezzi
  const [checkinDate, setCheckinDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // Domani
    return date;
  });
  const [checkoutDate, setCheckoutDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2); // Dopodomani
    return date;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchHotelPrice();
  }, [user, checkinDate]);

  useEffect(() => {
    if (!user || currentPrice === null) return;

    fetchCompetitorData();
    
    // Refresh automatico ogni 6 ore
    const interval = setInterval(() => {
      fetchCompetitorData();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkinDate, checkoutDate, currentPrice]);

  const fetchHotelPrice = async () => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const revenues: RevenueData[] = userData.revenues || [];
        
        // Calcola il mese del check-in (formato YYYY-MM)
        const checkinMonth = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Cerca il prezzo per il mese del check-in
        let price: number | null = null;
        const monthRevenue = revenues.find(r => r.mese === checkinMonth);
        
        if (monthRevenue && monthRevenue.prezzoMedioCamera) {
          price = monthRevenue.prezzoMedioCamera;
        } else {
          // Se non c'è il prezzo per quel mese, usa il prezzo più recente disponibile
          const sortedRevenues = [...revenues]
            .filter(r => r.prezzoMedioCamera && r.prezzoMedioCamera > 0)
            .sort((a, b) => b.mese.localeCompare(a.mese));
          
          if (sortedRevenues.length > 0) {
            price = sortedRevenues[0].prezzoMedioCamera;
          }
        }
        
        setCurrentPrice(price);
      }
    } catch (err: any) {
      console.error('Errore recupero prezzo hotel:', err);
      // Se non riesce a recuperare, usa un valore di default
      setCurrentPrice(null);
    }
  };

  const fetchCompetitorData = async () => {
    if (!user || currentPrice === null) return;

    setLoading(true);
    setError(null);

    try {
      // Ottieni hotelId (usa UID come hotelId per ora)
      const hotelId = user.uid;
      
      // Recupera location dai dati hotel
      let location = 'Cattolica'; // Default
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.hotelData?.localita) {
            location = userData.hotelData.localita;
          }
        }
      } catch (err) {
        console.error('Errore recupero location:', err);
      }

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
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Monitoraggio Competitor
          </h2>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-gray-400">
                Aggiornato: {lastUpdate.toLocaleTimeString('it-IT')}
              </span>
            )}
            <button
              onClick={fetchCompetitorData}
              disabled={loading}
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Aggiorna dati competitor"
            >
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Periodo di riferimento */}
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-300 font-medium">Periodo di riferimento:</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Check-in:</label>
                <input
                  type="date"
                  value={checkinDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setCheckinDate(newDate);
                    // Aggiorna checkout se è prima del nuovo checkin
                    if (checkoutDate <= newDate) {
                      const newCheckout = new Date(newDate);
                      newCheckout.setDate(newCheckout.getDate() + 1);
                      setCheckoutDate(newCheckout);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400">Check-out:</label>
                <input
                  type="date"
                  value={checkoutDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    if (newDate > checkinDate) {
                      setCheckoutDate(newDate);
                    }
                  }}
                  min={checkinDate.toISOString().split('T')[0]}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500">
                ({Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))} notte/i)
              </div>
            </div>
          </div>
        </div>
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
            <div className="mt-4 space-y-3">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">
                  ⚠️ <strong>Nota:</strong> I prezzi mostrati sono per <strong>camera</strong> (confronto standardizzato).
                  Se un competitor usa "per persona", il sistema converte automaticamente moltiplicando per il numero di ospiti.
                </p>
                <p className="text-xs text-gray-400">
                  📅 <strong>Periodo:</strong> I prezzi si riferiscono al periodo <strong>{checkinDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong> - <strong>{checkoutDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong> ({Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24))} notte/i).
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Prezzo Medio</p>
                  <p className="text-lg font-bold text-white">€{stats.avgPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">per camera</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Prezzo Min</p>
                  <p className="text-lg font-bold text-green-400">€{stats.minPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">per camera</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Prezzo Max</p>
                  <p className="text-lg font-bold text-red-400">€{stats.maxPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">per camera</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Competitor</p>
                  <p className="text-lg font-bold text-white">{stats.count}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 && !loading && (
        <div className="text-center py-4">
          {currentPrice === null ? (
            <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-300 text-sm mb-2">
                ⚠️ <strong>Attenzione:</strong> Non è stato possibile recuperare il prezzo del tuo hotel per il periodo selezionato.
              </p>
              <p className="text-yellow-400 text-xs">
                Assicurati di aver inserito i dati dei ricavi per il mese di <strong>{checkinDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong> nella sezione "Ricavi".
              </p>
            </div>
          ) : (
            <p className="text-gray-400">Nessun dato competitor disponibile</p>
          )}
        </div>
      )}
      
      {currentPrice !== null && (
        <div className="mt-4 bg-blue-900/20 border border-blue-500 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            💰 <strong>Il tuo prezzo medio:</strong> €{currentPrice.toFixed(2)} per camera (basato sui dati del mese {checkinDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })})
          </p>
        </div>
      )}
    </div>
  );
}
