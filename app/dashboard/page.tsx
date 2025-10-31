"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { CostsData, RevenueData, HotelData, KPIData, Recommendation, CostAnalysis, MonthlyCostsData } from '../../lib/types';
import KPICard from './components/KPICard';
import RecommendationCard from './components/RecommendationCard';
import ImportCostsDialog from './components/ImportCostsDialog';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Helper per calcolare il totale costi di un mese
const calculateTotalCostsForMonth = (costs: Partial<CostsData>): number => {
    let totale = 0;
    if (costs.ristorazione) {
        totale += costs.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
    }
    if (costs.utenze) {
        totale += (costs.utenze.energia?.importo || 0) + (costs.utenze.gas?.importo || 0) + (costs.utenze.acqua?.importo || 0);
    }
    if (costs.personale) {
        totale += (costs.personale.bustePaga || 0) + (costs.personale.sicurezza || 0);
    }
    if (costs.altriCosti) {
        totale += Object.values(costs.altriCosti).reduce((sum, val) => sum + (val || 0), 0);
    }
    return totale;
};

export default function DashboardPage() {
const [user, setUser] = useState<User | null>(null);
const [hotelName, setHotelName] = useState('Caricamento...');
const [activeSection, setActiveSection] = useState('panoramica');
const [costs, setCosts] = useState<Partial<CostsData>>({});
const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCostsData[]>([]);
const [selectedMonth, setSelectedMonth] = useState<string>('');
const [revenues, setRevenues] = useState<RevenueData[]>([]);
const [hotelData, setHotelData] = useState<HotelData | null>(null);
const [kpi, setKpi] = useState<KPIData | null>(null);
const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
const [costAnalyses, setCostAnalyses] = useState<CostAnalysis[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [analyzing, setAnalyzing] = useState(false);
const [showToast, setShowToast] = useState(false);
const [toastMessage, setToastMessage] = useState('');
const [showImportDialog, setShowImportDialog] = useState(false);
const router = useRouter();

// Lista di altri costi per generare il form dinamicamente
const altriCostiFields = useMemo(() => [
    { id: 'pulizie', placeholder: 'Materiali Pulizie' },
    { id: 'manElettricista', placeholder: 'Manutenzione Elettricista' },
    { id: 'manIdraulico', placeholder: 'Manutenzione Idraulico' },
    { id: 'manCaldaia', placeholder: 'Manutenzione Caldaia/AC' },
    { id: 'manPiscina', placeholder: 'Manutenzione Piscina' },
    { id: 'attrezzatura', placeholder: 'Costo Attrezzatura' },
    { id: 'lavanderia', placeholder: 'Costo Lavanderia' },
    { id: 'commercialista', placeholder: 'Costo Commercialista' },
    { id: 'tari', placeholder: 'Costo TARI' },
    { id: 'gestionale', placeholder: 'Costo Gestionale PC' },
    { id: 'preventivi', placeholder: 'Costo Modulo Preventivi' },
    { id: 'marketing', placeholder: 'Costo Marketing' },
    { id: 'ppc', placeholder: 'Costo Campagne PPC' },
    { id: 'telefono', placeholder: 'Costo Bolletta Telefonica' },
    { id: 'ascensore', placeholder: 'Manutenzione Ascensore' },
    { id: 'parcheggio', placeholder: 'Costo Parcheggio Esterno' },
], []);

useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!isMounted) return;
        
        if (currentUser) {
            setUser(currentUser);
            try {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setHotelName(userData.hotelName || 'Mio Hotel');
                    
                    // Carica costi mensili (nuova struttura)
                    if (userData.monthlyCosts && Array.isArray(userData.monthlyCosts)) {
                        setMonthlyCosts(userData.monthlyCosts);
                        // Imposta il mese selezionato all'ultimo mese disponibile
                        if (userData.monthlyCosts.length > 0) {
                            const lastMonth = userData.monthlyCosts[userData.monthlyCosts.length - 1].mese;
                            setSelectedMonth(lastMonth);
                            setCosts(userData.monthlyCosts[userData.monthlyCosts.length - 1].costs);
                        }
                    } else if (userData.costs) {
                        // Migrazione: converte i costi vecchi in formato mensile
                        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                        const migratedCosts: MonthlyCostsData[] = [{
                            mese: currentMonth,
                            costs: userData.costs
                        }];
                        setMonthlyCosts(migratedCosts);
                        setSelectedMonth(currentMonth);
                        setCosts(userData.costs);
                    }
                    
                    if (userData.revenues) {
                        setRevenues(userData.revenues);
                    }
                    if (userData.hotelData) {
                        setHotelData(userData.hotelData);
                    }
                    
                    // Calcola KPI e raccomandazioni
                    const allCosts = userData.monthlyCosts || userData.costs;
                    await calculateAnalytics(allCosts, userData.revenues, userData.hotelData);
                } else {
                    setHotelName('Mio Hotel');
                }
            } catch (error) {
                console.error("Errore nel caricamento dati utente:", error);
                setHotelName('Mio Hotel');
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
            router.push('/login');
        }
    });

    return () => {
        isMounted = false;
        unsubscribe();
    };
}, [router]);

