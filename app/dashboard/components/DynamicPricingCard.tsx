"use client";

import { useState, useEffect } from 'react';
import { PriceRecommendation } from '../../../lib/ml/pricing-model';

interface DynamicPricingCardProps {
  hotelId: string;
  currentPrice: number;
  onPriceUpdate?: (newPrice: number) => void;
}

export default function DynamicPricingCard({
  hotelId,
  currentPrice,
  onPriceUpdate,
}: DynamicPricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<PriceRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const fetchPriceRecommendation = async () => {
    if (!hotelId || !currentPrice || currentPrice <= 0) {
      setError('Prezzo corrente non valido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        hotelId,
        currentPrice: currentPrice.toString(),
        date: selectedDate,
      });

      const response = await fetch(`/api/ml/predict-price?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel recupero raccomandazione');
      }

      setRecommendation(data.recommendation);
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero raccomandazione prezzo');
      console.error('Errore fetch price recommendation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId && currentPrice > 0) {
      fetchPriceRecommendation();
    }
  }, [hotelId, currentPrice, selectedDate]);

  const handleApplyPrice = () => {
    if (recommendation && onPriceUpdate) {
      onPriceUpdate(recommendation.recommendedPrice);
    }
  };

  const priceDiff = recommendation
    ? recommendation.recommendedPrice - recommendation.currentPrice
    : 0;
  const priceDiffPercent = recommendation && recommendation.currentPrice > 0
    ? ((priceDiff / recommendation.currentPrice) * 100).toFixed(1)
    : '0';

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-400';
    if (confidence >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.7) return 'Alta';
    if (confidence >= 0.4) return 'Media';
    return 'Bassa';
  };

  const getDemandLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-500/20 text-green-300 border border-green-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50';
      case 'low':
        return 'bg-red-500/20 text-red-300 border border-red-500/50';
      default:
        return 'bg-gray-700/50 text-gray-300 border border-gray-600';
    }
  };

  const getDemandLevelLabel = (level: string) => {
    switch (level) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Bassa';
      default:
        return 'Sconosciuta';
    }
  };

  if (error && !recommendation) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4 text-white">
          💰 Dynamic Pricing
        </h3>
        <div className="text-red-400 text-sm">{error}</div>
        <button
          onClick={fetchPriceRecommendation}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">
          💰 Dynamic Pricing
        </h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && !recommendation ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-400">Calcolo prezzo ottimale...</p>
        </div>
      ) : recommendation ? (
        <>
          {/* Prezzo corrente vs raccomandato */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Prezzo corrente:</span>
              <span className="text-lg font-semibold text-white">
                €{recommendation.currentPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Prezzo raccomandato:</span>
              <span
                className={`text-xl font-bold ${
                  priceDiff > 0 ? 'text-green-400' : priceDiff < 0 ? 'text-red-400' : 'text-white'
                }`}
              >
                €{recommendation.recommendedPrice.toFixed(2)}
              </span>
            </div>
            {Math.abs(priceDiff) > 0.01 && (
              <div
                className={`text-sm font-semibold ${
                  priceDiff > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceDiff > 0 ? '↑' : '↓'} {Math.abs(parseFloat(priceDiffPercent))}%
              </div>
            )}
          </div>

          {/* Range prezzo */}
          <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Range consigliato:</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">
                Min: €{recommendation.minPrice.toFixed(2)}
              </span>
              <span className="text-gray-300">
                Max: €{recommendation.maxPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Confidence e fattori */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Confidenza:</span>
              <span className={`text-sm font-semibold ${getConfidenceColor(recommendation.confidence)}`}>
                {getConfidenceLabel(recommendation.confidence)} (
                {(recommendation.confidence * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Livello domanda:</span>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${getDemandLevelColor(
                  recommendation.factors.demandLevel
                )}`}
              >
                {getDemandLevelLabel(recommendation.factors.demandLevel)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Competitor medio:</span>
              <span className="text-sm font-semibold text-white">
                €{recommendation.factors.competitorAvgPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Fattore stagionalità:</span>
              <span className="text-sm font-semibold text-white">
                {(recommendation.factors.seasonalityFactor * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Trend occupazione:</span>
              <span
                className={`text-sm font-semibold ${
                  recommendation.factors.occupancyTrend === 'increasing'
                    ? 'text-green-400'
                    : recommendation.factors.occupancyTrend === 'decreasing'
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {recommendation.factors.occupancyTrend === 'increasing'
                  ? '↑ In aumento'
                  : recommendation.factors.occupancyTrend === 'decreasing'
                  ? '↓ In calo'
                  : '→ Stabile'}
              </span>
            </div>
          </div>

          {/* Reasoning */}
          <div className="mb-6 p-4 bg-blue-500/20 rounded-lg border border-blue-500/50">
            <div className="text-sm font-semibold text-blue-300 mb-2">
              📊 Analisi:
            </div>
            <p className="text-sm text-gray-300">{recommendation.reasoning}</p>
          </div>

          {/* Azioni */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyPrice}
              disabled={Math.abs(priceDiff) < 0.01}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold ${
                Math.abs(priceDiff) < 0.01
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Applica Prezzo
            </button>
            <button
              onClick={fetchPriceRecommendation}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600"
            >
              🔄 Aggiorna
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
