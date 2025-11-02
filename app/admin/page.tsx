"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface UserStats {
  id: string;
  hotelName: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
  hasRevenueData: boolean;
  hasCostsData: boolean;
  hasRecommendations: boolean;
  revenueDataCount: number;
  recommendationsCount: number;
  totalRevenue: number;
  totalCosts: number;
  rooms: number;
  hotelType: string;
}

interface SummaryStats {
  totalUsers: number;
  activeUsers: number;
  hotelsWithData: number;
  hotelsWithRecommendations: number;
  totalRevenue: number;
  totalCosts: number;
  avgRevenue: number;
  avgCosts: number;
  avgRooms: number;
  registrationsByMonth: Record<string, number>;
  registrationTrend?: number;
  kpi?: {
    avgRevPAR: number;
    avgADR: number;
    avgOccupancy: number;
    avgTrevPAR: number;
    avgGOP: number;
    avgGOPMargin: number;
    hotelsWithKPI: number;
  };
}

interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail?: string;
  action: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsFetched, setStatsFetched] = useState(false); // Flag per evitare fetch multipli
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'logs'>('dashboard');
  
  // Filtri e ricerca
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHotelType, setFilterHotelType] = useState<string>('all');
  const [filterHasData, setFilterHasData] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'hotelName' | 'totalRevenue'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const router = useRouter();
  const adminVerifiedRef = useRef<string | null>(null); // Ref per tracciare quale uid è stato verificato come admin

  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      
      // Se non c'è utente, reindirizza immediatamente
      if (!currentUser) {
        setLoading(false);
        setIsAdmin(false);
        adminVerifiedRef.current = null;
        router.replace('/login');
        return;
      }
      
      // Se l'utente è lo stesso e abbiamo già verificato che è admin, non rifare la verifica
      if (currentUser.uid === adminVerifiedRef.current && isAdmin) {
        console.log('[Admin Panel] Utente già verificato come admin, skip verifica');
        return;
      }
      
      setUser(currentUser);
      
      // Verifica se l'utente è admin
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!isMounted) return;
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const adminStatus = userData?.role === 'admin';
          
          console.log('[Admin Panel] Verifica admin:', {
            uid: currentUser.uid,
            role: userData?.role,
            adminStatus,
            email: userData?.email,
            timestamp: new Date().toISOString()
          });
          
          setIsAdmin(adminStatus);
          
          if (!adminStatus) {
            console.log('[Admin Panel] Utente non admin, reindirizzamento a dashboard');
            setLoading(false);
            adminVerifiedRef.current = null;
            // Reindirizza immediatamente ma usa replace per non aggiungere alla history
            router.replace('/dashboard');
            return;
          }
          
          // Se è admin, marca come verificato e mostra il pannello
          console.log('[Admin Panel] Utente admin verificato, mostra pannello');
          adminVerifiedRef.current = currentUser.uid; // Salva l'uid verificato
          setStatsFetched(false); // Reset per permettere il fetch
          setLoading(false);
        } else {
          setLoading(false);
          setIsAdmin(false);
          adminVerifiedRef.current = null;
          router.replace('/login');
          return;
        }
      } catch (error) {
        console.error('[Admin Panel] Errore verifica admin:', error);
        if (isMounted) {
          setLoading(false);
          setIsAdmin(false);
          adminVerifiedRef.current = null;
          router.replace('/login');
        }
        return;
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]); // Rimossi user?.uid e isAdmin dalle dipendenze per evitare loop

  useEffect(() => {
    // Solo se abbiamo verificato che è admin E non stiamo più caricando E non abbiamo già fatto il fetch
    if (user && isAdmin && !loading && !statsFetched) {
      console.log('[Admin Panel] Condizioni fetch soddisfatte, carico statistiche');
      setStatsFetched(true); // Imposta subito per evitare chiamate multiple
      fetchStats();
      fetchLogs();
    }
  }, [user, isAdmin, loading, statsFetched]);

  const fetchStats = async () => {
    if (!user?.uid) {
      console.warn('[Admin Panel] fetchStats: uid mancante');
      return;
    }
    
    // Verifica di nuovo che sia admin prima di fare la chiamata
    if (!isAdmin) {
      console.warn('[Admin Panel] fetchStats: Tentativo senza permessi admin');
      return;
    }
    
    console.log('[Admin Panel] fetchStats: Inizio fetch con uid:', user.uid);
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/admin/stats?uid=${user.uid}`);
      const data = await response.json();
      
      console.log('[Admin Panel] fetchStats: Response status:', response.status, 'ok:', response.ok);
      console.log('[Admin Panel] fetchStats: Response data:', data);
      
      if (response.ok) {
        console.log('[Admin Panel] fetchStats: Statistiche caricate con successo', data);
        if (data.summary && data.users) {
          setStats(data.summary);
          setUsers(data.users);
        } else {
          console.error('[Admin Panel] fetchStats: Dati incompleti:', data);
          throw new Error('Dati incompleti dalla risposta');
        }
      } else {
        console.error('[Admin Panel] fetchStats: Errore recupero statistiche:', data);
        const errorMsg = data.error || data.details || 'Errore sconosciuto';
        
        // Mostra errore all'utente
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          hotelsWithData: 0,
          hotelsWithRecommendations: 0,
          totalRevenue: 0,
          totalCosts: 0,
          avgRevenue: 0,
          avgCosts: 0,
          avgRooms: 0,
          registrationsByMonth: {},
        });
        setUsers([]);
        
        // Se 403, mostra messaggio specifico
        if (response.status === 403) {
          console.warn('[Admin Panel] fetchStats: Accesso negato (403). Verifica che il ruolo admin sia corretto in Firestore.');
          alert(`Errore: Accesso negato (403).\n\n${errorMsg}\n\nVerifica che:\n1. Il campo "role" nel tuo documento Firestore sia impostato su "admin"\n2. Le regole Firestore permettano agli admin di leggere i documenti`);
        } else if (response.status === 500) {
          console.error('[Admin Panel] fetchStats: Errore server (500):', data);
          alert(`Errore server: ${errorMsg}\n\nControlla la console del server per maggiori dettagli.`);
        } else {
          alert(`Errore nel caricamento delle statistiche (${response.status}): ${errorMsg}`);
        }
      }
    } catch (error: any) {
      console.error('[Admin Panel] fetchStats: Errore:', error);
      // Mostra errore all'utente
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        hotelsWithData: 0,
        hotelsWithRecommendations: 0,
        totalRevenue: 0,
        totalCosts: 0,
        avgRevenue: 0,
        avgCosts: 0,
        avgRooms: 0,
        registrationsByMonth: {},
      });
      setUsers([]);
      alert(`Errore nel caricamento delle statistiche: ${error.message || 'Errore sconosciuto'}\n\nControlla la console per maggiori dettagli.`);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchLogs = async () => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/admin/logs?uid=${user.uid}`);
      const data = await response.json();
      
      if (response.ok) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Errore recupero log:', error);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/admin/export?format=${format}&uid=${user.uid}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `revenuesentry-users-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Errore export:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  // Filtri utenti
  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    // Ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.hotelName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }

    // Filtro tipo hotel
    if (filterHotelType !== 'all') {
      filtered = filtered.filter(u => u.hotelType === filterHotelType);
    }

    // Filtro dati
    if (filterHasData !== 'all') {
      if (filterHasData === 'with') {
        filtered = filtered.filter(u => u.hasRevenueData || u.hasCostsData);
      } else if (filterHasData === 'without') {
        filtered = filtered.filter(u => !u.hasRevenueData && !u.hasCostsData);
      }
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'hotelName':
          comparison = a.hotelName.localeCompare(b.hotelName);
          break;
        case 'totalRevenue':
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case 'createdAt':
        default:
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [users, searchQuery, filterHotelType, filterHasData, sortBy, sortOrder]);

  // Dati per grafici
  const registrationChartData = useMemo(() => {
    if (!stats?.registrationsByMonth) return [];
    return Object.entries(stats.registrationsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [stats]);

  const hotelTypeData = useMemo(() => {
    const types: Record<string, number> = {};
    users.forEach(u => {
      const type = u.hotelType === 'N/A' ? 'Non specificato' : u.hotelType;
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [users]);

  // Mostra loading finché non abbiamo verificato lo stato
  if (loading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Verifica accesso...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Se non c'è utente o non è admin, mostra nulla (verrà reindirizzato)
  if (!user || !isAdmin) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Accesso negato. Reindirizzamento...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-gray-200">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Revenue<span className="text-blue-400">Sentry</span> - Admin Panel
              </h1>
              <p className="text-sm text-gray-400 mt-1">Pannello di controllo amministratore</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm"
              >
                📥 Export CSV
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {(['dashboard', 'users', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab === 'dashboard' && '📊 Dashboard'}
                {tab === 'users' && '👥 Utenti'}
                {tab === 'logs' && '📝 Log'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Pulsante Refresh */}
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Statistiche Generali</h2>
              <button
                onClick={fetchStats}
                disabled={loadingStats}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {loadingStats ? 'Caricamento...' : '🔄 Aggiorna'}
              </button>
            </div>

            {loadingStats ? (
              <div className="text-center py-12">
                <div className="text-gray-400">Caricamento statistiche...</div>
              </div>
            ) : stats ? (
              <>
                {/* Cards Statistiche */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="text-gray-400 text-sm mb-1">Utenti Totali</div>
                    <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
                    <div className="text-xs text-gray-500 mt-1">Registrati</div>
                    {stats.registrationTrend !== undefined && stats.registrationTrend !== 0 && (
                      <div className={`text-xs mt-1 ${stats.registrationTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.registrationTrend > 0 ? '↑' : '↓'} {Math.abs(stats.registrationTrend)} vs mese precedente
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="text-gray-400 text-sm mb-1">Utenti Attivi</div>
                    <div className="text-3xl font-bold text-green-400">{stats.activeUsers}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% del totale
                    </div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="text-gray-400 text-sm mb-1">Ricavi Totali</div>
                    <div className="text-3xl font-bold text-blue-400">
                      €{stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Media: €{stats.avgRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="text-gray-400 text-sm mb-1">Costi Totali</div>
                    <div className="text-3xl font-bold text-red-400">
                      €{stats.totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Media: €{stats.avgCosts.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* KPI Aggregati */}
                {stats.kpi && (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-bold text-white mb-4">KPI Medi Aggregati</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div>
                        <div className="text-gray-400 text-xs mb-1">RevPAR</div>
                        <div className="text-xl font-bold text-blue-400">€{stats.kpi.avgRevPAR.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">ADR</div>
                        <div className="text-xl font-bold text-green-400">€{stats.kpi.avgADR.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Occupazione</div>
                        <div className="text-xl font-bold text-yellow-400">{stats.kpi.avgOccupancy.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">TrevPAR</div>
                        <div className="text-xl font-bold text-purple-400">€{stats.kpi.avgTrevPAR.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">GOP</div>
                        <div className="text-xl font-bold text-orange-400">€{stats.kpi.avgGOP.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">GOP Margin</div>
                        <div className="text-xl font-bold text-pink-400">{stats.kpi.avgGOPMargin.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      Basato su {stats.kpi.hotelsWithKPI} hotel con KPI calcolati
                    </div>
                  </div>
                )}

                {/* Grafici */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Grafico Registrazioni */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Registrazioni nel Tempo</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={registrationChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} name="Nuovi Utenti" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Grafico Tipo Hotel */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Distribuzione Tipo Hotel</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={hotelTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name} ${((entry.percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {hotelTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Statistiche Dettagliate */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Utilizzo del Sistema</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Hotel con Dati Ricavi</span>
                        <span className="text-white font-semibold">{stats.hotelsWithData}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Hotel con Consigli AI</span>
                        <span className="text-white font-semibold">{stats.hotelsWithRecommendations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Camere Medie per Hotel</span>
                        <span className="text-white font-semibold">{Math.round(stats.avgRooms)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-red-400">Errore nel caricamento delle statistiche</div>
              </div>
            )}
          </>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filtri e Ricerca */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ricerca</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nome hotel o email..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Hotel</label>
                  <select
                    value={filterHotelType}
                    onChange={(e) => setFilterHotelType(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Tutti</option>
                    <option value="stagionale">Stagionale</option>
                    <option value="annuale">Annuale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Dati</label>
                  <select
                    value={filterHasData}
                    onChange={(e) => setFilterHasData(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="all">Tutti</option>
                    <option value="with">Con dati</option>
                    <option value="without">Senza dati</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ordina per</label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [by, order] = e.target.value.split('-');
                      setSortBy(by as any);
                      setSortOrder(order as any);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="createdAt-desc">Data registrazione (più recenti)</option>
                    <option value="createdAt-asc">Data registrazione (più vecchi)</option>
                    <option value="hotelName-asc">Nome hotel (A-Z)</option>
                    <option value="hotelName-desc">Nome hotel (Z-A)</option>
                    <option value="totalRevenue-desc">Ricavi (più alti)</option>
                    <option value="totalRevenue-asc">Ricavi (più bassi)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tabella Utenti */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">
                  Lista Utenti ({filteredUsers.length} di {users.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hotel</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Camere</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ricavi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Costi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dati</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Registrato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          Nessun utente trovato
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-700/50 transition">
                          <td className="px-4 py-3 text-sm text-white">{user.hotelName}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{user.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.hotelType === 'stagionale' 
                                ? 'bg-yellow-900/30 text-yellow-400' 
                                : 'bg-blue-900/30 text-blue-400'
                            }`}>
                              {user.hotelType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{user.rooms || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {user.totalRevenue > 0 ? `€${user.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {user.totalCosts > 0 ? `€${user.totalCosts.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              {user.hasRevenueData && (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">💰</span>
                              )}
                              {user.hasCostsData && (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">📊</span>
                              )}
                              {user.hasRecommendations && (
                                <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-xs">🤖</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">Log Azioni Admin</h3>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data/Ora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Azione</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Dettagli</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        Nessun log disponibile
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-700/50 transition">
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{log.action}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{log.adminEmail || log.adminUid.substring(0, 8)}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {log.details ? JSON.stringify(log.details).substring(0, 50) + '...' : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
