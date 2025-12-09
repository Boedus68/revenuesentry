"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { RevenueData } from '../../../lib/types';

type BoardType = 'room_only' | 'breakfast' | 'half_board' | 'full_board' | 'all_inclusive';

const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  room_only: 'Solo Camera',
  breakfast: 'B&B (Colazione)',
  half_board: 'Mezza Pensione',
  full_board: 'Pensione Completa',
  all_inclusive: 'All Inclusive'
};

interface CompetitorPrice {
  id: string;
  competitorId: string;
  competitorName: string;
  price: number | null;
  boardType: string;
  date: string;
  scrapedAt: string;
  isAvailable: boolean;
}

interface CompetitorStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  competitorsCount: number;
  availableCount: number;
  boardType: string;
  lastUpdated: string;
}

interface CompetitorConfig {
  id: string;
  competitor_name: string;
  bookingUrl?: string;
  boardType: BoardType;
  isActive: boolean;
}

export default function CompetitorAlerts() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorPrice[]>([]);
  const [competitorConfigs, setCompetitorConfigs] = useState<CompetitorConfig[]>([]);
  const [stats, setStats] = useState<CompetitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [selectedBoardType, setSelectedBoardType] = useState<BoardType>('breakfast');
  
  const [checkinDate, setCheckinDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  });
  const [checkoutDate, setCheckoutDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
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
    fetchCompetitorConfigs();
  }, [user, selectedBoardType]);

  useEffect(() => {
    if (!user || competitorConfigs.length === 0) return;
    fetchCompetitorData();
  }, [user, checkinDate, checkoutDate, selectedBoardType, competitorConfigs]);

  const fetchHotelPrice = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const revenues: RevenueData[] = userData.revenues || [];
        const checkinMonth = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}`;
        let price: number | null = null;
        const monthRevenue = revenues.find(r => r.mese === checkinMonth);
        if (monthRevenue && monthRevenue.prezzoMedioCamera) {
          price = monthRevenue.prezzoMedioCamera;
        } else {
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

  const fetchCompetitorConfigs = async () => {
    if (!user) return;
    try {
      const hotelId = user.uid;
      const response = await fetch(`/api/competitors?hotelId=${hotelId}`);
      if (!response.ok) throw new Error('Errore caricamento configurazioni competitor');
      const data = await response.json();
      const filtered = (data.competitors || []).filter((c: CompetitorConfig) => 
        c.isActive && c.boardType === selectedBoardType
      );
      console.log(`[CompetitorAlerts] Trovati ${filtered.length} competitors attivi per ${selectedBoardType}`);
      setCompetitorConfigs(filtered);
    } catch (err: any) {
      console.error('Errore fetch competitor configs:', err);
      setError(err.message);
    }
  };

  const scrapeCompetitorPrices = async () => {
    if (!user || competitorConfigs.length === 0) return;
    setScraping(true);
    const scrapedPrices: CompetitorPrice[] = [];

    for (const competitor of competitorConfigs) {
      if (!competitor.bookingUrl) {
        scrapedPrices.push({
          id: competitor.id,
          competitorId: competitor.id,
          competitorName: competitor.competitor_name,
          price: null,
          boardType: competitor.boardType,
          date: checkinDate.toISOString().split('T')[0],
          scrapedAt: new Date().toISOString(),
          isAvailable: false,
        });
        continue;
      }

      try {
        // Valida che checkout sia dopo checkin
        if (checkoutDate <= checkinDate) {
          console.warn(`[Scraping] ⚠️ ${competitor.competitor_name}: Date non valide (checkout <= checkin)`);
          scrapedPrices.push({
            id: competitor.id,
            competitorId: competitor.id,
            competitorName: competitor.competitor_name,
            price: null,
            boardType: competitor.boardType,
            date: checkinDate.toISOString().split('T')[0],
            scrapedAt: new Date().toISOString(),
            isAvailable: false,
          });
          continue;
        }

        console.log(`[Scraping] ${competitor.competitor_name}...`);
        const response = await fetch('/api/scraper/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingUrl: competitor.bookingUrl,
            checkInDate: checkinDate.toISOString().split('T')[0],
            checkOutDate: checkoutDate.toISOString().split('T')[0],
            boardType: competitor.boardType,
            adults: 2,
            children: 0,
          }),
        });

        const result = await response.json();

        if (result.success && result.price && result.price > 0) {
          scrapedPrices.push({
            id: competitor.id,
            competitorId: competitor.id,
            competitorName: competitor.competitor_name,
            price: result.price,
            boardType: result.boardType,
            date: checkinDate.toISOString().split('T')[0],
            scrapedAt: result.scrapedAt,
            isAvailable: true,
          });

          await fetch('/api/scraper/competitor-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              competitorId: competitor.id,
              competitorName: competitor.competitor_name,
              hotelId: user.uid,
              price: result.price,
              boardType: result.boardType,
              date: checkinDate.toISOString().split('T')[0],
              roomType: result.roomType,
              source: 'booking_scraper',
            }),
          });

          console.log(`[Scraping] ✅ ${competitor.competitor_name}: €${result.price}`);
        } else {
          console.log(`[Scraping] ⚠️ ${competitor.competitor_name}: Non disponibile`);
          scrapedPrices.push({
            id: competitor.id,
            competitorId: competitor.id,
            competitorName: competitor.competitor_name,
            price: null,
            boardType: competitor.boardType,
            date: checkinDate.toISOString().split('T')[0],
            scrapedAt: new Date().toISOString(),
            isAvailable: false,
          });
        }
      } catch (error: any) {
        console.error(`[Scraping] ❌ ${competitor.competitor_name}:`, error);
        scrapedPrices.push({
          id: competitor.id,
          competitorId: competitor.id,
          competitorName: competitor.competitor_name,
          price: null,
          boardType: competitor.boardType,
          date: checkinDate.toISOString().split('T')[0],
          scrapedAt: new Date().toISOString(),
          isAvailable: false,
        });
      }
    }

    setScraping(false);
    setCompetitors(scrapedPrices);
    calculateStats(scrapedPrices);
    setLastUpdate(new Date());
  };

  const fetchCompetitorData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const hotelId = user.uid;
      const token = await user.getIdToken();
      const url = new URL('/api/scraper/competitor-prices', window.location.origin);
      url.searchParams.set('hotelId', hotelId);
      url.searchParams.set('boardType', selectedBoardType);
      url.searchParams.set('date', checkinDate.toISOString().split('T')[0]);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Errore caricamento prezzi');
      const data = await response.json();
      
      if (data.prices && data.prices.length > 0) {
        const recentPrices = data.prices.filter((p: any) => {
          const scrapedDate = new Date(p.scrapedAt);
          const now = new Date();
          const hoursDiff = (now.getTime() - scrapedDate.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24;
        });

        if (recentPrices.length > 0) {
          console.log('[CompetitorAlerts] Uso prezzi recenti dal database');
          setCompetitors(recentPrices.map((p: any) => ({
            ...p,
            isAvailable: p.price !== null && p.price > 0,
          })));
          setStats(data.stats || null);
          setLastUpdate(new Date());
          setLoading(false);
          return;
        }
      }

      console.log('[CompetitorAlerts] Nessun dato recente, avvio scraping...');
      await scrapeCompetitorPrices();
    } catch (err: any) {
      console.error('[CompetitorAlerts] Errore:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (prices: CompetitorPrice[]) => {
    const availablePrices = prices.filter(p => p.isAvailable && p.price !== null);
    if (availablePrices.length === 0) {
      setStats(null);
      return;
    }
    const priceValues = availablePrices.map(p => p.price!);
    const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const sorted = [...priceValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    setStats({
      avgPrice: avg,
      minPrice: Math.min(...priceValues),
      maxPrice: Math.max(...priceValues),
      medianPrice: median,
      competitorsCount: prices.length,
      availableCount: availablePrices.length,
      boardType: selectedBoardType,
      lastUpdated: new Date().toISOString(),
    });
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
          onClick={scrapeCompetitorPrices}
          disabled={loading || scraping}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {scraping ? 'Aggiornamento...' : 'Aggiorna Prezzi'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Filtra per Tipo di Trattamento:
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BOARD_TYPE_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSelectedBoardType(value as BoardType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedBoardType === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

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

      {competitors.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            Prezzi Competitor ({BOARD_TYPE_LABELS[selectedBoardType]})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-300 font-semibold">Competitor</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo Camera Doppia</th>
                  <th className="text-right py-2 px-3 text-gray-300 font-semibold">Prezzo a Persona</th>
                  <th className="text-center py-2 px-3 text-gray-300 font-semibold">Disponibilità</th>
                </tr>
              </thead>
              <tbody>
                {[...competitors]
                  .sort((a, b) => {
                    // Ordina dal più alto al più basso
                    // Prima quelli disponibili, poi quelli non disponibili
                    if (a.isAvailable && !b.isAvailable) return -1;
                    if (!a.isAvailable && b.isAvailable) return 1;
                    // Se entrambi disponibili o entrambi non disponibili, ordina per prezzo
                    const priceA = a.isAvailable && a.price ? a.price : 0;
                    const priceB = b.isAvailable && b.price ? b.price : 0;
                    return priceB - priceA; // Dal più alto al più basso
                  })
                  .map((competitor, idx) => {
                    const pricePerPerson = competitor.isAvailable && competitor.price 
                      ? competitor.price / 2 
                      : null;
                    
                    return (
                      <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-3 text-white">{competitor.competitorName}</td>
                        <td className="py-2 px-3 text-right">
                          {competitor.isAvailable && competitor.price ? (
                            <span className="text-white font-semibold">€{competitor.price.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-500 italic">N/D</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {pricePerPerson !== null ? (
                            <span className="text-gray-300">€{pricePerPerson.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-500 italic">N/D</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {competitor.isAvailable ? (
                            <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">
                              Disponibile
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">
                              Non Disponibile
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {stats && (
            <div className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Prezzo Medio</p>
                  <p className="text-lg font-bold text-white">€{stats.avgPrice.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{stats.availableCount}/{stats.competitorsCount} disponibili</p>
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
          <p className="text-gray-400 mb-2">
            Nessun competitor per "{BOARD_TYPE_LABELS[selectedBoardType]}"
          </p>
          <button
            onClick={scrapeCompetitorPrices}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Cerca Prezzi
          </button>
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