// Funzione per calcolare analytics
const calculateAnalytics = async (
    currentCosts?: Partial<CostsData> | MonthlyCostsData[],
    currentRevenues?: RevenueData[],
    currentHotelData?: HotelData
) => {
    // Se non ci sono né costi né ricavi, non calcolare
    const hasCosts = Array.isArray(currentCosts) ? currentCosts.length > 0 : (currentCosts && Object.keys(currentCosts).length > 0);
    if ((!hasCosts && !currentRevenues) || (currentRevenues && currentRevenues.length === 0 && !hasCosts)) {
        return;
    }

    setAnalyzing(true);
    try {
        const response = await fetch('/api/analytics/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                costs: currentCosts,
                revenues: currentRevenues,
                hotelData: currentHotelData,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            setKpi(data.kpi);
            setRecommendations(data.recommendations || []);
            setCostAnalyses(data.analyses || []);
            setAlerts(data.alerts || []);
        }
    } catch (error) {
        console.error('Errore nel calcolo analytics:', error);
    } finally {
        setAnalyzing(false);
    }
};

const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
};

const handleInputChange = (category: string, subCategory: string, field: string, value: string | number) => {
     const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;

    if (category === 'personale') {
         setCosts(prev => ({
            ...prev,
            personale: {
                ...prev.personale,
                [subCategory]: numValue
            } as CostsData['personale']
        }));
    } else { // utenze
        setCosts(prev => ({
            ...prev,
            [category]: {
                ...(prev as any)[category],
                [subCategory]: {
                    ...(prev as any)[category]?.[subCategory],
                    [field]: field === 'importo' ? numValue : value
                }
            }
        }));
    }
};

const handleRistorazioneChange = (index: number, field: 'fornitore' | 'importo', value: string | number) => {
    const updatedRistorazione = [...(costs.ristorazione || Array(20).fill({fornitore: '', importo: 0}))];
    
    if (!updatedRistorazione[index]) {
        updatedRistorazione[index] = { fornitore: '', importo: 0 };
    }

    const parsedValue = field === 'importo' ? parseFloat(value as string) || 0 : value;
    (updatedRistorazione[index] as any)[field] = parsedValue;
    
    setCosts(prev => ({ ...prev, ristorazione: updatedRistorazione }));
};

const handleAltriCostiChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCosts(prev => ({
        ...prev,
        altriCosti: {
            ...prev.altriCosti,
            [id]: numValue
        }
    }));
};

const handleSaveCosts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedMonth) {
        setToastMessage('Seleziona un mese prima di salvare i costi.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    setSaving(true);
    
    const cleanedCosts = JSON.parse(JSON.stringify(costs));
    if (cleanedCosts.ristorazione) {
        cleanedCosts.ristorazione = cleanedCosts.ristorazione.filter(
            (item: any) => item && (item.fornitore || (item.importo && item.importo > 0))
        );
    }

    try {
        const userDocRef = doc(db, "users", user.uid);
        
        // Verifica che il documento esista, altrimenti crealo
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
                hotelName: hotelName || 'Mio Hotel',
                monthlyCosts: []
            });
        }
        
        // Aggiorna o aggiungi i costi per il mese selezionato
        const updatedMonthlyCosts = [...monthlyCosts];
        const existingIndex = updatedMonthlyCosts.findIndex(mc => mc.mese === selectedMonth);
        
        const monthlyCostEntry: MonthlyCostsData = {
            mese: selectedMonth,
            costs: cleanedCosts
        };
        
        if (existingIndex >= 0) {
            updatedMonthlyCosts[existingIndex] = monthlyCostEntry;
        } else {
            updatedMonthlyCosts.push(monthlyCostEntry);
        }
        
        // Ordina per mese
        updatedMonthlyCosts.sort((a, b) => a.mese.localeCompare(b.mese));
        
        await setDoc(userDocRef, { monthlyCosts: updatedMonthlyCosts }, { merge: true });
        setMonthlyCosts(updatedMonthlyCosts);
        setCosts(cleanedCosts);
        
        // Ricalcola analytics con tutti i costi mensili
        await calculateAnalytics(updatedMonthlyCosts, revenues, hotelData || undefined);
        
        setToastMessage('Dati costi salvati con successo!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
        console.error("Errore nel salvataggio dei costi:", error);
        setToastMessage("Si è verificato un errore durante il salvataggio.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } finally {
        setSaving(false);
    }
};

