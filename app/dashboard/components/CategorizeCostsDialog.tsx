"use client";

import { useState, useEffect } from 'react';
import { ImportedCost } from '../../../lib/xls-parser';

interface CategorizeCostsDialogProps {
  costs: ImportedCost[];
  onCategorize: (costId: string, categoria: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const CATEGORIE_PREDEFINITE = [
  { value: 'Ristorazione', label: 'Ristorazione' },
  { value: 'Utenze - Energia', label: 'Utenze - Energia' },
  { value: 'Utenze - Gas', label: 'Utenze - Gas' },
  { value: 'Utenze - Acqua', label: 'Utenze - Acqua' },
  { value: 'Personale - Buste Paga', label: 'Personale - Buste Paga' },
  { value: 'Personale - Sicurezza', label: 'Personale - Sicurezza' },
  { value: 'Personale - Contributi INPS', label: 'Personale - Contributi INPS' },
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
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  
  // Carica categorie personalizzate da localStorage all'avvio
  useEffect(() => {
    const saved = localStorage.getItem('customCategories');
    if (saved) {
      try {
        setCustomCategories(JSON.parse(saved));
      } catch (e) {
        console.error('Errore nel caricamento categorie personalizzate:', e);
      }
    }
  }, []);
  
  // Salva categorie personalizzate quando cambiano
  useEffect(() => {
    if (customCategories.length > 0) {
      localStorage.setItem('customCategories', JSON.stringify(customCategories));
    }
  }, [customCategories]);
  
  // Combina categorie predefinite e personalizzate
  const allCategories = [...CATEGORIE_PREDEFINITE, ...customCategories.map(cat => ({ value: cat, label: cat }))];
  
  // Aggiungi nuova categoria personalizzata
  const handleAddCustomCategory = (costId?: string) => {
    const trimmed = newCategoryInput.trim();
    if (trimmed && !allCategories.find(c => c.value.toLowerCase() === trimmed.toLowerCase())) {
      const updatedCategories = [...customCategories, trimmed];
      setCustomCategories(updatedCategories);
      
      // Se è stata specificata per un costo, applica la categoria
      if (costId) {
        onCategorize(costId, trimmed);
      }
      
      setNewCategoryInput('');
      setShowNewCategoryInput(false);
    }
  };
  
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
          {/* Tabella con header */}
          <div className="mb-4 grid grid-cols-12 gap-4 px-4 pb-3 border-b-2 border-gray-600">
            <div className="col-span-3 text-sm font-bold text-gray-200 uppercase tracking-wide">Fornitore</div>
            <div className="col-span-2 text-sm font-bold text-gray-200 uppercase tracking-wide text-right">Importo</div>
            <div className="col-span-2 text-sm font-bold text-gray-200 uppercase tracking-wide">Descrizione</div>
            <div className="col-span-2 text-sm font-bold text-gray-200 uppercase tracking-wide">Categoria Attuale</div>
            <div className="col-span-3 text-sm font-bold text-gray-200 uppercase tracking-wide">Seleziona Categoria</div>
          </div>
          
          <div className="space-y-3">
            {costs.map((cost, index) => (
              <div
                key={cost.id}
                className={`bg-gray-700/50 border-2 rounded-lg p-4 transition ${
                  cost.categoria ? 'border-green-500/50 bg-green-500/5' : 'border-gray-600'
                }`}
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Fornitore - COLONNA PRINCIPALE E BEN VISIBILE */}
                  <div className="col-span-3">
                    <div className="font-bold text-white text-base mb-1" style={{ minHeight: '24px' }}>
                      {cost.fornitore && cost.fornitore.trim().length > 0 
                        ? cost.fornitore 
                        : <span className="text-red-400 italic">⚠️ Fornitore non disponibile</span>}
                    </div>
                    {cost.data && (
                      <div className="text-xs text-gray-400 mt-1">Data: {cost.data}</div>
                    )}
                    {cost.fornitore && cost.fornitore.trim().length > 0 && (
                      <div className="text-xs text-blue-400 mt-1">#{index + 1}</div>
                    )}
                  </div>
                  
                  {/* Importo */}
                  <div className="col-span-2 text-right">
                    <div className="text-white font-bold text-lg">
                      €{cost.importo != null && !isNaN(cost.importo) 
                        ? cost.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '0,00'}
                    </div>
                  </div>
                  
                  {/* Descrizione */}
                  <div className="col-span-2">
                    <div className="text-sm text-gray-400 break-words">
                      {cost.descrizione && cost.descrizione.trim().length > 0 ? cost.descrizione : '-'}
                    </div>
                  </div>
                  
                  {/* Categoria attuale */}
                  <div className="col-span-2">
                    {cost.categoria ? (
                      <span className="px-3 py-1.5 bg-green-500/20 text-green-300 text-sm rounded-lg inline-block font-semibold border border-green-500/30">
                        {cost.categoria}
                      </span>
                    ) : (
                      <span className="text-yellow-400 text-sm font-medium">Non categorizzato</span>
                    )}
                  </div>
                  
                  {/* Dropdown selezione categoria */}
                  <div className="col-span-3">
                    <div className="flex gap-2 items-center">
                      <select
                        value={cost.categoria || ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setShowNewCategoryInput(true);
                          } else {
                            onCategorize(cost.id, e.target.value);
                            setShowNewCategoryInput(false);
                            setNewCategoryInput('');
                          }
                        }}
                        className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      >
                        <option value="">Seleziona categoria...</option>
                        {allCategories.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                        <option value="__custom__">➕ Nuova Categoria Personalizzata</option>
                      </select>
                      {showNewCategoryInput && (
                        <div className="flex gap-2 items-center ml-2">
                          <input
                            type="text"
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddCustomCategory(cost.id);
                              }
                            }}
                            placeholder="Nome categoria..."
                            className="bg-gray-700 border-2 border-blue-500 rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddCustomCategory(cost.id)}
                            disabled={!newCategoryInput.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition"
                          >
                            Aggiungi
                          </button>
                          <button
                            onClick={() => {
                              setShowNewCategoryInput(false);
                              setNewCategoryInput('');
                            }}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Debug info se fornitore mancante */}
                {(!cost.fornitore || cost.fornitore.trim().length === 0) && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                    ⚠️ ATTENZIONE: Fornitore non trovato nella colonna H del file Excel. ID costo: {cost.id}
                  </div>
                )}
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

