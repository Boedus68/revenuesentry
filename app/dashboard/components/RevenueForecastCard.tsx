"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ForecastData {
  date: string;
  predictedRevenue: number;
  predictedOccupancy: number;
  confidence: number;
}

interface ForecastStats {
  totalRevenue30d: number;
  avgOccupancy: number;
  minRevenue: number;
  maxRevenue: number;
  confidenceInterval: {
    min: number;
    max: number;
  };
}

export default function RevenueForecastCard() {
  const [user, setUser] = useState<User | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [stats, setStats] = useState<ForecastStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchForecast();
  }, [user]);

  const fetchForecast = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const hotelId = user.uid;
      const response = await fetch(`/api/ml/forecast-revenue?hotelId=${hotelId}&daysAhead=30`);

      if (!response.ok) {
        throw new Error('Errore nel fetch forecast');
      }

      const data = await response.json();
      
      // Se c'è un errore nella risposta, gestiscilo
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      setForecast(data.forecast || []);
      
      // Verifica che stats abbia tutte le proprietà necessarie
      if (data.confidenceInterval && data.totalRevenue30d !== undefined) {
        setStats({
          totalRevenue30d: data.totalRevenue30d,
          avgOccupancy: data.avgOccupancy || 0,
          minRevenue: data.minRevenue || 0,
          maxRevenue: data.maxRevenue || 0,
          confidenceInterval: data.confidenceInterval,
        });
      } else {
        setStats(null);
      }

    } catch (err: any) {
      console.error('Errore fetch forecast:', err);
      setError(err.message || 'Errore nel caricamento previsioni');
    } finally {
      setLoading(false);
    }
  };

  // Prepara dati per grafico
  const chartData = forecast.map(f => ({
    date: new Date(f.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
    revenue: f.predictedRevenue,
    occupancy: f.predictedOccupancy,
    min: stats?.confidenceInterval?.min ?? f.predictedRevenue * 0.9,
    max: stats?.confidenceInterval?.max ?? f.predictedRevenue * 1.1,
  }));

  // Calcola trend (positivo/negativo)
  const trend = forecast.length > 1
    ? forecast[forecast.length - 1].predictedRevenue - forecast[0].predictedRevenue
    : 0;
  const isPositiveTrend = trend > 0;

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Previsione Revenue</h3>
        <p className="text-gray-400">
          {error || 'Nessun dato disponibile. Aggiungi dati storici per generare previsioni.'}
        </p>
        {error && (
          <button
            onClick={fetchForecast}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            Riprova
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Previsione Revenue (30 giorni)
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isPositiveTrend
            ? 'bg-green-500/20 text-green-300'
            : 'bg-red-500/20 text-red-300'
        }`}>
          {isPositiveTrend ? '↗ Trend positivo' : '↘ Trend negativo'}
        </span>
      </div>

      {/* KPI Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Revenue Previsto 30gg</p>
          <p className="text-2xl font-bold text-white">
            €{stats.totalRevenue30d.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {stats.confidenceInterval && (
            <p className="text-xs text-gray-500 mt-1">
              ±€{((stats.confidenceInterval.max - stats.confidenceInterval.min) / 2).toFixed(0)}
            </p>
          )}
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Occupancy Media</p>
          <p className="text-2xl font-bold text-white">{stats.avgOccupancy.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Range Revenue</p>
          <p className="text-sm text-white">
            €{stats.minRevenue.toFixed(0)} - €{stats.maxRevenue.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositiveTrend ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isPositiveTrend ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                yAxisId="revenue"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                label={{ value: 'Revenue (€)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <YAxis 
                yAxisId="occupancy"
                orientation="right"
                stroke="#60a5fa"
                tick={{ fill: '#60a5fa', fontSize: 12 }}
                label={{ value: 'Occupancy (%)', angle: 90, position: 'insideRight', fill: '#60a5fa' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke={isPositiveTrend ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill="url(#colorRevenue)"
                name="Revenue Previsto"
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="min"
                stroke="#6b7280"
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="transparent"
                name="Min (±10%)"
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="max"
                stroke="#6b7280"
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="transparent"
                name="Max (±10%)"
              />
              <Line
                yAxisId="occupancy"
                type="monotone"
                dataKey="occupancy"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                name="Occupancy (%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
