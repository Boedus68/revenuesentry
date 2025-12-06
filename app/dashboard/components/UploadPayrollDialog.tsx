"use client";

import { useState } from 'react';
import { parsePayrollPDF, ParsedPayrollData } from '../../../lib/pdf-payroll-parser';
import { ImportedCost } from '../../../lib/xls-parser';

interface UploadPayrollDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (costs: ImportedCost[]) => void;
  selectedMonth: string;
}

export default function UploadPayrollDialog({
  isOpen,
  onClose,
  onImport,
  selectedMonth,
}: UploadPayrollDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [contributiINPS, setContributiINPS] = useState<string>('');

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Il file deve essere un PDF');
      return;
    }

    setFile(selectedFile);
    setError('');
    setLoading(true);
    setParsedData(null);

    try {
      const data = await parsePayrollPDF(selectedFile);
      
      if (data.entries.length === 0) {
        setError('Nessuna busta paga trovata nel PDF. Verifica che il file contenga buste paga valide.');
      } else {
        setParsedData(data);
      }
    } catch (err: any) {
      console.error('Errore parsing PDF:', err);
      setError(err.message || 'Errore durante l\'analisi del PDF. Assicurati che il file sia valido.');
      setParsedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!parsedData || parsedData.entries.length === 0) {
      setError('Nessun dato da importare');
      return;
    }

    if (!selectedMonth) {
      alert('Seleziona prima un mese nella sezione Costi prima di importare.');
      return;
    }

    // Crea ImportedCost per ogni busta paga
    const costs: ImportedCost[] = parsedData.entries.map((entry, index) => ({
      id: `payroll-${entry.nominativo}-${index}-${Date.now()}`,
      fornitore: entry.nominativo,
      importo: entry.importo,
      categoria: 'Personale - Buste Paga',
      data: entry.data || undefined,
      descrizione: `Busta paga ${entry.nominativo}${entry.data ? ` - ${entry.data}` : ''}`,
    }));

    // Aggiungi contributi INPS se inseriti
    const contributiINPSValue = parseFloat(contributiINPS.replace(',', '.')) || 0;
    if (contributiINPSValue > 0) {
      costs.push({
        id: `inps-${selectedMonth}-${Date.now()}`,
        fornitore: 'INPS',
        importo: contributiINPSValue,
        categoria: 'Personale - Contributi INPS',
        data: `${selectedMonth}-01`, // Primo giorno del mese
        descrizione: `Contributi INPS mensili - ${selectedMonth}`,
      });
    }

    onImport(costs);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setError('');
    setContributiINPS('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Carica Buste Paga PDF</h2>
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
                ⚠️ Seleziona prima un mese nella sezione Costi prima di importare.
              </p>
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Seleziona file PDF con buste paga
            </label>
            <input
              type="file"
              accept=".pdf"
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
                <span>Analisi PDF in corso...</span>
              </div>
            )}
          </div>

          {/* Contributi INPS */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contributi INPS mensili (opzionale)
            </label>
            <input
              type="number"
              step="0.01"
              value={contributiINPS}
              onChange={(e) => setContributiINPS(e.target.value)}
              placeholder="Importo contributi INPS €"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <p className="mt-1 text-xs text-gray-400">
              Inserisci l'importo totale dei contributi INPS pagati per questo mese
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Preview Buste Paga */}
          {parsedData && parsedData.entries.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {parsedData.entries.length} buste paga trovate
                  </h3>
                  {parsedData.duplicatesRemoved > 0 && (
                    <p className="text-sm text-yellow-400 mt-1">
                      ⚠️ {parsedData.duplicatesRemoved} duplicati rimossi
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Totale buste paga</div>
                  <div className="text-2xl font-bold text-green-400">
                    €{parsedData.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {parseFloat(contributiINPS) > 0 && (
                    <>
                      <div className="text-sm text-gray-400 mt-2">+ Contributi INPS</div>
                      <div className="text-lg font-semibold text-blue-400">
                        €{parseFloat(contributiINPS.replace(',', '.') || '0').toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Totale Personale</div>
                      <div className="text-xl font-bold text-white">
                        €{(parsedData.totalAmount + parseFloat(contributiINPS.replace(',', '.') || '0')).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Nominativo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Importo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {parsedData.entries.map((entry, index) => (
                        <tr key={index} className="hover:bg-gray-800/50 transition">
                          <td className="px-4 py-3 text-sm text-white">{entry.nominativo}</td>
                          <td className="px-4 py-3 text-sm text-right text-white font-semibold">
                            €{entry.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {entry.data || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
            disabled={!parsedData || parsedData.entries.length === 0 || !selectedMonth || loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
          >
            Importa {parsedData ? `${parsedData.entries.length} buste paga` : ''}
            {parseFloat(contributiINPS) > 0 ? ' + INPS' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
