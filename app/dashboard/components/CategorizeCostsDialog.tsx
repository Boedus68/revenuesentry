"use client";

import { ImportedCost } from '../../../lib/xls-parser';

interface CategorizeCostsDialogProps {
  costs: ImportedCost[];
  onCategorize: (costId: string, categoria: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const CATEGORIE = [
  { value: 'Ristorazione', label: 'Ristorazione' },
  { value: 'Utenze - Energia', label: 'Utenze - Energia' },
  { value: 'Utenze - Gas', label: 'Utenze - Gas' },
  { value: 'Utenze - Acqua', label: 'Utenze - Acqua' },
  { value: 'Personale - Buste Paga', label: 'Personale - Buste Paga' },
  { value: 'Personale - Sicurezza', label: 'Personale - Sicurezza' },
  { value: 'Manutenzione', label: 'Manutenzione' },
  { value: 'Pulizie', label: 'Pulizie' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Telefono/Internet', label: 'Telefono/Internet' },
  { value: 'Commercialista/Consulente', label: 'Commercialista/Consulente' },
  { value: 'Tasse', label: 'Tasse' },
  { value: 'Gestionale', label: 'Gestionale' },
  { value: 'Altri Costi', label: 'Altri Costi' },
];

export default function CategorizeCostsDialog({
  costs,
  onCategorize,
  onClose,
  onConfirm,
}: CategorizeCostsDialogProps) {
  if (costs.length === 0) return null;
  
  const totalCategorized = costs.filter(c => c.categoria).length;
  const totalUncategorized = costs.length - totalCategorized;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Categorizza Costi Importati</h2>
            <p className="text-gray-400 mt-1">
              {totalCategorized} / {costs.length} costi categorizzati
              {totalUncategorized > 0 && (
                <span className="text-yellow-400 ml-2">
                  ({totalUncategorized} da categorizzare)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {costs.map((cost) => (
              <div
                key={cost.id}
                className={`bg-gray-700/50 border rounded-lg p-4 transition ${
                  cost.categoria ? 'border-green-500/50' : 'border-gray-600'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">{cost.fornitore}</span>
                      {cost.categoria && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                          {cost.categoria}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      €{cost.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {cost.descrizione && ` - ${cost.descrizione}`}
                      {cost.data && ` - ${cost.data}`}
                    </div>
                  </div>
                  <select
                    value={cost.categoria || ''}
                    onChange={(e) => onCategorize(cost.id, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleziona categoria...</option>
                    {CATEGORIE.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-between items-center">
          <div className="text-gray-400">
            {totalUncategorized === 0 ? (
              <span className="text-green-400">✓ Tutti i costi sono stati categorizzati</span>
            ) : (
              <span className="text-yellow-400">
                ⚠️ Categorizza tutti i costi prima di salvare
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Annulla
            </button>
            <button
              onClick={onConfirm}
              disabled={totalUncategorized > 0}
              className={`px-6 py-2 rounded-lg transition ${
                totalUncategorized > 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              Salva Categorizzazioni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

