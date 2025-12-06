"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

interface HistoricalDataEntry {
  date: string; // YYYY-MM-DD
  occupancy_rate: number; // 0-100
  adr: number; // Average Daily Rate
  total_revenue: number;
  total_costs?: number;
  guests?: number;
  rooms_sold?: number;
}

interface HistoricalDataInputProps {
  onDataSaved?: () => void;
}

export default function HistoricalDataInput({ onDataSaved }: HistoricalDataInputProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState<HistoricalDataEntry[]>([
    {
      date: new Date().toISOString().split('T')[0],
      occupancy_rate: 0,
      adr: 0,
      total_revenue: 0,
      total_costs: 0,
      guests: 0,
      rooms_sold: 0,
    },
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const addEntry = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const lastDate = entries.length > 0 
      ? new Date(entries[entries.length - 1].date)
      : yesterday;
    
    const newDate = new Date(lastDate);
    newDate.setDate(newDate.getDate() - 1);

    setEntries([
      ...entries,
      {
        date: newDate.toISOString().split('T')[0],
        occupancy_rate: 0,
        adr: 0,
        total_revenue: 0,
        total_costs: 0,
        guests: 0,
        rooms_sold: 0,
      },
    ]);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof HistoricalDataEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    
    // Calcola ADR automaticamente se abbiamo revenue e rooms_sold
    if (field === 'total_revenue' || field === 'rooms_sold') {
      const revenue = field === 'total_revenue' ? value : updated[index].total_revenue;
      const rooms = field === 'rooms_sold' ? value : updated[index].rooms_sold;
      if (revenue > 0 && rooms > 0) {
        updated[index].adr = revenue / rooms;
      }
    }
    
    // Calcola occupazione se abbiamo rooms_sold e camere totali
    // (assumiamo che l'utente inserisca le camere totali da qualche parte)
    
    setEntries(updated);
  };

  const handleSave = async () => {
    if (!user) {
      setError('Devi essere autenticato per salvare i dati');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Valida i dati
      const validEntries = entries.filter(e => {
        if (!e.date) return false;
        if (e.total_revenue <= 0 && e.adr <= 0) return false;
        return true;
      });

      if (validEntries.length === 0) {
        setError('Inserisci almeno un dato valido');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/ml/save-historical-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hotelId: user.uid,
          entries: validEntries,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel salvataggio');
      }

      setSuccess(true);
      setEntries([
        {
          date: new Date().toISOString().split('T')[0],
          occupancy_rate: 0,
          adr: 0,
          total_revenue: 0,
          total_costs: 0,
          guests: 0,
          rooms_sold: 0,
        },
      ]);

      if (onDataSaved) {
        onDataSaved();
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Errore nel salvataggio dei dati');
    } finally {
      setSaving(false);
    }
  };

  const importFromRevenues = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Recupera i dati revenue mensili
      const response = await fetch(`/api/ml/convert-revenues-to-historical?hotelId=${user.uid}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella conversione');
      }

      setSuccess(true);
      if (onDataSaved) {
        onDataSaved();
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Errore nella conversione dei dati');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">
          📊 Inserisci Dati Storici Giornalieri
        </h3>
        <button
          onClick={importFromRevenues}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Caricamento...' : '📥 Converti da Dati Mensili'}
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Inserisci i dati giornalieri per abilitare il Dynamic Pricing. Puoi inserire più giorni alla volta.
        <br />
        <strong>Suggerimento:</strong> Se hai già inserito dati mensili nella sezione Ricavi, clicca su "Converti da Dati Mensili" per generare automaticamente i dati giornalieri.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          Dati salvati con successo! Il Dynamic Pricing ora può generare raccomandazioni.
        </div>
      )}

      <div className="space-y-4 mb-4">
        {entries.map((entry, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-gray-700">Giorno {index + 1}</h4>
              {entries.length > 1 && (
                <button
                  onClick={() => removeEntry(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  ✕ Rimuovi
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={entry.date}
                  onChange={(e) => updateEntry(index, 'date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ricavi Totali (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.total_revenue || ''}
                  onChange={(e) => updateEntry(index, 'total_revenue', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Camere Vendute
                </label>
                <input
                  type="number"
                  value={entry.rooms_sold || ''}
                  onChange={(e) => updateEntry(index, 'rooms_sold', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ADR (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.adr || ''}
                  onChange={(e) => updateEntry(index, 'adr', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {entry.rooms_sold && entry.total_revenue
                    ? `Calcolato: €${(entry.total_revenue / entry.rooms_sold).toFixed(2)}`
                    : 'Prezzo medio per camera'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Occupazione (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={entry.occupancy_rate || ''}
                  onChange={(e) => updateEntry(index, 'occupancy_rate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ospiti Totali
                </label>
                <input
                  type="number"
                  value={entry.guests || ''}
                  onChange={(e) => updateEntry(index, 'guests', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costi Totali (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entry.total_costs || ''}
                  onChange={(e) => updateEntry(index, 'total_costs', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={addEntry}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          + Aggiungi Giorno
        </button>
        <button
          onClick={handleSave}
          disabled={saving || entries.length === 0}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Salvataggio...' : '💾 Salva Dati Storici'}
        </button>
      </div>
    </div>
  );
}
