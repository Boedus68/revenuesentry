"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { Insight } from '../../../lib/ai-agent/reasoning-engine';

interface InsightWithNL extends Insight {
  naturalLanguage?: any;
  formattedMessage?: string;
  briefNotification?: string;
}

export default function SentryAgent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightWithNL[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InsightWithNL | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchInsights();
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchInsights = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai-agent/insights?hotelId=${user.uid}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel recupero insights');
      }

      setInsights(data.insights || []);
      setLastGenerated(new Date(data.generatedAt || Date.now()));
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero insights AI');
      console.error('Errore fetch insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'opportunity':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'problem':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'risk':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'achievement':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'opportunity':
        return '💡';
      case 'problem':
        return '⚠️';
      case 'risk':
        return '🚨';
      case 'achievement':
        return '🎉';
      default:
        return '📊';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return 'text-red-600 font-bold';
      case 'short-term':
        return 'text-orange-600 font-semibold';
      case 'long-term':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 9) return 'bg-red-500';
    if (priority >= 7) return 'bg-orange-500';
    if (priority >= 5) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (error && insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">
          🤖 Sentry AI Agent
        </h3>
        <div className="text-red-600 text-sm mb-4">{error}</div>
        <button
          onClick={fetchInsights}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">
            🤖 Sentry AI Agent
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Analista AI autonomo per il tuo hotel
          </p>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Analisi...' : '🔄 Analizza'}
        </button>
      </div>

      {lastGenerated && (
        <div className="text-xs text-gray-500 mb-4">
          Ultima analisi: {lastGenerated.toLocaleString('it-IT')}
        </div>
      )}

      {loading && insights.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Sentry sta analizzando i tuoi dati...</p>
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Nessun insight disponibile. Clicca su "Analizza" per generare insights.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {insights.filter(i => i.category === 'problem').length}
              </div>
              <div className="text-xs text-red-700">Problemi</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {insights.filter(i => i.category === 'opportunity').length}
              </div>
              <div className="text-xs text-green-700">Opportunità</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">
                {insights.filter(i => i.category === 'risk').length}
              </div>
              <div className="text-xs text-orange-700">Rischi</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {insights.filter(i => i.category === 'achievement').length}
              </div>
              <div className="text-xs text-blue-700">Successi</div>
            </div>
          </div>

          {/* Insights List */}
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${getCategoryColor(insight.category)}`}
              onClick={() => setSelectedInsight(selectedInsight?.id === insight.id ? null : insight)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getCategoryIcon(insight.category)}</span>
                    <h4 className="text-lg font-bold">{insight.title}</h4>
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(insight.priority)}`} title={`Priorità: ${insight.priority}/10`}></div>
                  </div>
                  <p className="text-sm mb-2">{insight.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 rounded ${getUrgencyColor(insight.urgency)}`}>
                      {insight.urgency === 'immediate' ? '🚨 Immediata' : 
                       insight.urgency === 'short-term' ? '⏰ Breve termine' : 
                       '📅 Lungo termine'}
                    </span>
                    <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">
                      Confidenza: {(insight.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">
                      Priorità: {insight.priority}/10
                    </span>
                  </div>
                </div>
                <button className="ml-4 text-gray-600 hover:text-gray-800">
                  {selectedInsight?.id === insight.id ? '▼' : '▶'}
                </button>
              </div>

              {/* Expanded Details */}
              {selectedInsight?.id === insight.id && (
                <div className="mt-4 pt-4 border-t border-current/20">
                  {/* Reasoning */}
                  <div className="mb-4">
                    <h5 className="font-semibold mb-2">🔍 Analisi</h5>
                    <div className="text-sm space-y-2">
                      <div>
                        <strong>Osservazione:</strong> {insight.reasoning.observation}
                      </div>
                      <div>
                        <strong>Analisi:</strong> {insight.reasoning.analysis}
                      </div>
                      {insight.reasoning.causes.length > 0 && (
                        <div>
                          <strong>Possibili cause:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {insight.reasoning.causes.map((cause, idx) => (
                              <li key={idx}>{cause}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {insight.reasoning.consequences.length > 0 && (
                        <div>
                          <strong>Conseguenze se ignorato:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {insight.reasoning.consequences.map((consequence, idx) => (
                              <li key={idx}>{consequence}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mt-2 p-2 bg-white/50 rounded">
                        <strong>Ragionamento completo:</strong> {insight.reasoning.logic}
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {insight.recommendations.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-semibold mb-2">💡 Raccomandazioni</h5>
                      <div className="space-y-3">
                        {insight.recommendations.map((rec, idx) => (
                          <div key={idx} className="bg-white/50 rounded p-3">
                            <div className="font-semibold mb-1">
                              {idx + 1}. {rec.action}
                              {rec.effort === 'low' && ' 🟢'}
                              {rec.effort === 'medium' && ' 🟡'}
                              {rec.effort === 'high' && ' 🔴'}
                            </div>
                            <div className="text-sm space-y-1">
                              <div><strong>Perché:</strong> {rec.why}</div>
                              <div><strong>Come:</strong> {rec.how}</div>
                              <div><strong>Risultato atteso:</strong> {rec.expectedOutcome}</div>
                              <div><strong>Tempo impatto:</strong> {rec.timeToImpact}</div>
                              {rec.dependencies.length > 0 && (
                                <div><strong>Dipendenze:</strong> {rec.dependencies.join(', ')}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Impact */}
                  <div className="mb-4">
                    <h5 className="font-semibold mb-2">📊 Impatto Stimato</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {Math.abs(insight.impact.revenueChange) > 0.01 && (
                        <div className="bg-white/50 rounded p-2">
                          <div className="text-xs text-gray-600">Revenue</div>
                          <div className={`font-semibold ${insight.impact.revenueChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {insight.impact.revenueChange > 0 ? '+' : ''}€{insight.impact.revenueChange.toFixed(0)}
                          </div>
                        </div>
                      )}
                      {Math.abs(insight.impact.costChange) > 0.01 && (
                        <div className="bg-white/50 rounded p-2">
                          <div className="text-xs text-gray-600">Costi</div>
                          <div className={`font-semibold ${insight.impact.costChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {insight.impact.costChange > 0 ? '+' : ''}€{insight.impact.costChange.toFixed(0)}
                          </div>
                        </div>
                      )}
                      {Math.abs(insight.impact.profitChange) > 0.01 && (
                        <div className="bg-white/50 rounded p-2">
                          <div className="text-xs text-gray-600">Profitto</div>
                          <div className={`font-semibold ${insight.impact.profitChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {insight.impact.profitChange > 0 ? '+' : ''}€{insight.impact.profitChange.toFixed(0)}
                          </div>
                        </div>
                      )}
                      {Math.abs(insight.impact.occupancyChange) > 0.01 && (
                        <div className="bg-white/50 rounded p-2">
                          <div className="text-xs text-gray-600">Occupazione</div>
                          <div className={`font-semibold ${insight.impact.occupancyChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {insight.impact.occupancyChange > 0 ? '+' : ''}{insight.impact.occupancyChange.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      Timeframe: {insight.impact.timeframe} | Confidenza: {(insight.impact.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
