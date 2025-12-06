"use client";

import { useState } from 'react';
import { ImportedCost } from '../../../lib/xls-parser';

interface ImportCostsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (costs: ImportedCost[]) => void;
  selectedMonth: string;
}

export default function ImportCostsDialog({
  isOpen,
  onClose,
  onImport,
  selectedMonth,
}: ImportCostsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importedCosts, setImportedCosts] = useState<ImportedCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const { parseXLSFile } = await import('../../../lib/xls-parser');
      const costs = await parseXLSFile(selectedFile);
      
      if (costs.length === 0) {
        setError('Nessun costo trovato nel file. Verifica che il file contenga dati validi.');
      } else {
        setImportedCosts(costs);
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'importazione del file');
      setImportedCosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (importedCosts.length > 0 && selectedMonth) {
      console.log('Conferma importazione:', importedCosts.length, 'costi');
      onImport(importedCosts);
      handleClose();
    } else {
      if (!selectedMonth) {
        alert('Seleziona prima un mese nella sezione Costi prima di importare.');
      }
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportedCosts([]);
    setError('');
    onClose();
  };

  const totalAmount = importedCosts.reduce((sum, cost) => {
    const importo = cost.importo != null && !isNaN(cost.importo) ? cost.importo : 0;
    return sum + importo;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Importa Costi da File Excel</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!selectedMonth && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-yellow-300">
                ⚠️ Seleziona prima un mese nella sezione Costi prima di importare il file.
              </p>
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Seleziona file Excel (.xls, .xlsx)
            </label>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              disabled={loading}
            />
            {loading && (
              <div className="mt-2 flex items-center gap-2 text-gray-400">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Caricamento e analisi file in corso...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Preview Costi Importati */}
          {importedCosts.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">
                  {importedCosts.length} costi trovati
                </h3>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Totale importato</div>
                  <div className="text-2xl font-bold text-green-400">
                    €{totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Fornitore
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Importo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Descrizione
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {importedCosts.map((cost, index) => (
                        <tr key={index} className="hover:bg-gray-800/50 transition">
                          <td className="px-4 py-3 text-sm text-white">{cost.fornitore}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
                              {cost.categoria}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-white font-semibold">
                            €{cost.importo != null && !isNaN(cost.importo)
                              ? cost.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '0,00'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={cost.descrizione}>
                            {cost.descrizione || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statistiche per categoria */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(
                  importedCosts.reduce((acc, cost) => {
                    if (cost.categoria) {
                      const importo = cost.importo != null && !isNaN(cost.importo) ? cost.importo : 0;
                      acc[cost.categoria] = (acc[cost.categoria] || 0) + importo;
                    }
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([categoria, totale]) => (
                  <div key={categoria} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">{categoria}</div>
                    <div className="text-lg font-bold text-white">
                      €{totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer con azioni */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 flex justify-end gap-4">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={importedCosts.length === 0 || !selectedMonth || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
          >
            Importa {importedCosts.length > 0 ? `${importedCosts.length} costi` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

