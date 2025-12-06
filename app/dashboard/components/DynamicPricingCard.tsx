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
    if (confidence >= 0.7) return 'text-green-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.7) return 'Alta';
    if (confidence >= 0.4) return 'Media';
    return 'Bassa';
  };

  const getDemandLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">
          💰 Dynamic Pricing
        </h3>
        <div className="text-red-600 text-sm">{error}</div>
        <button
          onClick={fetchPriceRecommendation}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          💰 Dynamic Pricing
        </h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded text-sm"
        />
      </div>

      {loading && !recommendation ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Calcolo prezzo ottimale...</p>
        </div>
      ) : recommendation ? (
        <>
          {/* Prezzo corrente vs raccomandato */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Prezzo corrente:</span>
              <span className="text-lg font-semibold text-gray-800">
                €{recommendation.currentPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Prezzo raccomandato:</span>
              <span
                className={`text-xl font-bold ${
                  priceDiff > 0 ? 'text-green-600' : priceDiff < 0 ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                €{recommendation.recommendedPrice.toFixed(2)}
              </span>
            </div>
            {Math.abs(priceDiff) > 0.01 && (
              <div
                className={`text-sm font-semibold ${
                  priceDiff > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {priceDiff > 0 ? '↑' : '↓'} {Math.abs(parseFloat(priceDiffPercent))}%
              </div>
            )}
          </div>

          {/* Range prezzo */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Range consigliato:</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">
                Min: €{recommendation.minPrice.toFixed(2)}
              </span>
              <span className="text-gray-700">
                Max: €{recommendation.maxPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Confidence e fattori */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Confidenza:</span>
              <span className={`text-sm font-semibold ${getConfidenceColor(recommendation.confidence)}`}>
                {getConfidenceLabel(recommendation.confidence)} (
                {(recommendation.confidence * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Livello domanda:</span>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${getDemandLevelColor(
                  recommendation.factors.demandLevel
                )}`}
              >
                {getDemandLevelLabel(recommendation.factors.demandLevel)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Competitor medio:</span>
              <span className="text-sm font-semibold text-gray-800">
                €{recommendation.factors.competitorAvgPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Fattore stagionalità:</span>
              <span className="text-sm font-semibold text-gray-800">
                {(recommendation.factors.seasonalityFactor * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Trend occupazione:</span>
              <span
                className={`text-sm font-semibold ${
                  recommendation.factors.occupancyTrend === 'increasing'
                    ? 'text-green-600'
                    : recommendation.factors.occupancyTrend === 'decreasing'
                    ? 'text-red-600'
                    : 'text-gray-600'
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
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              📊 Analisi:
            </div>
            <p className="text-sm text-gray-600">{recommendation.reasoning}</p>
          </div>

          {/* Azioni */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyPrice}
              disabled={Math.abs(priceDiff) < 0.01}
              className={`flex-1 px-4 py-2 rounded font-semibold ${
                Math.abs(priceDiff) < 0.01
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Applica Prezzo
            </button>
            <button
              onClick={fetchPriceRecommendation}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              🔄 Aggiorna
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