// Gestione importazione costi da Excel
const handleImportCosts = async (importedCosts: any[]) => {
    if (!selectedMonth || importedCosts.length === 0) {
        setToastMessage('Seleziona un mese o verifica che il file contenga dati validi.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    console.log('Importazione costi:', importedCosts.length, 'elementi');
    
    try {
        const { mapImportedCostsToCostsData } = await import('../../lib/xls-parser');
        const importedCostsData = mapImportedCostsToCostsData(importedCosts, selectedMonth);
        
        console.log('Costi mappati:', importedCostsData);
        
        // Merge con i costi esistenti (se presenti)
        const mergedCosts: Partial<CostsData> = {
            ristorazione: [
                ...(costs.ristorazione || []),
                ...(importedCostsData.ristorazione || [])
            ].filter(item => item && (item.fornitore || item.importo > 0)),
            utenze: {
                energia: {
                    fornitore: importedCostsData.utenze?.energia?.fornitore || costs.utenze?.energia?.fornitore || '',
                    importo: (costs.utenze?.energia?.importo || 0) + (importedCostsData.utenze?.energia?.importo || 0),
                },
                gas: {
                    fornitore: importedCostsData.utenze?.gas?.fornitore || costs.utenze?.gas?.fornitore || '',
                    importo: (costs.utenze?.gas?.importo || 0) + (importedCostsData.utenze?.gas?.importo || 0),
                },
                acqua: {
                    fornitore: importedCostsData.utenze?.acqua?.fornitore || costs.utenze?.acqua?.fornitore || '',
                    importo: (costs.utenze?.acqua?.importo || 0) + (importedCostsData.utenze?.acqua?.importo || 0),
                },
            },
            personale: {
                bustePaga: (costs.personale?.bustePaga || 0) + (importedCostsData.personale?.bustePaga || 0),
                sicurezza: (costs.personale?.sicurezza || 0) + (importedCostsData.personale?.sicurezza || 0),
            },
            altriCosti: {
                ...(costs.altriCosti || {}),
            },
        };
        
        // Somma i valori duplicati in altriCosti
        if (importedCostsData.altriCosti) {
            Object.keys(importedCostsData.altriCosti).forEach(key => {
                const value = importedCostsData.altriCosti![key];
                if (value && value > 0) {
                    mergedCosts.altriCosti![key] = (mergedCosts.altriCosti![key] || 0) + value;
                }
            });
        }
        
        console.log('Costi finali dopo merge:', mergedCosts);
        console.log('Costi esistenti:', costs);
        
        // Assicurati che la struttura sia completa prima di impostare
        const finalCosts: Partial<CostsData> = {
            ...mergedCosts,
            // Forza struttura completa per ristorazione
            ristorazione: mergedCosts.ristorazione || [],
            // Forza struttura completa per utenze
            utenze: {
                energia: mergedCosts.utenze?.energia || { fornitore: '', importo: 0 },
                gas: mergedCosts.utenze?.gas || { fornitore: '', importo: 0 },
                acqua: mergedCosts.utenze?.acqua || { fornitore: '', importo: 0 },
            },
            // Forza struttura completa per personale
            personale: {
                bustePaga: mergedCosts.personale?.bustePaga || 0,
                sicurezza: mergedCosts.personale?.sicurezza || 0,
            },
            // Forza struttura completa per altriCosti
            altriCosti: mergedCosts.altriCosti || {},
        };
        
        console.log('Costi finali da impostare:', finalCosts);
        console.log('Numero ristorazione items:', finalCosts.ristorazione?.length);
        console.log('Utenze energia:', finalCosts.utenze?.energia);
        console.log('Personale:', finalCosts.personale);
        console.log('Altri costi:', finalCosts.altriCosti);
        
        // Forza update completo dello stato
        // Prima resetta per forzare re-render
        setCosts({});
        
        // Poi imposta i nuovi valori con un piccolo delay
        setTimeout(() => {
            setCosts(finalCosts);
            console.log('Stato costi impostato:', finalCosts);
        }, 50);
        
        // Verifica che lo stato sia stato aggiornato
        setTimeout(() => {
            setCosts(current => {
                console.log('Verifica stato finale:', current);
                // Se lo stato è vuoto o non aggiornato, forza l'aggiornamento
                if (!current || Object.keys(current).length === 0 || 
                    (finalCosts.ristorazione && finalCosts.ristorazione.length > 0 && 
                     (!current.ristorazione || current.ristorazione.length === 0))) {
                    console.log('Forzando aggiornamento stato...');
                    return finalCosts;
                }
                return current;
            });
        }, 150);
        
        // Scrolla alla sezione costi per mostrare i dati importati
        setTimeout(() => {
            const costiSection = document.querySelector('[data-section="costi"]');
            if (costiSection) {
                costiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 200);
        
        setToastMessage(`✅ Importati ${importedCosts.length} costi! Verifica i dati nel form e clicca "Salva Costi Mese" per completare.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    } catch (error: any) {
        console.error("Errore nell'importazione:", error);
        console.error("Stack:", error.stack);
        setToastMessage(`❌ Errore nell'importazione: ${error.message || error}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    }
};

// Gestione ricavi
const handleSaveRevenues = async (revenueData: RevenueData) => {
    if (!user) return;
    
    const updatedRevenues = [...revenues];
    const existingIndex = updatedRevenues.findIndex(r => r.mese === revenueData.mese);
    
    if (existingIndex >= 0) {
        updatedRevenues[existingIndex] = revenueData;
    } else {
        updatedRevenues.push(revenueData);
    }
    
    // Ordina per mese
    updatedRevenues.sort((a, b) => a.mese.localeCompare(b.mese));
    
    setSaving(true);
    try {
        const userDocRef = doc(db, "users", user.uid);
        
        // Verifica che il documento esista, altrimenti crealo
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
                hotelName: hotelName || 'Mio Hotel',
                revenues: []
            });
        }
        
        await setDoc(userDocRef, { revenues: updatedRevenues }, { merge: true });
        setRevenues(updatedRevenues);
        
        // Ricalcola analytics
        await calculateAnalytics(costs, updatedRevenues, hotelData || undefined);
        
        setToastMessage('Dati ricavi salvati con successo!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
        console.error("Errore nel salvataggio ricavi:", error);
        setToastMessage("Errore nel salvataggio ricavi.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } finally {
        setSaving(false);
    }
};

// Gestione dati hotel
const handleSaveHotelData = async (data: Partial<HotelData> | null) => {
    if (!user) return;
    
    // Valida e completa i dati
    const hotelDataToSave: HotelData = {
        hotelName: data?.hotelName || hotelName || 'Mio Hotel',
        camereTotali: data?.camereTotali || hotelData?.camereTotali || 0,
        stelle: data?.stelle !== undefined ? data.stelle : hotelData?.stelle,
        categoria: data?.categoria || hotelData?.categoria,
        localita: data?.localita || hotelData?.localita,
        annoInizio: data?.annoInizio || hotelData?.annoInizio,
    };
    
    // Non salvare se non ci sono almeno le informazioni essenziali
    if (!hotelDataToSave.camereTotali || hotelDataToSave.camereTotali <= 0) {
        setToastMessage('Inserisci il numero di camere prima di salvare.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    setSaving(true);
    try {
        const userDocRef = doc(db, "users", user.uid);
        
        // Verifica che il documento esista, altrimenti crealo con i dati base
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            // Crea il documento con i dati base
            await setDoc(userDocRef, {
                hotelName: hotelName || 'Mio Hotel',
                hotelData: {}
            });
        }
        
        // Pulisci i valori undefined prima di salvare
        const cleanData: any = {};
        Object.keys(hotelDataToSave).forEach(key => {
            const value = (hotelDataToSave as any)[key];
            if (value !== undefined && value !== null && value !== '') {
                cleanData[key] = value;
            }
        });
        
        await setDoc(userDocRef, { hotelData: cleanData }, { merge: true });
        setHotelData(hotelDataToSave);
        
        // Ricalcola analytics solo se abbiamo ricavi e costi
        if (revenues.length > 0 || Object.keys(costs).length > 0) {
            await calculateAnalytics(costs, revenues, hotelDataToSave);
        }
        
        setToastMessage('Dati hotel salvati con successo!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } catch (error: any) {
        console.error("Errore nel salvataggio dati hotel:", error);
        const errorMessage = error?.message || "Errore nel salvataggio dati hotel.";
        setToastMessage(`Errore: ${errorMessage}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } finally {
        setSaving(false);
    }
};


if (loading) {
    return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
            <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
    );
}

const NavLink = ({ id, text, icon }: { id: string, text: string, icon: JSX.Element }) => (
    <button
        onClick={() => setActiveSection(id)}
        className={`flex items-center w-full px-4 py-2 text-base font-semibold rounded-lg transition ${
            activeSection === id
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
        }`}
    >
        {icon}
        {text}
    </button>
);

return (
    <div className="h-screen flex text-gray-200">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800/50 border-r border-gray-700 flex-shrink-0 flex flex-col">
            <div className="h-16 flex items-center justify-center border-b border-gray-700">
                <Link href="/" className="text-2xl font-bold text-white">
                    Revenue<span className="text-blue-400">Sentry</span>
                </Link>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <NavLink id="panoramica" text="Panoramica" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
                <NavLink id="ricavi" text="Ricavi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <NavLink id="costi" text="Costi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zM15 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"/></svg>} />
                <NavLink id="raccomandazioni" text="Raccomandazioni IA" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>} />
                <NavLink id="report" text="Report" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>} />
            </nav>
            {alerts.length > 0 && (
                <div className="px-4 py-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-sm font-semibold">{alerts.length} Alert</span>
                    </div>
                </div>
            )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
            <header className="h-16 bg-gray-800/30 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
                <h1 className="text-xl font-semibold text-white">{hotelName}</h1>
                <button onClick={handleLogout} className="bg-red-600/80 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition">
                    Logout
                </button>
            </header>
            
            <div className="flex-1 p-8 overflow-y-auto">
                {activeSection === 'panoramica' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Panoramica Generale</h2>
                            {analyzing && (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Analisi in corso...</span>
                                </div>
                            )}
                        </div>

                        {kpi ? (
                            <>
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                    <KPICard
                                        title="RevPAR"
                                        value={`€${kpi.revpar.toFixed(2)}`}
                                        subtitle="Revenue Per Available Room"
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                        color="blue"
                                    />
                                    <KPICard
                                        title="GOP Margin"
                                        value={`${kpi.gopMargin.toFixed(1)}%`}
                                        subtitle={`GOP: €${kpi.gop.toLocaleString('it-IT')}`}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                                        color={kpi.gopMargin >= 25 ? 'green' : kpi.gopMargin >= 15 ? 'yellow' : 'red'}
                                    />
                                    <KPICard
                                        title="Occupazione"
                                        value={`${kpi.occupazione.toFixed(1)}%`}
                                        subtitle={`ADR: €${kpi.adr.toFixed(2)}`}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                                        color={kpi.occupazione >= 70 ? 'green' : kpi.occupazione >= 50 ? 'yellow' : 'red'}
                                    />
                                    <KPICard
                                        title="Totale Ricavi"
                                        value={`€${kpi.totaleRicavi.toLocaleString('it-IT')}`}
                                        subtitle={`Spese: €${kpi.totaleSpese.toLocaleString('it-IT')}`}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        color="purple"
                                    />
                                </div>

                                {/* Grafici */}
                                {revenues.length > 0 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                        {/* Grafico Ricavi/Spese nel tempo */}
                                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                            <h3 className="text-xl font-semibold text-white mb-4">Ricavi e Spese nel Tempo</h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={revenues.slice(-6).map(r => ({
                                                    mese: r.mese.slice(5),
                                                    ricavi: r.entrateTotali,
                                                    spese: kpi.totaleSpese,
                                                }))}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                    <XAxis dataKey="mese" stroke="#9CA3AF" />
                                                    <YAxis stroke="#9CA3AF" />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="ricavi" stroke="#3B82F6" strokeWidth={2} name="Ricavi" />
                                                    <Line type="monotone" dataKey="spese" stroke="#EF4444" strokeWidth={2} name="Spese" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Grafico Distribuzione Costi */}
                                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                            <h3 className="text-xl font-semibold text-white mb-4">Distribuzione Costi</h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Ristorazione', value: (costs.ristorazione || []).reduce((sum, item) => sum + (item.importo || 0), 0) },
                                                            { name: 'Utenze', value: ((costs.utenze?.energia?.importo || 0) + (costs.utenze?.gas?.importo || 0) + (costs.utenze?.acqua?.importo || 0)) },
                                                            { name: 'Personale', value: ((costs.personale?.bustePaga || 0) + (costs.personale?.sicurezza || 0)) },
                                                            { name: 'Altri', value: Object.values(costs.altriCosti || {}).reduce((sum, val) => sum + (val || 0), 0) },
                                                        ].filter(item => item.value > 0)}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={(entry: any) => `${entry.name} ${((entry.percent || 0) * 100).toFixed(0)}%`}
                                                        outerRadius={80}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {['#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map((color, index) => (
                                                            <Cell key={`cell-${index}`} fill={color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Trend Occupazione */}
                                {revenues.length > 0 && (
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                        <h3 className="text-xl font-semibold text-white mb-4">Trend Occupazione e ADR</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={revenues.slice(-6).map(r => ({
                                                mese: r.mese.slice(5),
                                                occupazione: r.occupazione,
                                                adr: r.prezzoMedioCamera,
                                            }))}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                <XAxis dataKey="mese" stroke="#9CA3AF" />
                                                <YAxis yAxisId="left" stroke="#9CA3AF" />
                                                <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} />
                                                <Legend />
                                                <Bar yAxisId="left" dataKey="occupazione" fill="#3B82F6" name="Occupazione %" />
                                                <Bar yAxisId="right" dataKey="adr" fill="#10B981" name="ADR €" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                                <p className="text-gray-400 mb-4">Inserisci dati di ricavi e costi per visualizzare l'analisi completa.</p>
                                <p className="text-sm text-gray-500">Vai alle sezioni "Ricavi" e "Costi" per iniziare.</p>
                            </div>
                        )}
                    </div>
                )}
                {activeSection === 'costi' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Inserimento Costi Mensili</h2>
                            <div className="flex gap-4 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Seleziona Mese</label>
                                    <input
                                        type="month"
                                        value={selectedMonth}
                                        onChange={(e) => {
                                            const mese = e.target.value;
                                            setSelectedMonth(mese);
                                            // Carica i costi del mese selezionato se esistono
                                            const monthCosts = monthlyCosts.find(mc => mc.mese === mese);
                                            if (monthCosts) {
                                                setCosts(monthCosts.costs);
                                            } else {
                                                setCosts({});
                                            }
                                        }}
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const currentMonth = new Date().toISOString().slice(0, 7);
                                        if (!monthlyCosts.find(mc => mc.mese === currentMonth)) {
                                            setSelectedMonth(currentMonth);
                                            setCosts({});
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition"
                                >
                                    Nuovo Mese
                                </button>
                                <button
                                    onClick={() => setShowImportDialog(true)}
                                    disabled={!selectedMonth}
                                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2"
                                    title={!selectedMonth ? "Seleziona prima un mese" : "Importa costi da file Excel"}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Importa da Excel
                                </button>
                            </div>
                        </div>

                        {selectedMonth ? (
                            <form onSubmit={handleSaveCosts} data-section="costi">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-2">
                                        {costs && Object.keys(costs).length > 0 && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                                                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-blue-300 text-sm font-semibold">
                                                    Dati presenti per {new Date(selectedMonth + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-gray-600">
                                        {saving ? 'Salvataggio...' : 'Salva Costi Mese'}
                                    </button>
                                </div>

                        {/* Sezioni Form */}
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-6">
                            <h3 className="text-xl font-semibold text-white mb-4">Ristorazione</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div key={i} className="grid grid-cols-2 gap-4 items-end">
                                        <input type="text" value={costs.ristorazione?.[i]?.fornitore || ''} onChange={(e) => handleRistorazioneChange(i, 'fornitore', e.target.value)} placeholder={`Fornitore ${i + 1}`} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                        <input type="number" step="0.01" value={costs.ristorazione?.[i]?.importo || ''} onChange={(e) => handleRistorazioneChange(i, 'importo', e.target.value)} placeholder="Importo €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Utenze</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 items-end">
                                        <input type="text" value={costs.utenze?.energia?.fornitore || ''} onChange={(e) => handleInputChange('utenze', 'energia', 'fornitore', e.target.value)} placeholder="Fornitore Energia" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                        <input type="number" step="0.01" value={costs.utenze?.energia?.importo || ''} onChange={(e) => handleInputChange('utenze', 'energia', 'importo', e.target.value)} placeholder="Importo €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                    </div>
                                     <div className="grid grid-cols-2 gap-4 items-end">
                                        <input type="text" value={costs.utenze?.gas?.fornitore || ''} onChange={(e) => handleInputChange('utenze', 'gas', 'fornitore', e.target.value)} placeholder="Fornitore Gas" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                        <input type="number" step="0.01" value={costs.utenze?.gas?.importo || ''} onChange={(e) => handleInputChange('utenze', 'gas', 'importo', e.target.value)} placeholder="Importo €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                    </div>
                                     <div className="grid grid-cols-2 gap-4 items-end">
                                        <input type="text" value={costs.utenze?.acqua?.fornitore || ''} onChange={(e) => handleInputChange('utenze', 'acqua', 'fornitore', e.target.value)} placeholder="Fornitore Acqua" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                        <input type="number" step="0.01" value={costs.utenze?.acqua?.importo || ''} onChange={(e) => handleInputChange('utenze', 'acqua', 'importo', e.target.value)} placeholder="Importo €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                    </div>
                                </div>
                           </div>
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Personale</h3>
                                <div className="space-y-4">
                                     <input type="number" step="0.01" value={costs.personale?.bustePaga || ''} onChange={(e) => handleInputChange('personale', 'bustePaga', '', e.target.value)} placeholder="Costo Totale Buste Paga €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                     <input type="number" step="0.01" value={costs.personale?.sicurezza || ''} onChange={(e) => handleInputChange('personale', 'sicurezza', '', e.target.value)} placeholder="Aggiornamento Sicurezza Dipendenti €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 lg:col-span-2">
                                 <h3 className="text-xl font-semibold text-white mb-4">Altre Voci di Costo</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {altriCostiFields.map(field => (
                                         <input key={field.id} type="number" step="0.01" value={(costs.altriCosti as any)?.[field.id] || ''} onChange={(e) => handleAltriCostiChange(field.id, e.target.value)} placeholder={`${field.placeholder} €`} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                    ))}
                                 </div>
                             </div>
                        </div>
                    </form>
                        ) : (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                                <p className="text-gray-400 mb-4">Seleziona un mese per inserire i costi.</p>
                                <button
                                    onClick={() => {
                                        const currentMonth = new Date().toISOString().slice(0, 7);
                                        setSelectedMonth(currentMonth);
                                        setCosts({});
                                    }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition"
                                >
                                    Inizia con il mese corrente
                                </button>
                            </div>
                        )}

                        {/* Lista dei mesi con costi inseriti */}
                        {monthlyCosts.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xl font-bold text-white mb-4">Mesi con costi inseriti</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {monthlyCosts.slice().reverse().map((mc) => (
                                        <button
                                            key={mc.mese}
                                            onClick={() => {
                                                setSelectedMonth(mc.mese);
                                                setCosts(mc.costs);
                                            }}
                                            className={`bg-gray-800/50 border-2 rounded-xl p-4 text-left transition ${
                                                selectedMonth === mc.mese 
                                                    ? 'border-blue-500 bg-blue-500/10' 
                                                    : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="font-semibold text-white">
                                                {new Date(mc.mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="text-sm text-gray-400 mt-1">
                                                Totale: €{calculateTotalCostsForMonth(mc.costs).toLocaleString('it-IT')}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeSection === 'ricavi' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Inserimento Dati Ricavi</h2>
                            <button
                                onClick={() => {
                                    const mese = prompt('Inserisci il mese (formato YYYY-MM, es. 2025-01):');
                                    if (mese && mese.match(/^\d{4}-\d{2}$/)) {
                                        const revenueData: RevenueData = {
                                            mese,
                                            entrateTotali: 0,
                                            occupazione: 0,
                                            prezzoMedioCamera: 0,
                                            camereVendute: 0,
                                            nottiTotali: 0,
                                        };
                                        handleSaveRevenues(revenueData);
                                    }
                                }}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition"
                            >
                                Aggiungi Mese
                            </button>
                        </div>

                        {/* Dati Hotel */}
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-6">
                            <h3 className="text-xl font-semibold text-white mb-4">Configurazione Hotel</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Numero Camere Totali</label>
                                    <input
                                        type="number"
                                        value={hotelData?.camereTotali || ''}
                                        onChange={(e) => {
                                            const camereTotali = parseInt(e.target.value) || 0;
                                            const newData = { 
                                                ...hotelData, 
                                                camereTotali,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel'
                                            };
                                            setHotelData(newData as HotelData);
                                            // Salva solo se il valore è valido
                                            if (camereTotali > 0) {
                                                handleSaveHotelData(newData);
                                            }
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                        placeholder="Es. 50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                                    <select
                                        value={hotelData?.categoria || ''}
                                        onChange={(e) => {
                                            const categoria = e.target.value || undefined;
                                            const newData = { 
                                                ...hotelData, 
                                                categoria: categoria ? categoria as any : undefined,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel',
                                                camereTotali: hotelData?.camereTotali || 0
                                            };
                                            setHotelData(newData as HotelData);
                                            if (hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                handleSaveHotelData(newData);
                                            }
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="">Seleziona...</option>
                                        <option value="lussuoso">Lussuoso</option>
                                        <option value="business">Business</option>
                                        <option value="economico">Economico</option>
                                        <option value="boutique">Boutique</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Stelle</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={hotelData?.stelle || ''}
                                        onChange={(e) => {
                                            const stelle = parseInt(e.target.value) || undefined;
                                            const newData = { 
                                                ...hotelData, 
                                                stelle,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel',
                                                camereTotali: hotelData?.camereTotali || 0
                                            };
                                            setHotelData(newData as HotelData);
                                            if (hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                handleSaveHotelData(newData);
                                            }
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                        placeholder="Es. 4"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dati Ricavi per Mese */}
                        {revenues.length > 0 ? (
                            <div className="space-y-4">
                                {revenues.slice().reverse().map((revenue, idx) => (
                                    <div key={idx} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">
                                            {new Date(revenue.mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Entrate Totali (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={revenue.entrateTotali || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, entrateTotali: parseFloat(e.target.value) || 0 };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Occupazione (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    max="100"
                                                    value={revenue.occupazione || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, occupazione: parseFloat(e.target.value) || 0 };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Prezzo Medio Camera - ADR (€)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={revenue.prezzoMedioCamera || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, prezzoMedioCamera: parseFloat(e.target.value) || 0 };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Camere Vendute</label>
                                                <input
                                                    type="number"
                                                    value={revenue.camereVendute || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, camereVendute: parseInt(e.target.value) || 0 };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Notti Totali</label>
                                                <input
                                                    type="number"
                                                    value={revenue.nottiTotali || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, nottiTotali: parseInt(e.target.value) || 0 };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                                <p className="text-gray-400 mb-4">Nessun dato ricavi inserito.</p>
                                <p className="text-sm text-gray-500">Clicca su "Aggiungi Mese" per iniziare.</p>
                            </div>
                        )}
                    </div>
                )}
                {activeSection === 'raccomandazioni' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Raccomandazioni IA</h2>
                            {analyzing && (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Analisi in corso...</span>
                                </div>
                            )}
                        </div>

                        {recommendations.length > 0 ? (
                            <div className="space-y-6">
                                <div className="bg-blue-500/10 border border-blue-500/50 rounded-2xl p-4 mb-6">
                                    <p className="text-blue-300">
                                        <strong>{recommendations.length}</strong> raccomandazioni trovate. 
                                        Potenziale risparmio totale: <strong>€{recommendations.reduce((sum, r) => sum + r.impattoStimato, 0).toLocaleString('it-IT')}</strong>
                                    </p>
                                </div>
                                {recommendations.map((rec) => (
                                    <RecommendationCard key={rec.id} recommendation={rec} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                                <p className="text-gray-400 mb-4">Inserisci dati di costi e ricavi per ricevere raccomandazioni personalizzate.</p>
                                <p className="text-sm text-gray-500">Vai alle sezioni "Costi" e "Ricavi" per iniziare.</p>
                            </div>
                        )}

                        {/* Analisi Costi */}
                        {costAnalyses.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-2xl font-bold text-white mb-4">Analisi Dettagliata Costi</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {costAnalyses.map((analysis, idx) => (
                                        <div key={idx} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                            <h4 className="font-semibold text-white mb-2">{analysis.categoria}</h4>
                                            <p className="text-2xl font-bold text-blue-400 mb-2">€{analysis.importoAttuale.toLocaleString('it-IT')}</p>
                                            {analysis.variazionePercentuale !== undefined && (
                                                <p className={`text-sm ${analysis.variazionePercentuale > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {analysis.variazionePercentuale > 0 ? '+' : ''}{analysis.variazionePercentuale.toFixed(1)}% rispetto al mese precedente
                                                </p>
                                            )}
                                            {analysis.anomalia && (
                                                <span className="inline-block mt-2 px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">Anomalia</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeSection === 'report' && (
                    <div>
                       <h2 className="text-3xl font-bold text-white mb-6">Report e Analisi</h2>
                       {kpi && revenues.length > 0 ? (
                           <div className="space-y-6">
                               {/* Summary Report */}
                               <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                   <h3 className="text-xl font-semibold text-white mb-4">Report Mensile</h3>
                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">Ricavi Totali</p>
                                           <p className="text-2xl font-bold text-green-400">€{kpi.totaleRicavi.toLocaleString('it-IT')}</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">Spese Totali</p>
                                           <p className="text-2xl font-bold text-red-400">€{kpi.totaleSpese.toLocaleString('it-IT')}</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">Profitto Operativo (GOP)</p>
                                           <p className={`text-2xl font-bold ${kpi.gop >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                               €{kpi.gop.toLocaleString('it-IT')}
                                           </p>
                                       </div>
                                   </div>
                               </div>

                               {/* KPI Report */}
                               <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                   <h3 className="text-xl font-semibold text-white mb-4">Key Performance Indicators</h3>
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">RevPAR</p>
                                           <p className="text-xl font-bold text-white">€{kpi.revpar.toFixed(2)}</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">ADR</p>
                                           <p className="text-xl font-bold text-white">€{kpi.adr.toFixed(2)}</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">Occupazione</p>
                                           <p className="text-xl font-bold text-white">{kpi.occupazione.toFixed(1)}%</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">GOP Margin</p>
                                           <p className="text-xl font-bold text-white">{kpi.gopMargin.toFixed(1)}%</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">CPPR</p>
                                           <p className="text-xl font-bold text-white">€{kpi.cppr.toFixed(2)}</p>
                                       </div>
                                       <div>
                                           <p className="text-sm text-gray-400 mb-1">Profit per Room</p>
                                           <p className="text-xl font-bold text-white">€{kpi.profitPerRoom.toFixed(2)}</p>
                                       </div>
                                   </div>
                               </div>

                               {/* Export Button */}
                               <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                   <button
                                       onClick={() => {
                                           const report = {
                                               hotel: hotelName,
                                               periodo: revenues[revenues.length - 1]?.mese || '',
                                               kpi,
                                               revenues: revenues[revenues.length - 1],
                                               costs,
                                           };
                                           const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                                           const url = URL.createObjectURL(blob);
                                           const a = document.createElement('a');
                                           a.href = url;
                                           a.download = `report-${hotelName}-${new Date().toISOString().split('T')[0]}.json`;
                                           a.click();
                                           URL.revokeObjectURL(url);
                                       }}
                                       className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition"
                                   >
                                       Esporta Report (JSON)
                                   </button>
                               </div>
                           </div>
                       ) : (
                           <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                               <p className="text-gray-400">Inserisci dati di costi e ricavi per generare i report.</p>
                           </div>
                       )}
                    </div>
                )}
            </div>
        </main>

        {/* Toast */}
        {showToast && (
            <div className={`fixed bottom-8 right-8 py-3 px-6 rounded-lg shadow-lg z-50 ${
                toastMessage.includes('successo') || toastMessage.includes('Importati') ? 'bg-green-500' : 'bg-red-500'
            } text-white`}>
                {toastMessage || 'Dati salvati con successo!'}
            </div>
        )}

        {/* Import Dialog */}
        <ImportCostsDialog
            isOpen={showImportDialog}
            onClose={() => setShowImportDialog(false)}
            onImport={handleImportCosts}
            selectedMonth={selectedMonth}
        />
    </div>
);

}