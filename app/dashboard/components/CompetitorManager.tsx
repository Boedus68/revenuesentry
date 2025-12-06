"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { CompetitorConfig } from '../../../lib/types';

export default function CompetitorManager() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    competitor_name: '',
    location: '',
    bookingUrl: '',
    bookingId: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    notes: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCompetitors();
    }
  }, [user]);

  const fetchCompetitors = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const hotelId = user.uid;
      const response = await fetch(`/api/competitors?hotelId=${hotelId}`);

      if (!response.ok) {
        throw new Error('Errore nel caricamento competitor');
      }

      const data = await response.json();
      setCompetitors(data.competitors || []);

    } catch (err: any) {
      console.error('Errore fetch competitors:', err);
      setError(err.message || 'Errore nel caricamento competitor');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingId(null);
    setFormData({
      competitor_name: '',
      location: '',
      bookingUrl: '',
      bookingId: '',
      priority: 'medium',
      notes: '',
    });
  };

  const handleEdit = (competitor: CompetitorConfig & { id?: string }) => {
    if (!competitor.id) return;
    
    setEditingId(competitor.id);
    setShowAddForm(true);
    setFormData({
      competitor_name: competitor.competitor_name,
      location: competitor.location,
      bookingUrl: competitor.bookingUrl || '',
      bookingId: competitor.bookingId || '',
      priority: competitor.priority,
      notes: competitor.notes || '',
    });
  };

  const handleSave = async () => {
    if (!user || !formData.competitor_name || !formData.location) {
      setError('Compila tutti i campi obbligatori');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const hotelId = user.uid;

      if (editingId) {
        // Update existing
        const response = await fetch(`/api/competitors/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competitor_name: formData.competitor_name,
            location: formData.location,
            bookingUrl: formData.bookingUrl || undefined,
            bookingId: formData.bookingId || undefined,
            priority: formData.priority,
            notes: formData.notes || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Errore nell\'aggiornamento');
        }
      } else {
        // Create new
        const response = await fetch('/api/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hotelId,
            competitor_name: formData.competitor_name,
            location: formData.location,
            bookingUrl: formData.bookingUrl || undefined,
            bookingId: formData.bookingId || undefined,
            priority: formData.priority,
            notes: formData.notes || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Errore nella creazione');
        }
      }

      setShowAddForm(false);
      setEditingId(null);
      fetchCompetitors();

    } catch (err: any) {
      console.error('Errore save competitor:', err);
      setError(err.message || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo competitor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/competitors/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore nell\'eliminazione');
      }

      fetchCompetitors();

    } catch (err: any) {
      console.error('Errore delete competitor:', err);
      setError(err.message || 'Errore nell\'eliminazione');
    }
  };

  const handleToggleActive = async (competitor: CompetitorConfig & { id?: string }) => {
    if (!competitor.id) return;

    try {
      const response = await fetch(`/api/competitors/${competitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !competitor.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore nell\'aggiornamento');
      }

      fetchCompetitors();

    } catch (err: any) {
      console.error('Errore toggle active:', err);
      setError(err.message || 'Errore nell\'aggiornamento');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-300 border-red-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-300 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500';
    }
  };

  if (loading && competitors.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Gestione Competitor
        </h2>
        <button
          onClick={handleAdd}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi Competitor
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-500 rounded-lg p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 bg-gray-900/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Modifica Competitor' : 'Nuovo Competitor'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome Hotel <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.competitor_name}
                onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Es: Hotel Riviera"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Località <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Es: Cattolica"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                URL Booking.com (opzionale)
              </label>
              <input
                type="url"
                value={formData.bookingUrl}
                onChange={(e) => setFormData({ ...formData, bookingUrl: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://www.booking.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                ID Booking.com (opzionale)
              </label>
              <input
                type="text"
                value={formData.bookingId}
                onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Es: 123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priorità
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Bassa</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Note (opzionale)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Note aggiuntive sul competitor..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {saving ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Aggiungi'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingId(null);
                setError(null);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Competitors List */}
      {competitors.length === 0 && !showAddForm ? (
        <div className="text-center py-8">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-400 mb-4">Nessun competitor configurato</p>
          <button
            onClick={handleAdd}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Aggiungi il primo competitor
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-3 text-gray-300 font-semibold">Nome</th>
                <th className="text-left py-3 px-3 text-gray-300 font-semibold">Località</th>
                <th className="text-center py-3 px-3 text-gray-300 font-semibold">Priorità</th>
                <th className="text-center py-3 px-3 text-gray-300 font-semibold">Stato</th>
                <th className="text-right py-3 px-3 text-gray-300 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((competitor: any) => (
                <tr key={competitor.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-3 text-white font-medium">{competitor.competitor_name}</td>
                  <td className="py-3 px-3 text-gray-300">{competitor.location}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(competitor.priority)}`}>
                      {competitor.priority === 'high' ? 'Alta' : competitor.priority === 'medium' ? 'Media' : 'Bassa'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      competitor.isActive
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {competitor.isActive ? 'Attivo' : 'Disattivato'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(competitor)}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
                        title={competitor.isActive ? 'Disattiva' : 'Attiva'}
                      >
                        {competitor.isActive ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(competitor)}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400 transition"
                        title="Modifica"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(competitor.id)}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition"
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {competitors.length > 0 && (
        <div className="mt-4 text-xs text-gray-400">
          <p>💡 <strong>Suggerimento:</strong> I competitor attivi vengono utilizzati automaticamente per il monitoraggio prezzi. Puoi disattivare temporaneamente un competitor senza eliminarlo.</p>
        </div>
      )}
    </div>
  );
}
