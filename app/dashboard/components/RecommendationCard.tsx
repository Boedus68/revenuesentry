"use client";

import { Recommendation } from '../../../lib/types';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAction?: (id: string) => void;
}

export default function RecommendationCard({ recommendation, onAction }: RecommendationCardProps) {
  const priorityColors = {
    critica: 'border-red-500 bg-red-500/10',
    alta: 'border-orange-500 bg-orange-500/10',
    media: 'border-yellow-500 bg-yellow-500/10',
    bassa: 'border-blue-500 bg-blue-500/10',
  };

  const difficultyColors = {
    facile: 'bg-green-500/20 text-green-300',
    media: 'bg-yellow-500/20 text-yellow-300',
    complessa: 'bg-red-500/20 text-red-300',
  };

  return (
    <div className={`bg-gray-800/50 border-2 rounded-2xl p-6 ${priorityColors[recommendation.priorita]}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${difficultyColors[recommendation.difficolta]}`}>
              {recommendation.difficolta}
            </span>
            <span className="text-xs text-gray-400 uppercase tracking-wide">{recommendation.categoria}</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{recommendation.titolo}</h3>
          <p className="text-gray-300 mb-4">{recommendation.descrizione}</p>
        </div>
        <div className="text-right ml-4">
          <div className="text-2xl font-bold text-green-400">€{recommendation.impattoStimato.toLocaleString('it-IT')}</div>
          <div className="text-xs text-gray-400">Risparmio stimato</div>
        </div>
      </div>

      {recommendation.evidenze && recommendation.evidenze.length > 0 && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
          <p className="text-xs font-semibold text-gray-400 mb-2">Evidenze:</p>
          <ul className="space-y-1">
            {recommendation.evidenze.map((evidenza, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                {evidenza}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-300 mb-2">Azioni raccomandate:</p>
        <ul className="space-y-2">
          {recommendation.azioni.map((azione, idx) => (
            <li key={idx} className="flex items-start text-sm text-gray-400">
              <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {azione}
            </li>
          ))}
        </ul>
      </div>

      {onAction && (
        <button
          onClick={() => onAction(recommendation.id)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg text-sm transition"
        >
          Marca come eseguita
        </button>
      )}
    </div>
  );
}

