"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { RevenueData } from '../../../lib/types';

interface CompetitorPrice {
  competitorId: string;
  competitorName: string;
  price: number;
  date: string;
  scrapedAt: string;
  treatment?: string; // Trattamento (BB, HB, FB, solo pernottamento)
  price_unit?: 'per_camera' | 'per_persona' | 'per_camera_per_notte';
  guests?: number; // Numero ospiti per cui è valido il prezzo
  nights?: number; // Numero notti
}

interface CompetitorAlert {
  competitorName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  severity: 'high' | 'medium' | 'low';
  date: string;
}

interface CompetitorStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  competitorsCount: number;
  lastUpdated: string;
}

export default function CompetitorAlerts() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorPrice[]>([]);
  const [stats, setStats] = useState<CompetitorStats | null>(null);
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([]);
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
    if (!user) return;

    fetchCompetitorData();
    
    // Refresh automatico ogni 6 ore
    const interval = setInterval(() => {
      fetchCompetitorData();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkinDate, checkoutDate]);

  // Funzione helper per calcolare il prezzo a persona
  const calculatePricePerPerson = (competitor: CompetitorPrice): number => {
    const nights = competitor.nights || Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));
    const guests = competitor.guests || 2; // Default 2 ospiti
    
    if (competitor.price_unit === 'per_persona') {
      // Prezzo per persona per notte → moltiplica per le notti per ottenere il totale a persona
      return competitor.price * nights;
    } else if (competitor.price_unit === 'per_camera_per_notte') {
      // Prezzo per camera per notte → moltiplica per notti e dividi per ospiti
      return (competitor.price * nights) / guests;
    } else {
      // per_camera (totale per camera per tutto il soggiorno) → dividi per ospiti
      return competitor.price / guests;
    }
  };

  // Funzione helper per calcolare il prezzo netto (al netto della commissione del 15% di Booking)
  const calculateNetPricePerPerson = (competitor: CompetitorPrice): number => {
    const pricePerPerson = calculatePricePerPerson(competitor);
    // Prezzo netto = prezzo - 15% commissione Booking
    return pricePerPerson * 0.85;
  };

  // Funzione helper per formattare il trattamento
  const formatTreatment = (treatment?: string): string => {
    if (!treatment) return 'N/A';
    const treatmentMap: Record<string, string> = {
      'BB': 'B&B',
      'HB': 'Mezza Pensione',
      'FB': 'Pensione Completa',
      'solo pernottamento': 'Solo Pernottamento',
      'RO': 'Solo Pernottamento',
      'SC': 'Solo Pernottamento'
    };
    return treatmentMap[treatment.toUpperCase()] || treatment;
  };

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
      setCurrentPrice(null);
    }
  };

  const fetchCompetitorData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Ottieni hotelId (usa UID come hotelId)
      const hotelId = user.uid;
      
      // Ottieni il token di autenticazione
      const token = await user.getIdToken();
      
      // Formatta le date per la query string
      const checkinDateStr = checkinDate.toISOString().split('T')[0];
      const checkoutDateStr = checkoutDate.toISOString().split('T')[0];
      
      console.log('Fetching competitor prices for dates:', { checkinDate: checkinDateStr, checkoutDate: checkoutDateStr });
      
      // Usa GET invece di POST per leggere i dati, includendo le date
      const response = await fetch(`/api/scraper/competitor-prices?hotelId=${hotelId}&checkinDate=${checkinDateStr}&checkoutDate=${checkoutDateStr}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Errore nel fetch competitor prices');
      }

      const data = await response.json();
      
      console.log('Competitor data ricevuta:', data);
      
      setCompetitors(data.prices || []);
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
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-semibold">Errore Caricamento</h3>
        </div>
        <p className="text-gray-300 text-sm">{error}</p>
        <button
          onClick={fetchCompetitorData}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Monitoraggio Competitor</h2>
          </div>
          {lastUpdate && (
            <p className="text-xs text-gray-400">
              Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
            </p>
          )}
        </div>
        
        <button
          onClick={fetchCompetitorData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Aggiornamento...' : 'Aggiorna'}
        </button>
      </div>

      {/* Date Selection */}
      <div className="mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-300 mb-3">Seleziona date per confronto prezzi:</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Check-in:</label>
              <input
                type="date"
                value={checkinDate.toISOString().split('T')[0]}
                onChange={(e) => setCheckinDate(new Date(e.target.value))}
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
                  <p className="text-white font-semibold">
                    {alert.competitorName}: {alert.changePercent > 0 ? '+' : ''}{alert.changePercent.toFixed(1)}%
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    Da €{alert.oldPrice.toFixed(2)} a €{alert.newPrice.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Competitor Table */}
      {competitors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Prezzi Competitor</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-300 font-semibold">Competitor</th>
                  <th className="text-center py-2 px-3 text-gray-300 font-semibold">Trattamento</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo Totale</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo a Persona</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo Netto*</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor, idx) => {
                  const pricePerPerson = calculatePricePerPerson(competitor);
                  const netPricePerPerson = calculateNetPricePerPerson(competitor);
                  const nights = competitor.nights || Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));
                  const guests = competitor.guests || 2;
                  
                  // Calcola prezzo totale in base all'unità
                  let totalPrice = competitor.price;
                  if (competitor.price_unit === 'per_camera_per_notte') {
                    // Prezzo per camera per notte → moltiplica per le notti
                    totalPrice = competitor.price * nights;
                  } else if (competitor.price_unit === 'per_persona') {
                    // Prezzo per persona per notte → moltiplica per ospiti e notti
                    totalPrice = competitor.price * guests * nights;
                  }
                  // Se è 'per_camera', totalPrice è già corretto (è il totale per camera per tutto il soggiorno)
                  
                  return (
                    <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 px-3 text-white font-medium">{competitor.competitorName}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-gray-300 text-xs bg-gray-700/50 px-2 py-1 rounded">
                          {formatTreatment(competitor.treatment)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-white font-semibold">€{totalPrice.toFixed(2)}</span>
                        {competitor.price_unit === 'per_camera_per_notte' && (
                          <span className="text-gray-400 text-xs block">({nights} notte/i)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-white font-semibold">€{pricePerPerson.toFixed(2)}</span>
                        <span className="text-gray-400 text-xs block">a persona</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-green-400 font-semibold">€{netPricePerPerson.toFixed(2)}</span>
                        <span className="text-gray-400 text-xs block">a persona</span>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300 text-xs">
                        {new Date(competitor.date).toLocaleDateString('it-IT')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Disclaimer */}
          <div className="mt-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-3">
            <p className="text-xs text-yellow-300">
              <strong>⚠️ Disclaimer:</strong> I prezzi mostrati provengono da Booking.com e potrebbero variare rispetto al pricing diretto offerto dagli hotel. 
              Il prezzo netto* è calcolato al netto della commissione del 15% applicata da Booking.com.
            </p>
          </div>

          {/* Statistics Summary */}
          {stats && (
            <div className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <p className="text-lg font-bold text-white">{stats.competitorsCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {competitors.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-2">Nessun competitor configurato</p>
          <p className="text-gray-500 text-sm">Vai alla sezione "Competitors" per aggiungerne</p>
        </div>
      )}
      
      {currentPrice !== null && (
        <div className="mt-4 bg-blue-900/20 border border-blue-500 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            💰 <strong>Il tuo prezzo medio:</strong> €{currentPrice.toFixed(2)} per camera
          </p>
        </div>
      )}
    </div>
  );
}
