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
import CategorizeCostsDialog from './components/CategorizeCostsDialog';
import UploadPayrollDialog from './components/UploadPayrollDialog';
import MonthPicker from './components/MonthPicker';
import CompetitorAlerts from './components/CompetitorAlerts';
import CompetitorManager from './components/CompetitorManager';
import RevenueForecastCard from './components/RevenueForecastCard';
import CostAnomaliesAlert from './components/CostAnomaliesAlert';
import DynamicPricingCard from './components/DynamicPricingCard';
import HistoricalDataInput from './components/HistoricalDataInput';
import FattureInCloudIntegration from './components/FattureInCloudIntegration';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Label, LabelList } from 'recharts';

// Helper per calcolare i giorni massimi di un mese
const getMaxDaysInMonth = (yearMonth: string): number => {
    if (!yearMonth || !yearMonth.match(/^\d{4}-\d{2}$/)) {
        return 31; // Default se formato non valido
    }
    
    const [year, month] = yearMonth.split('-').map(Number);
    const monthIndex = month - 1; // JavaScript months are 0-indexed
    
    // Mesi con 31 giorni
    const monthsWith31Days = [0, 2, 4, 6, 7, 9, 11]; // Gen, Mar, Mag, Lug, Ago, Ott, Dic
    // Mesi con 30 giorni
    const monthsWith30Days = [3, 5, 8, 10]; // Apr, Giu, Set, Nov
    
    if (monthsWith31Days.includes(monthIndex)) {
        return 31;
    } else if (monthsWith30Days.includes(monthIndex)) {
        return 30;
    } else {
        // Febbraio - controlla se è bisestile
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        return isLeapYear ? 29 : 28;
    }
};

// Helper per calcolare il totale costi di un mese
const calculateTotalCostsForMonth = (costs: Partial<CostsData>): number => {
    if (!costs || Object.keys(costs).length === 0) return 0;
    
    let totale = 0;
    
    // Ristorazione
    if (costs.ristorazione && Array.isArray(costs.ristorazione)) {
        const ristorazioneTot = costs.ristorazione.reduce((sum, item) => {
            const importo = item?.importo || 0;
            return sum + (typeof importo === 'number' ? importo : parseFloat(importo) || 0);
        }, 0);
        totale += ristorazioneTot;
    }
    
    // Utenze
    if (costs.utenze) {
        totale += (costs.utenze.energia?.importo || 0);
        totale += (costs.utenze.gas?.importo || 0);
        totale += (costs.utenze.acqua?.importo || 0);
    }
    
    // Personale
    if (costs.personale) {
        totale += (costs.personale.bustePaga || 0);
        totale += (costs.personale.sicurezza || 0);
        totale += (costs.personale.contributiINPS || 0);
    }
    
    // Marketing
    if (costs.marketing) {
        totale += (costs.marketing.costiMarketing || 0);
        totale += (costs.marketing.commissioniOTA || 0);
    }
    
    // Altri costi
    if (costs.altriCosti && typeof costs.altriCosti === 'object') {
        const altriCostiTot = Object.values(costs.altriCosti).reduce((sum: number, val: any) => {
            const numVal = typeof val === 'number' ? val : parseFloat(val) || 0;
            return sum + numVal;
        }, 0);
        totale += altriCostiTot;
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
const [importedCostsUncategorized, setImportedCostsUncategorized] = useState<any[]>([]);
const [showCategorizeDialog, setShowCategorizeDialog] = useState(false);
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
const [showPayrollDialog, setShowPayrollDialog] = useState(false);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const [showMonthPicker, setShowMonthPicker] = useState(false);
const [monthPickerType, setMonthPickerType] = useState<'costi' | 'ricavi'>('costi');
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
                userEmail: user?.email || null,
                hotelName: hotelName || null,
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

// Cancella tutti i costi del mese selezionato
const handleDeleteMonthCosts = async () => {
    if (!user || !selectedMonth) {
        setToastMessage('Seleziona un mese per cancellare i costi.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    // Chiedi conferma
    if (!confirm(`Sei sicuro di voler cancellare tutti i costi di ${new Date(selectedMonth + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}? Questa azione è irreversibile.`)) {
        return;
    }
    
    setSaving(true);
    
    try {
        const userDocRef = doc(db, "users", user.uid);
        
        // Rimuovi il mese dalla lista monthlyCosts
        const updatedMonthlyCosts = monthlyCosts.filter(mc => mc.mese !== selectedMonth);
        
        // Salva in Firestore
        await setDoc(userDocRef, { monthlyCosts: updatedMonthlyCosts }, { merge: true });
        setMonthlyCosts(updatedMonthlyCosts);
        
        // Resetta i costi e il mese selezionato
        setCosts({});
        setSelectedMonth('');
        setImportedCostsUncategorized([]);
        setShowCategorizeDialog(false);
        
        // Ricalcola analytics con i costi rimanenti
        await calculateAnalytics(updatedMonthlyCosts, revenues, hotelData || undefined);
        
        setToastMessage('Costi del mese cancellati con successo!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
        console.error("Errore nella cancellazione dei costi:", error);
        setToastMessage("Si è verificato un errore durante la cancellazione.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } finally {
        setSaving(false);
    }
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
    
    // Se ci sono costi importati non categorizzati, applica le categorizzazioni
    let cleanedCosts = JSON.parse(JSON.stringify(costs));
    
    if (importedCostsUncategorized.length > 0) {
        const categorizedCosts = applyCategorizedCosts(importedCostsUncategorized);
        // Merge con i costi esistenti
        cleanedCosts = {
            ristorazione: [
                ...(cleanedCosts.ristorazione || []),
                ...(categorizedCosts.ristorazione || [])
            ],
            utenze: {
                energia: {
                    fornitore: categorizedCosts.utenze?.energia?.fornitore || cleanedCosts.utenze?.energia?.fornitore || '',
                    importo: (cleanedCosts.utenze?.energia?.importo || 0) + (categorizedCosts.utenze?.energia?.importo || 0),
                },
                gas: {
                    fornitore: categorizedCosts.utenze?.gas?.fornitore || cleanedCosts.utenze?.gas?.fornitore || '',
                    importo: (cleanedCosts.utenze?.gas?.importo || 0) + (categorizedCosts.utenze?.gas?.importo || 0),
                },
                acqua: {
                    fornitore: categorizedCosts.utenze?.acqua?.fornitore || cleanedCosts.utenze?.acqua?.fornitore || '',
                    importo: (cleanedCosts.utenze?.acqua?.importo || 0) + (categorizedCosts.utenze?.acqua?.importo || 0),
                },
            },
            personale: {
                bustePaga: (cleanedCosts.personale?.bustePaga || 0) + (categorizedCosts.personale?.bustePaga || 0),
                sicurezza: (cleanedCosts.personale?.sicurezza || 0) + (categorizedCosts.personale?.sicurezza || 0),
                contributiINPS: (cleanedCosts.personale?.contributiINPS || 0) + (categorizedCosts.personale?.contributiINPS || 0),
            },
            altriCosti: {
                ...(cleanedCosts.altriCosti || {}),
                ...(categorizedCosts.altriCosti || {}),
            },
        };
        
        // Pulisci i costi importati dopo l'applicazione
        setImportedCostsUncategorized([]);
        setShowCategorizeDialog(false);
    }
    
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
        
        const totaleSalvato = calculateTotalCostsForMonth(cleanedCosts);
        console.log('Costi salvati per il mese', selectedMonth, 'Totale:', totaleSalvato);
        console.log('Struttura costi salvati:', cleanedCosts);
        
        setToastMessage(`Dati costi salvati con successo! Totale: €${totaleSalvato.toLocaleString('it-IT')}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
    } catch (error) {
        console.error("Errore nel salvataggio dei costi:", error);
        setToastMessage("Si è verificato un errore durante il salvataggio.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } finally {
        setSaving(false);
    }
};

// Gestione importazione costi da Excel - ora salva solo come lista semplice
const handleImportCosts = async (importedCosts: any[]) => {
    if (!selectedMonth || importedCosts.length === 0) {
        setToastMessage('Seleziona un mese o verifica che il file contenga dati validi.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    console.log('Importazione costi:', importedCosts.length, 'elementi');
    
    // Applica automaticamente le categorie salvate per i fornitori conosciuti
    const costsWithCategoria = importedCosts.map(cost => {
        const savedCategoria = fornitoreCategoriaMap[cost.fornitore];
        return {
            ...cost,
            categoria: savedCategoria || cost.categoria
        };
    });
    
    // Salva i costi importati nello stato (con categorie automatiche se disponibili)
    setImportedCostsUncategorized(costsWithCategoria);
    
    // Calcola il totale importato
    const totaleImportato = importedCosts.reduce((sum, cost) => sum + (cost.importo || 0), 0);
    
    // Mostra il dialog di categorizzazione
    setShowCategorizeDialog(true);
    
    setToastMessage(`✅ Importati ${importedCosts.length} costi per un totale di €${totaleImportato.toLocaleString('it-IT')}!`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
};

// Stato per salvare le associazioni fornitore-categoria
const [fornitoreCategoriaMap, setFornitoreCategoriaMap] = useState<Record<string, string>>({});

// Carica le associazioni salvate all'avvio
useEffect(() => {
    if (user) {
        // Carica da localStorage
        const saved = localStorage.getItem(`fornitoreCategoriaMap_${user.uid}`);
        if (saved) {
            try {
                setFornitoreCategoriaMap(JSON.parse(saved));
            } catch (e) {
                console.error('Errore nel caricamento associazioni fornitore-categoria:', e);
            }
        }
    }
}, [user]);

// Gestione categorizzazione manuale dei costi importati
const handleCategorizeCost = (costId: string, categoria: string) => {
    // Trova il costo per ottenere il fornitore
    const costToUpdate = importedCostsUncategorized.find(c => c.id === costId);
    if (!costToUpdate) return;
    
    const fornitore = costToUpdate.fornitore;
    
    // Se viene selezionata una categoria, salvala per questo fornitore
    if (categoria) {
        const newMap = { ...fornitoreCategoriaMap, [fornitore]: categoria };
        setFornitoreCategoriaMap(newMap);
        
        // Salva in localStorage
        if (user) {
            localStorage.setItem(`fornitoreCategoriaMap_${user.uid}`, JSON.stringify(newMap));
        }
        
        // Applica la categoria a tutti i costi con lo stesso fornitore
        setImportedCostsUncategorized(prev => 
            prev.map(cost => 
                cost.fornitore === fornitore ? { ...cost, categoria } : cost
            )
        );
    } else {
        // Se viene rimossa la categoria, aggiorna solo questo costo
        setImportedCostsUncategorized(prev => 
            prev.map(cost => 
                cost.id === costId ? { ...cost, categoria: undefined } : cost
            )
        );
    }
};

// Applica le categorizzazioni ai costi quando si salva
const applyCategorizedCosts = (categorizedCosts: any[]): Partial<CostsData> => {
    const costsData: Partial<CostsData> = {
        ristorazione: [],
        utenze: {
            energia: { fornitore: '', importo: 0 },
            gas: { fornitore: '', importo: 0 },
            acqua: { fornitore: '', importo: 0 },
        },
        personale: {
            bustePaga: 0,
            sicurezza: 0,
        },
        altriCosti: {},
    };
    
    categorizedCosts.forEach(cost => {
        if (!cost.categoria) return; // Salta costi non categorizzati
        
        switch (cost.categoria) {
            case 'Ristorazione':
                if (!costsData.ristorazione) costsData.ristorazione = [];
                costsData.ristorazione.push({
                    fornitore: cost.fornitore,
                    importo: cost.importo,
                });
                break;
                
            case 'Utenze - Energia':
                if (costsData.utenze) {
                    costsData.utenze.energia = {
                        fornitore: costsData.utenze.energia?.fornitore || cost.fornitore,
                        importo: (costsData.utenze.energia?.importo || 0) + cost.importo,
                    };
                }
                break;
                
            case 'Utenze - Gas':
                if (costsData.utenze) {
                    costsData.utenze.gas = {
                        fornitore: costsData.utenze.gas?.fornitore || cost.fornitore,
                        importo: (costsData.utenze.gas?.importo || 0) + cost.importo,
                    };
                }
                break;
                
            case 'Utenze - Acqua':
                if (costsData.utenze) {
                    costsData.utenze.acqua = {
                        fornitore: costsData.utenze.acqua?.fornitore || cost.fornitore,
                        importo: (costsData.utenze.acqua?.importo || 0) + cost.importo,
                    };
                }
                break;
                
            case 'Personale - Buste Paga':
                if (costsData.personale) {
                    costsData.personale.bustePaga += cost.importo;
                }
                break;
                
            case 'Personale - Sicurezza':
                if (costsData.personale) {
                    costsData.personale.sicurezza += cost.importo;
                }
                break;
                
            case 'Personale - Contributi INPS':
                if (costsData.personale) {
                    costsData.personale.contributiINPS = (costsData.personale.contributiINPS || 0) + cost.importo;
                }
                break;
                
            default:
                // Altri costi
                if (!costsData.altriCosti) costsData.altriCosti = {};
                const key = cost.categoria.toLowerCase().replace(/\s+/g, '');
                costsData.altriCosti[key] = (costsData.altriCosti[key] || 0) + cost.importo;
                break;
        }
    });
    
    return costsData;
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
        camereTotali: data?.camereTotali !== undefined ? data.camereTotali : (hotelData?.camereTotali || 0),
        postiLettoTotali: data?.postiLettoTotali !== undefined ? data.postiLettoTotali : hotelData?.postiLettoTotali,
        stelle: data?.stelle !== undefined ? data.stelle : hotelData?.stelle,
        localita: data?.localita || hotelData?.localita,
        annoInizio: data?.annoInizio || hotelData?.annoInizio,
        tipoHotel: data?.tipoHotel || hotelData?.tipoHotel,
        giorniApertura: data?.giorniApertura !== undefined ? data.giorniApertura : hotelData?.giorniApertura,
    };
    
    // Permetti salvataggio se c'è almeno camereTotali o postiLettoTotali (entrambi sono importanti)
    if ((!hotelDataToSave.camereTotali || hotelDataToSave.camereTotali <= 0) && 
        (!hotelDataToSave.postiLettoTotali || hotelDataToSave.postiLettoTotali <= 0)) {
        setToastMessage('Inserisci almeno il numero di camere o i posti letto totali prima di salvare.');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
    }
    
    // Validazione per hotel stagionali: richiedi i giorni di apertura
    if (hotelDataToSave.tipoHotel === 'stagionale' && (!hotelDataToSave.giorniApertura || hotelDataToSave.giorniApertura <= 0 || hotelDataToSave.giorniApertura > 365)) {
        setToastMessage('Per hotel stagionali è necessario inserire un numero valido di giorni di apertura (1-365).');
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
        onClick={() => {
            setActiveSection(id);
            setIsMobileMenuOpen(false); // Chiudi il menu mobile quando si clicca su un link
        }}
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
        {/* Overlay per mobile menu */}
        {isMobileMenuOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
            />
        )}

        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-gray-800/95 md:bg-gray-800/50 border-r border-gray-700 flex-shrink-0 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
                <Link href="/" className="text-xl md:text-2xl font-bold text-white">
                    Revenue<span className="text-blue-400">Sentry</span>
                </Link>
                {/* Bottone close per mobile */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="md:hidden p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition"
                    aria-label="Close menu"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <NavLink id="panoramica" text="Panoramica" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
                <NavLink id="ricavi" text="Ricavi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <NavLink id="costi" text="Costi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zM15 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"/></svg>} />
                <NavLink id="competitor" text="Competitor" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                <NavLink id="raccomandazioni" text="Consigli AI" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>} />
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
        <main className="flex-1 flex flex-col md:ml-0">
            <header className="h-16 bg-gray-800/30 border-b border-gray-700 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
                {/* Hamburger menu button per mobile */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition"
                    aria-label="Toggle menu"
                >
                    {isMobileMenuOpen ? (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>

                {/* Logo per mobile - solo se menu chiuso */}
                {!isMobileMenuOpen && (
                    <Link href="/" className="md:hidden text-xl font-bold text-white">
                        Revenue<span className="text-blue-400">Sentry</span>
                    </Link>
                )}
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
                            <div className="flex items-center gap-3">
                                {analyzing && (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Analisi in corso...</span>
                                    </div>
                                )}
                                <button
                                    onClick={async () => {
                                        const costsToUse = monthlyCosts.length > 0 ? monthlyCosts : costs;
                                        await calculateAnalytics(costsToUse, revenues, hotelData || undefined);
                                    }}
                                    disabled={analyzing}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2"
                                    title="Ricalcola tutti gli indici e le metriche in base ai dati attuali"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Aggiorna
                                </button>
                            </div>
                        </div>

                        {/* Competitor Alerts - Quick Win 1 */}
                        <div className="mb-6">
                            <CompetitorAlerts />
                        </div>

                        {/* Revenue Forecast - Quick Win 2 */}
                        <div className="mb-6">
                            <RevenueForecastCard />
                        </div>

                        {/* Historical Data Input - Per Dynamic Pricing */}
                        {user && (
                            <div className="mb-6">
                                <HistoricalDataInput
                                    onDataSaved={() => {
                                        // Ricarica i dati dopo il salvataggio
                                        if (user) {
                                            // Potresti voler ricaricare i dati qui
                                            console.log('Dati storici salvati, ricarica in corso...');
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {/* Dynamic Pricing - FASE 2 */}
                        {user && kpi && (
                            <div className="mb-6">
                                <DynamicPricingCard
                                    hotelId={user.uid}
                                    currentPrice={kpi.adr}
                                    onPriceUpdate={(newPrice) => {
                                        // TODO: Implementare aggiornamento prezzo
                                        console.log('Nuovo prezzo suggerito:', newPrice);
                                    }}
                                />
                            </div>
                        )}

                        {/* Cost Anomalies - Quick Win 3 */}
                        <div className="mb-6">
                            <CostAnomaliesAlert />
                        </div>

                        {kpi ? (
                            <>
                                {/* KPI Cards - Revenue Management */}
                                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6`}>
                                    <KPICard
                                        title="RevPAR"
                                        value={`€${kpi.revpar.toFixed(2)}`}
                                        subtitle="Revenue Per Available Room"
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                        color="blue"
                                        description="Il RevPAR (Revenue Per Available Room) è il KPI più importante del revenue management. Indica quanto ricavo generi per ogni camera disponibile, indipendentemente dal fatto che sia occupata o meno. Si calcola moltiplicando l'ADR per il tasso di occupazione, oppure dividendo i ricavi totali delle camere per il numero di camere disponibili nel periodo. Un RevPAR alto indica un'efficiente gestione sia dei prezzi che dell'occupazione."
                                    />
                                    <KPICard
                                        title="TRevPAR"
                                        value={`€${kpi.trevpar?.toFixed(2) || '0.00'}`}
                                        subtitle="Total Revenue Per Available Room"
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                                        color="purple"
                                        description="Il TRevPAR (Total Revenue Per Available Room) misura i ricavi totali generati dall'hotel (camere + ristorazione + servizi aggiuntivi) divisi per il numero di camere disponibili. A differenza del RevPAR che considera solo i ricavi delle camere, il TRevPAR fornisce una visione olistica della capacità dell'hotel di generare ricavi da tutti i suoi servizi. È particolarmente utile per valutare la performance complessiva dell'hotel."
                                    />
                                    <KPICard
                                        title="Occupazione"
                                        value={`${kpi.occupazione.toFixed(1)}%`}
                                        subtitle={`ADR: €${kpi.adr.toFixed(2)}`}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                                        color={kpi.occupazione >= 70 ? 'green' : kpi.occupazione >= 50 ? 'yellow' : 'red'}
                                        description="Il Tasso di Occupazione indica la percentuale di camere vendute rispetto al totale disponibile nel periodo. Si calcola dividendo le camere vendute per le camere disponibili e moltiplicando per 100. Un tasso di occupazione elevato (sopra il 70%) è generalmente positivo, ma deve essere bilanciato con un ADR adeguato per massimizzare il RevPAR. L'ADR (Average Daily Rate) mostrato nel sottotitolo è il prezzo medio pagato per camera venduta."
                                    />
                                    {kpi.alos !== undefined && (
                                    <KPICard
                                            title="ALOS"
                                            value={`${kpi.alos.toFixed(1)}`}
                                            subtitle="Average Length of Stay (giorni)"
                                            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            color="blue"
                                            description="L'ALOS (Average Length of Stay) rappresenta la durata media del soggiorno degli ospiti in giorni. Si calcola dividendo il numero totale di notti vendute per il numero totale di prenotazioni. Un ALOS più lungo può indicare una maggiore soddisfazione degli ospiti e ridurre i costi di acquisizione clienti, ma può anche limitare la flessibilità nella gestione dei prezzi. È importante monitorare questo indicatore per ottimizzare le strategie di pricing."
                                        />
                                    )}
                                </div>
                                
                                {/* KPI Cards - Redditività USALI */}
                                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${kpi.roi !== undefined && kpi.cac !== undefined ? '5' : kpi.roi !== undefined || kpi.cac !== undefined ? '4' : '3'} gap-6 mb-6`}>
                                    <KPICard
                                        title="GOP"
                                        value={`€${kpi.gop.toLocaleString('it-IT')}`}
                                        subtitle={`GOP Margin: ${kpi.gopMargin.toFixed(1)}%`}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                                        color={kpi.gopMargin >= 25 ? 'green' : kpi.gopMargin >= 15 ? 'yellow' : 'red'}
                                        description="Il GOP (Gross Operating Profit) è il profitto operativo lordo, calcolato come differenza tra i ricavi totali operativi e i costi operativi diretti. È uno degli indicatori più importanti secondo lo standard USALI perché misura la redditività operativa dell'hotel prima dei costi fissi (affitto, tasse, ammortamenti). Il GOP Margin indica la percentuale di profitto rispetto ai ricavi. Un margine sopra il 25% è considerato eccellente, mentre sotto il 15% richiede attenzione."
                                    />
                                    {kpi.goppar !== undefined && (
                                        <KPICard
                                            title="GOPPAR"
                                            value={`€${kpi.goppar.toFixed(2)}`}
                                            subtitle="Gross Operating Profit Per Available Room"
                                            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                            color={kpi.goppar >= 50 ? 'green' : kpi.goppar >= 30 ? 'yellow' : 'red'}
                                            description="Il GOPPAR (Gross Operating Profit Per Available Room) è l'indicatore principe della redditività secondo lo standard USALI. Misura quanto profitto operativo stai generando per ogni camera disponibile nella struttura. Si calcola dividendo il GOP per il numero totale di camere disponibili nel periodo. Questo KPI permette di confrontare la performance tra hotel di dimensioni diverse e di valutare l'efficienza operativa complessiva. Valori sopra €50 indicano performance eccellenti."
                                        />
                                    )}
                                    <KPICard
                                        title="CPOR"
                                        value={`€${kpi.cpor?.toFixed(2) || '0.00'}`}
                                        subtitle="Cost Per Occupied Room"
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                        color="yellow"
                                        description="Il CPOR (Cost Per Occupied Room) indica quanto costa 'servire' una camera occupata. Include i costi diretti del reparto camere come pulizia, lavanderia, amenities, e una parte proporzionale di utenze e personale. Si calcola dividendo i costi totali del reparto camere per il numero di camere vendute. Questo indicatore è cruciale per il controllo dei costi variabili e aiuta a identificare opportunità di ottimizzazione. Un CPOR basso rispetto all'ADR indica una migliore redditività per camera."
                                    />
                                    {kpi.roi !== undefined && (
                                        <KPICard
                                            title="ROI"
                                            value={`${kpi.roi.toFixed(1)}%`}
                                            subtitle="Return on Investment"
                                            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                            color={kpi.roi >= 20 ? 'green' : kpi.roi >= 10 ? 'yellow' : 'red'}
                                            description="Il ROI (Return on Investment) misura il ritorno sull'investimento, esprimendo la redditività come percentuale dei costi totali. Si calcola dividendo il GOP per i costi totali e moltiplicando per 100. Per hotel stagionali, il calcolo viene normalizzato rispetto ai giorni di apertura effettivi per una valutazione più precisa. Un ROI sopra il 20% indica un investimento molto redditizio, mentre valori sotto il 10% suggeriscono la necessità di ottimizzare costi o ricavi."
                                        />
                                    )}
                                    {kpi.cac !== undefined && (
                                        <KPICard
                                            title="CAC"
                                            value={`€${kpi.cac.toFixed(2)}`}
                                            subtitle="Costo Acquisto Clienti"
                                            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                            color={kpi.cac < 20 ? 'green' : kpi.cac < 40 ? 'yellow' : 'red'}
                                            description="Il CAC (Costo Acquisto Clienti) misura quanto spendi per acquisire una singola prenotazione. Si calcola sommando i costi di marketing e le commissioni OTA (Booking.com, Expedia, etc.) e dividendo per il numero totale di prenotazioni ricevute. Un CAC basso indica una strategia di marketing efficiente e una migliore redditività per prenotazione. Valori sotto €20 sono considerati eccellenti, mentre sopra €40 richiedono una revisione della strategia di acquisizione clienti."
                                        />
                                    )}
                                </div>
                                {/* Metriche stagionali aggiuntive */}
                                {hotelData?.tipoHotel === 'stagionale' && kpi.costiGiornalieriMedi && kpi.ricaviGiornalieriMedi && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                        <KPICard
                                            title="Costi Giornalieri Medi"
                                            value={`€${kpi.costiGiornalieriMedi.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            subtitle={(() => {
                                                const giorniTotali = revenues.reduce((sum, r) => sum + (r.giorniAperturaMese || 0), 0);
                                                const giorniMostrati = giorniTotali > 0 ? giorniTotali : (hotelData.giorniApertura || 0);
                                                return `Su ${giorniMostrati} giorni di apertura${giorniTotali > 0 ? ' (da dati mensili)' : ''}`;
                                            })()}
                                            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                            color="yellow"
                                            description="I Costi Giornalieri Medi rappresentano il costo medio giornaliero sostenuto dall'hotel durante il periodo di apertura. Per hotel stagionali, questo indicatore è calcolato dividendo i costi totali per il numero effettivo di giorni di apertura (forniti mensilmente o annualmente). Questo permette di normalizzare i costi e comparare la performance tra hotel stagionali con periodi di apertura diversi. È fondamentale per la pianificazione finanziaria e il controllo dei costi operativi."
                                        />
                                        <KPICard
                                            title="Ricavi Giornalieri Medi"
                                            value={`€${kpi.ricaviGiornalieriMedi.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                            subtitle={(() => {
                                                const giorniTotali = revenues.reduce((sum, r) => sum + (r.giorniAperturaMese || 0), 0);
                                                const giorniMostrati = giorniTotali > 0 ? giorniTotali : (hotelData.giorniApertura || 0);
                                                return `Su ${giorniMostrati} giorni di apertura${giorniTotali > 0 ? ' (da dati mensili)' : ''}`;
                                            })()}
                                        icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                            color="green"
                                            description="I Ricavi Giornalieri Medi indicano il ricavo medio giornaliero generato dall'hotel durante il periodo di apertura. Per hotel stagionali, questo è calcolato dividendo i ricavi totali per il numero effettivo di giorni di apertura. Confrontando questo valore con i costi giornalieri medi, puoi valutare la redditività giornaliera e identificare i periodi più e meno redditizi. Questa metrica è particolarmente utile per hotel stagionali che devono ottimizzare la performance durante periodi limitati di apertura."
                                    />
                                </div>
                                )}

                                {/* Grafici */}
                                {revenues.length > 0 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                        {/* Grafico Ricavi/Spese nel tempo */}
                                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                            <h3 className="text-xl font-semibold text-white mb-4">Ricavi e Spese nel Tempo</h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={(() => {
                                                    // Combina revenues e monthlyCosts per mese
                                                    const chartData: Array<{ mese: string; ricavi: number; spese: number }> = [];
                                                    
                                                    // Prendi gli ultimi 6 mesi
                                                    const recentRevenues = revenues.slice(-6);
                                                    
                                                    recentRevenues.forEach(revenue => {
                                                        const monthKey = revenue.mese; // formato "YYYY-MM"
                                                        const monthCosts = monthlyCosts.find(mc => mc.mese === monthKey);
                                                        const speseMese = monthCosts ? calculateTotalCostsForMonth(monthCosts.costs) : 0;
                                                        
                                                        chartData.push({
                                                            mese: monthKey.slice(5), // mostra solo "MM" o meglio "MM-YYYY"
                                                            ricavi: revenue.entrateTotali || 0,
                                                            spese: speseMese,
                                                        });
                                                    });
                                                    
                                                    // Se ci sono costi mensili senza ricavi corrispondenti, aggiungili
                                                    monthlyCosts.forEach(mc => {
                                                        const monthKey = mc.mese;
                                                        if (!chartData.find(d => d.mese === monthKey.slice(5))) {
                                                            const speseMese = calculateTotalCostsForMonth(mc.costs);
                                                            if (speseMese > 0) {
                                                                chartData.push({
                                                                    mese: monthKey.slice(5),
                                                                    ricavi: 0,
                                                                    spese: speseMese,
                                                                });
                                                            }
                                                        }
                                                    });
                                                    
                                                    // Ordina per mese usando il mese completo originale (YYYY-MM)
                                                    chartData.sort((a, b) => {
                                                        // Trova il mese completo originale per ordinare correttamente
                                                        const revenueA = revenues.find(r => r.mese.slice(5) === a.mese);
                                                        const revenueB = revenues.find(r => r.mese.slice(5) === b.mese);
                                                        
                                                        const monthCostA = monthlyCosts.find(mc => mc.mese.slice(5) === a.mese);
                                                        const monthCostB = monthlyCosts.find(mc => mc.mese.slice(5) === b.mese);
                                                        
                                                        const fullMonthA = revenueA?.mese || monthCostA?.mese || `2024-${a.mese.padStart(2, '0')}`;
                                                        const fullMonthB = revenueB?.mese || monthCostB?.mese || `2024-${b.mese.padStart(2, '0')}`;
                                                        
                                                        return fullMonthA.localeCompare(fullMonthB);
                                                    });
                                                    
                                                    // Prendi gli ultimi 6 elementi
                                                    return chartData.slice(-6);
                                                })()}>
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
                                            <ResponsiveContainer width="100%" height={400}>
                                                <PieChart>
                                                    <Pie
                                                        data={(() => {
                                                            // Usa le stesse categorie dettagliate del report
                                                            const costiPerCategoria: Record<string, number> = {};
                                                            
                                                            // Funzione helper per aggiungere un costo a una categoria
                                                            const aggiungiCategoria = (categoria: string, importo: number) => {
                                                                if (importo > 0) {
                                                                    costiPerCategoria[categoria] = (costiPerCategoria[categoria] || 0) + importo;
                                                                }
                                                            };
                                                            
                                                            // Processa costi mensili o singoli costi
                                                            const costiDaProcessare = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                                ? monthlyCosts.map(mc => mc.costs)
                                                                : [costs];
                                                            
                                                            costiDaProcessare.forEach((costData) => {
                                                                // Ristorazione
                                                                if (costData.ristorazione && Array.isArray(costData.ristorazione)) {
                                                                    const totale = costData.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
                                                                    aggiungiCategoria('Ristorazione', totale);
                                                                }
                                                                
                                                                // Utenze - Energia
                                                                if (costData.utenze?.energia?.importo) {
                                                                    aggiungiCategoria('Utenze - Energia', costData.utenze.energia.importo);
                                                                }
                                                                
                                                                // Utenze - Gas
                                                                if (costData.utenze?.gas?.importo) {
                                                                    aggiungiCategoria('Utenze - Gas', costData.utenze.gas.importo);
                                                                }
                                                                
                                                                // Utenze - Acqua
                                                                if (costData.utenze?.acqua?.importo) {
                                                                    aggiungiCategoria('Utenze - Acqua', costData.utenze.acqua.importo);
                                                                }
                                                                
                                                                // Personale - Buste Paga
                                                                if (costData.personale?.bustePaga) {
                                                                    aggiungiCategoria('Personale - Buste Paga', costData.personale.bustePaga);
                                                                }
                                                                
                                                                // Personale - Sicurezza
                                                                if (costData.personale?.sicurezza) {
                                                                    aggiungiCategoria('Personale - Sicurezza', costData.personale.sicurezza);
                                                                }
                                                                
                                                                // Personale - Contributi INPS
                                                                if (costData.personale?.contributiINPS) {
                                                                    aggiungiCategoria('Personale - Contributi INPS', costData.personale.contributiINPS);
                                                                }
                                                                
                                                                // Marketing - Costi Marketing
                                                                if (costData.marketing?.costiMarketing) {
                                                                    aggiungiCategoria('Marketing', costData.marketing.costiMarketing);
                                                                }
                                                                
                                                                // Marketing - Commissioni OTA
                                                                if (costData.marketing?.commissioniOTA) {
                                                                    aggiungiCategoria('Commissioni OTA', costData.marketing.commissioniOTA);
                                                                }
                                                                
                                                                // Altri Costi - mappali alle categorie originali in base alle chiavi
                                                                if (costData.altriCosti) {
                                                                    const mappingAltriCosti: Record<string, string> = {
                                                                        pulizie: 'Pulizie',
                                                                        manElettricista: 'Manutenzione - Elettricista',
                                                                        manIdraulico: 'Manutenzione - Idraulico',
                                                                        manCaldaia: 'Manutenzione - Caldaia/Aria Condizionata',
                                                                        manPiscina: 'Manutenzione - Piscina',
                                                                        ascensore: 'Manutenzione - Ascensore',
                                                                        ppc: 'Marketing - PPC',
                                                                        marketing: 'Marketing',
                                                                        telefono: 'Telefono/Internet',
                                                                        commercialista: 'Commercialista/Consulente',
                                                                        tari: 'Tasse',
                                                                        gestionale: 'Gestionale',
                                                                    };
                                                                    
                                                                    Object.entries(costData.altriCosti).forEach(([key, valore]) => {
                                                                        if (valore && valore > 0) {
                                                                            const categoriaNome = mappingAltriCosti[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                                                                            aggiungiCategoria(categoriaNome, valore);
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                            
                                                            const totale = Object.values(costiPerCategoria).reduce((sum, val) => sum + val, 0);
                                                            return Object.entries(costiPerCategoria)
                                                                .map(([name, value]) => ({ 
                                                                    name, 
                                                                    value,
                                                                    percent: totale > 0 ? (value / totale) * 100 : 0
                                                                }))
                                                                .sort((a, b) => b.value - a.value);
                                                        })()}
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={true}
                                                        label={(entry: any) => {
                                                            // Mostra etichetta solo se la percentuale è > 5% per evitare sovrapposizioni
                                                            if (entry.percent > 5) {
                                                                // Nome abbreviato se troppo lungo
                                                                const nome = entry.name.length > 15 ? entry.name.substring(0, 12) + '...' : entry.name;
                                                                return `${nome}\n${entry.percent.toFixed(1)}%`;
                                                            }
                                                            return '';
                                                        }}
                                                        outerRadius={100}
                                                        innerRadius={30}
                                                        fill="#8884d8"
                                                        dataKey="value"
                                                    >
                                                        {(() => {
                                                            const colors = [
                                                                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
                                                                '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
                                                                '#F97316', '#14B8A6', '#6366F1', '#A855F7'
                                                            ];
                                                            const data = (() => {
                                                                const costiPerCategoria: Record<string, number> = {};
                                                                const costiDaProcessare = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                                    ? monthlyCosts.map(mc => mc.costs)
                                                                    : [costs];
                                                                costiDaProcessare.forEach((costData) => {
                                                                    if (costData.ristorazione && Array.isArray(costData.ristorazione)) {
                                                                        const totale = costData.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
                                                                        if (totale > 0) costiPerCategoria['Ristorazione'] = (costiPerCategoria['Ristorazione'] || 0) + totale;
                                                                    }
                                                                    if (costData.utenze?.energia?.importo) costiPerCategoria['Utenze - Energia'] = (costiPerCategoria['Utenze - Energia'] || 0) + costData.utenze.energia.importo;
                                                                    if (costData.utenze?.gas?.importo) costiPerCategoria['Utenze - Gas'] = (costiPerCategoria['Utenze - Gas'] || 0) + costData.utenze.gas.importo;
                                                                    if (costData.utenze?.acqua?.importo) costiPerCategoria['Utenze - Acqua'] = (costiPerCategoria['Utenze - Acqua'] || 0) + costData.utenze.acqua.importo;
                                                                    if (costData.personale?.bustePaga) costiPerCategoria['Personale - Buste Paga'] = (costiPerCategoria['Personale - Buste Paga'] || 0) + costData.personale.bustePaga;
                                                                    if (costData.personale?.sicurezza) costiPerCategoria['Personale - Sicurezza'] = (costiPerCategoria['Personale - Sicurezza'] || 0) + costData.personale.sicurezza;
                                                                    if (costData.personale?.contributiINPS) costiPerCategoria['Personale - Contributi INPS'] = (costiPerCategoria['Personale - Contributi INPS'] || 0) + costData.personale.contributiINPS;
                                                                    if (costData.marketing?.costiMarketing) costiPerCategoria['Marketing'] = (costiPerCategoria['Marketing'] || 0) + costData.marketing.costiMarketing;
                                                                    if (costData.marketing?.commissioniOTA) costiPerCategoria['Commissioni OTA'] = (costiPerCategoria['Commissioni OTA'] || 0) + costData.marketing.commissioniOTA;
                                                                    if (costData.altriCosti) {
                                                                        Object.entries(costData.altriCosti).forEach(([key, valore]) => {
                                                                            if (valore && valore > 0) {
                                                                                const mappingAltriCosti: Record<string, string> = {
                                                                                    pulizie: 'Pulizie', manElettricista: 'Manutenzione - Elettricista', manIdraulico: 'Manutenzione - Idraulico',
                                                                                    manCaldaia: 'Manutenzione - Caldaia/Aria Condizionata', manPiscina: 'Manutenzione - Piscina', ascensore: 'Manutenzione - Ascensore',
                                                                                    ppc: 'Marketing - PPC', marketing: 'Marketing', telefono: 'Telefono/Internet',
                                                                                    commercialista: 'Commercialista/Consulente', tari: 'Tasse', gestionale: 'Gestionale',
                                                                                };
                                                                                const categoriaNome = mappingAltriCosti[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                                                                                costiPerCategoria[categoriaNome] = (costiPerCategoria[categoriaNome] || 0) + valore;
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                                return Object.entries(costiPerCategoria).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
                                                            })();
                                                            return data.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                                            ));
                                                        })()}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#F9FAFB' }}
                                                        formatter={(value: number, name: string) => [
                                                            `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                                            name
                                                        ]}
                                                    />
                                                    <Legend 
                                                        wrapperStyle={{ color: '#F9FAFB', fontSize: '12px' }}
                                                        iconSize={12}
                                                        verticalAlign="bottom"
                                                        height={36}
                                                    />
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

                        {/* Integrazione Fatture in Cloud */}
                        <div className="mb-6">
                            <FattureInCloudIntegration
                                selectedMonth={selectedMonth}
                                onImport={handleImportCosts}
                            />
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
                                    <div className="flex gap-3">
                                        {(costs && Object.keys(costs).length > 0) || monthlyCosts.some(mc => mc.mese === selectedMonth) ? (
                                            <button
                                                type="button"
                                                onClick={handleDeleteMonthCosts}
                                                disabled={saving}
                                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Cancella Mese
                                            </button>
                                        ) : null}
                                        <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-gray-600">
                                            {saving ? 'Salvataggio...' : 'Salva Costi Mese'}
                                        </button>
                                    </div>
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
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                     <div className="flex gap-2">
                                         <input type="number" step="0.01" value={costs.personale?.bustePaga || ''} onChange={(e) => handleInputChange('personale', 'bustePaga', '', e.target.value)} placeholder="Costo Totale Buste Paga €" className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                         <button
                                             onClick={() => setShowPayrollDialog(true)}
                                             className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition text-sm whitespace-nowrap"
                                             title="Carica PDF buste paga"
                                         >
                                             📄 PDF
                                         </button>
                                     </div>
                                     <input type="number" step="0.01" value={costs.personale?.sicurezza || ''} onChange={(e) => handleInputChange('personale', 'sicurezza', '', e.target.value)} placeholder="Aggiornamento Sicurezza Dipendenti €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                     <input type="number" step="0.01" value={costs.personale?.contributiINPS || ''} onChange={(e) => handleInputChange('personale', 'contributiINPS', '', e.target.value)} placeholder="Contributi INPS mensili €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                </div>
                            </div>
                            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Marketing</h3>
                                <div className="space-y-4">
                                     <input type="number" step="0.01" value={costs.marketing?.costiMarketing || ''} onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setCosts(prev => ({
                                            ...prev,
                                            marketing: {
                                                ...prev.marketing,
                                                costiMarketing: val
                                            }
                                        }));
                                     }} placeholder="Costi Marketing Totali €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                     <input type="number" step="0.01" value={costs.marketing?.commissioniOTA || ''} onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setCosts(prev => ({
                                            ...prev,
                                            marketing: {
                                                ...prev.marketing,
                                                commissioniOTA: val
                                            }
                                        }));
                                     }} placeholder="Commissioni OTA (Booking, Expedia, etc.) €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
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
                                        setMonthPickerType('costi');
                                        setShowMonthPicker(true);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2 mx-auto"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Aggiungi Mese
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
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={async () => {
                                        const costsToUse = monthlyCosts.length > 0 ? monthlyCosts : costs;
                                        await calculateAnalytics(costsToUse, revenues, hotelData || undefined);
                                        setToastMessage('Indici e metriche ricalcolati con successo!');
                                        setShowToast(true);
                                        setTimeout(() => setShowToast(false), 3000);
                                    }}
                                    disabled={analyzing || revenues.length === 0}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2"
                                    title="Ricalcola tutti gli indici e le metriche in base ai dati ricavi aggiornati"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Ricalcola
                                </button>
                                <button
                                    onClick={() => {
                                        setMonthPickerType('ricavi');
                                        setShowMonthPicker(true);
                                    }}
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Aggiungi Mese
                                </button>
                            </div>
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
                                <div className="md:col-span-1 lg:col-span-1">
                                    <label className="block text-sm font-medium text-white mb-2">
                                        <span className="inline-flex items-center">
                                            Posti Letto Totali
                                            <span className="ml-2 text-xs font-bold text-red-400 bg-red-400/20 px-2 py-1 rounded">OBBLIGATORIO</span>
                                        </span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={hotelData?.postiLettoTotali || ''}
                                        onChange={(e) => {
                                            const postiLettoTotali = parseInt(e.target.value) || undefined;
                                            const newData = { 
                                                ...hotelData, 
                                                postiLettoTotali,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel',
                                                camereTotali: hotelData?.camereTotali || 0
                                            };
                                            setHotelData(newData as HotelData);
                                            // Salva sempre, anche senza camereTotali, perché è un dato fondamentale
                                            handleSaveHotelData(newData);
                                        }}
                                        className="w-full bg-gray-700 border-2 border-blue-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Es. 100"
                                    />
                                    <p className="text-xs text-blue-300 mt-1 font-medium">
                                        ⚠️ DATO FONDAMENTALE: Numero totale di posti letto dell'hotel. 
                                        Essenziale per calcolare correttamente la percentuale di occupazione, RevPAR, TrevPAR e tutti gli altri indici KPI.
                                    </p>
                                    {hotelData?.postiLettoTotali && hotelData?.camereTotali && (
                                        <p className="text-xs text-green-300 mt-1">
                                            ✓ {hotelData.postiLettoTotali} posti letto ÷ {hotelData.camereTotali} camere = {(hotelData.postiLettoTotali / hotelData.camereTotali).toFixed(1)} posti letto per camera
                                        </p>
                                    )}
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Carattere Hotel</label>
                                    <select
                                        value={hotelData?.tipoHotel || ''}
                                        onChange={(e) => {
                                            const tipoHotel = e.target.value || undefined;
                                            const newData = { 
                                                ...hotelData, 
                                                tipoHotel: tipoHotel ? tipoHotel as 'annuale' | 'stagionale' : undefined,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel',
                                                camereTotali: hotelData?.camereTotali || 0,
                                                // Reset giorniApertura se si passa da stagionale ad annuale
                                                giorniApertura: tipoHotel === 'stagionale' ? hotelData?.giorniApertura : undefined
                                            };
                                            setHotelData(newData as HotelData);
                                            if (hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                handleSaveHotelData(newData);
                                            }
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="">Seleziona...</option>
                                        <option value="annuale">Annuale</option>
                                        <option value="stagionale">Stagionale</option>
                                    </select>
                                </div>
                                {hotelData?.tipoHotel === 'stagionale' && (
                                <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Giorni di Apertura</label>
                                    <input
                                        type="number"
                                        min="1"
                                            max="365"
                                            value={hotelData?.giorniApertura || ''}
                                        onChange={(e) => {
                                                const giorniApertura = parseInt(e.target.value) || undefined;
                                            const newData = { 
                                                ...hotelData, 
                                                    giorniApertura,
                                                hotelName: hotelName || hotelData?.hotelName || 'Mio Hotel',
                                                    camereTotali: hotelData?.camereTotali || 0,
                                                    tipoHotel: 'stagionale' as const
                                            };
                                            setHotelData(newData as HotelData);
                                            if (hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                handleSaveHotelData(newData);
                                            }
                                        }}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                            placeholder="Es. 120"
                                    />
                                        <p className="text-xs text-gray-400 mt-1">Numero di giorni di apertura durante l'anno</p>
                                </div>
                                )}
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
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Occupazione (%)
                                                    {hotelData?.camereTotali && revenue.giorniAperturaMese && (revenue.camereVendute || revenue.nottiTotali) && (
                                                        <span className="text-xs text-green-400 ml-2">(calcolata automaticamente)</span>
                                                    )}
                                                </label>
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
                                                    readOnly={!!(hotelData?.camereTotali && revenue.giorniAperturaMese && (revenue.camereVendute || revenue.nottiTotali))}
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {hotelData?.camereTotali && revenue.giorniAperturaMese && (revenue.camereVendute || revenue.nottiTotali)
                                                        ? revenue.camereVendute 
                                                            ? `Calcolata automaticamente: ${revenue.camereVendute} camere vendute / (${hotelData.camereTotali} camere × ${revenue.giorniAperturaMese} giorni apertura) × 100`
                                                            : `Calcolata automaticamente: ${revenue.nottiTotali} notti / (${hotelData.camereTotali} camere × ${revenue.giorniAperturaMese} giorni apertura) × 100`
                                                        : 'Inserisci manualmente oppure calcola automaticamente inserendo: Camere Totali, Giorni Apertura del Mese e Camere Vendute (o Notti Totali)'}
                                                </p>
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
                                                        const camereVendute = parseInt(e.target.value) || 0;
                                                        const revenueUpdated = { ...revenue, camereVendute };
                                                        
                                                        // Calcola automaticamente l'occupazione quando vengono inserite le camere vendute
                                                        const giorniAperturaMese = revenueUpdated.giorniAperturaMese || (hotelData?.tipoHotel === 'stagionale' ? 0 : 30);
                                                        if (giorniAperturaMese > 0 && hotelData?.camereTotali && hotelData.camereTotali > 0 && camereVendute > 0) {
                                                            const camereDisponibili = hotelData.camereTotali * giorniAperturaMese;
                                                            const occupazioneCalcolata = (camereVendute / camereDisponibili) * 100;
                                                            if (occupazioneCalcolata <= 100) {
                                                                revenueUpdated.occupazione = Math.round(occupazioneCalcolata * 10) / 10;
                                                            }
                                                        }
                                                        
                                                        updated[revenues.length - 1 - idx] = revenueUpdated;
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Numero totale di camere vendute nel mese. Usato per calcolare automaticamente l'occupazione.</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Notti Totali (Presenze)</label>
                                                <input
                                                    type="number"
                                                    value={revenue.nottiTotali || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        const nottiTotali = parseInt(e.target.value) || 0;
                                                        const revenueUpdated = { ...revenue, nottiTotali };
                                                        
                                                        // Calcola automaticamente l'occupazione se abbiamo i dati necessari (usa CAMERE, non posti letto)
                                                        const giorniAperturaMese = revenueUpdated.giorniAperturaMese || (hotelData?.tipoHotel === 'stagionale' ? 0 : 30);
                                                        if (giorniAperturaMese > 0 && hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                            // Usa camere vendute se disponibili (più accurato)
                                                            if (revenueUpdated.camereVendute && revenueUpdated.camereVendute > 0) {
                                                                const camereDisponibili = hotelData.camereTotali * giorniAperturaMese;
                                                                const occupazioneCalcolata = (revenueUpdated.camereVendute / camereDisponibili) * 100;
                                                                if (occupazioneCalcolata <= 100) {
                                                                    revenueUpdated.occupazione = Math.round(occupazioneCalcolata * 10) / 10;
                                                                }
                                                            }
                                                            // Altrimenti usa notti totali come alternativa
                                                            else if (nottiTotali > 0) {
                                                                const camereDisponibili = hotelData.camereTotali * giorniAperturaMese;
                                                                const occupazioneCalcolata = (nottiTotali / camereDisponibili) * 100;
                                                                if (occupazioneCalcolata <= 100) {
                                                                    revenueUpdated.occupazione = Math.round(occupazioneCalcolata * 10) / 10;
                                                                }
                                                            }
                                                        }
                                                        
                                                        updated[revenues.length - 1 - idx] = revenueUpdated;
                                                        setRevenues(updated);
                                                        handleSaveRevenues(revenueUpdated);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Numero totale di presenze (notti occupate). Usato per calcolare automaticamente l'occupazione.</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Giorni di Apertura del Mese
                                                    <span className="text-xs text-blue-400 ml-1">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={getMaxDaysInMonth(revenue.mese)}
                                                    value={revenue.giorniAperturaMese || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        const inputValue = e.target.value;
                                                        const giorniAperturaMese = inputValue ? parseInt(inputValue) : undefined;
                                                        
                                                        // Validazione: non può superare i giorni del mese
                                                        const maxDays = getMaxDaysInMonth(revenue.mese);
                                                        if (giorniAperturaMese && giorniAperturaMese > maxDays) {
                                                            setToastMessage(`Il mese selezionato ha un massimo di ${maxDays} giorni. Inserisci un valore valido (1-${maxDays}).`);
                                                            setShowToast(true);
                                                            setTimeout(() => setShowToast(false), 4000);
                                                            return; // Non aggiornare se il valore non è valido
                                                        }
                                                        
                                                        const revenueUpdated = { ...revenue, giorniAperturaMese };
                                                        
                                                        // Calcola automaticamente l'occupazione se abbiamo i dati necessari (usa CAMERE, non posti letto)
                                                        if (giorniAperturaMese && hotelData?.camereTotali && hotelData.camereTotali > 0) {
                                                            // Usa camere vendute se disponibili (più accurato)
                                                            if (revenueUpdated.camereVendute && revenueUpdated.camereVendute > 0) {
                                                                const camereDisponibili = hotelData.camereTotali * giorniAperturaMese;
                                                                const occupazioneCalcolata = (revenueUpdated.camereVendute / camereDisponibili) * 100;
                                                                if (occupazioneCalcolata <= 100) {
                                                                    revenueUpdated.occupazione = Math.round(occupazioneCalcolata * 10) / 10;
                                                                }
                                                            }
                                                            // Altrimenti usa notti totali come alternativa
                                                            else if (revenueUpdated.nottiTotali && revenueUpdated.nottiTotali > 0) {
                                                                const camereDisponibili = hotelData.camereTotali * giorniAperturaMese;
                                                                const occupazioneCalcolata = (revenueUpdated.nottiTotali / camereDisponibili) * 100;
                                                                if (occupazioneCalcolata <= 100) {
                                                                    revenueUpdated.occupazione = Math.round(occupazioneCalcolata * 10) / 10;
                                                                }
                                                            }
                                                        }
                                                        
                                                        updated[revenues.length - 1 - idx] = revenueUpdated;
                                                        setRevenues(updated);
                                                        handleSaveRevenues(revenueUpdated);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                    placeholder="Es. 28"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Giorni di apertura effettivi in questo mese (fondamentale per calcolo occupazione corretto). 
                                                    Massimo: {getMaxDaysInMonth(revenue.mese)} giorni per {new Date(revenue.mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}.
                                                </p>
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
                {activeSection === 'competitor' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Gestione Competitor</h2>
                        </div>
                        <CompetitorManager />
                    </div>
                )}
                {activeSection === 'raccomandazioni' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Consigli AI</h2>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => {
                                        const currentCosts = monthlyCosts.length > 0 ? monthlyCosts : costs;
                                        calculateAnalytics(currentCosts, revenues, hotelData || undefined);
                                    }}
                                    disabled={analyzing || (!monthlyCosts.length && !Object.keys(costs).length && !revenues.length)}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {analyzing ? 'Analisi in corso...' : 'Ricalcola Raccomandazioni'}
                                </button>
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

                               {/* Riepilogo Costi per Categoria */}
                               <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                   <h3 className="text-xl font-semibold text-white mb-4">Riepilogo Costi per Categoria</h3>
                                   <div className="space-y-4">
                                       {(() => {
                                           // Calcola costi totali per categoria (usando le categorie originali dell'utente)
                                           const costiPerCategoria: Record<string, number> = {};
                                           const totaleGenerale = kpi.totaleSpese;
                                           
                                           // Funzione helper per aggiungere un costo a una categoria
                                           const aggiungiCategoria = (categoria: string, importo: number) => {
                                               if (importo > 0) {
                                                   costiPerCategoria[categoria] = (costiPerCategoria[categoria] || 0) + importo;
                                               }
                                           };
                                           
                                           // Processa costi mensili o singoli costi
                                           const costiDaProcessare = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                               ? monthlyCosts.map(mc => mc.costs)
                                               : [costs];
                                           
                                           costiDaProcessare.forEach((costData) => {
                                               // Ristorazione
                                               if (costData.ristorazione && Array.isArray(costData.ristorazione)) {
                                                   const totale = costData.ristorazione.reduce((sum, item) => sum + (item.importo || 0), 0);
                                                   aggiungiCategoria('Ristorazione', totale);
                                               }
                                               
                                               // Utenze - Energia
                                               if (costData.utenze?.energia?.importo) {
                                                   aggiungiCategoria('Utenze - Energia', costData.utenze.energia.importo);
                                               }
                                               
                                               // Utenze - Gas
                                               if (costData.utenze?.gas?.importo) {
                                                   aggiungiCategoria('Utenze - Gas', costData.utenze.gas.importo);
                                               }
                                               
                                               // Utenze - Acqua
                                               if (costData.utenze?.acqua?.importo) {
                                                   aggiungiCategoria('Utenze - Acqua', costData.utenze.acqua.importo);
                                               }
                                               
                                               // Personale - Buste Paga
                                               if (costData.personale?.bustePaga) {
                                                   aggiungiCategoria('Personale - Buste Paga', costData.personale.bustePaga);
                                               }
                                               
                                               // Personale - Sicurezza
                                               if (costData.personale?.sicurezza) {
                                                   aggiungiCategoria('Personale - Sicurezza', costData.personale.sicurezza);
                                               }
                                               
                                               // Marketing - Costi Marketing
                                               if (costData.marketing?.costiMarketing) {
                                                   aggiungiCategoria('Marketing', costData.marketing.costiMarketing);
                                               }
                                               
                                               // Marketing - Commissioni OTA
                                               if (costData.marketing?.commissioniOTA) {
                                                   aggiungiCategoria('Commissioni OTA', costData.marketing.commissioniOTA);
                                               }
                                               
                                               // Altri Costi - mappali alle categorie originali in base alle chiavi
                                               if (costData.altriCosti) {
                                                   const mappingAltriCosti: Record<string, string> = {
                                                       pulizie: 'Pulizie',
                                                       manElettricista: 'Manutenzione - Elettricista',
                                                       manIdraulico: 'Manutenzione - Idraulico',
                                                       manCaldaia: 'Manutenzione - Caldaia/Aria Condizionata',
                                                       manPiscina: 'Manutenzione - Piscina',
                                                       ascensore: 'Manutenzione - Ascensore',
                                                       ppc: 'Marketing - PPC',
                                                       marketing: 'Marketing',
                                                       telefono: 'Telefono/Internet',
                                                       commercialista: 'Commercialista/Consulente',
                                                       tari: 'Tasse',
                                                       gestionale: 'Gestionale',
                                                   };
                                                   
                                                   Object.entries(costData.altriCosti).forEach(([key, valore]) => {
                                                       if (valore && valore > 0) {
                                                           const categoriaNome = mappingAltriCosti[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
                                                           aggiungiCategoria(categoriaNome, valore);
                                                       }
                                                   });
                                               }
                                           });
                                           
                                           // Mostra tutte le categorie, anche quelle con valore 0
                                           // Ordina prima per valore (decrescente), poi mostra quelle con 0 alla fine
                                           const categorieConValore = Object.entries(costiPerCategoria)
                                               .filter(([_, valore]) => valore > 0)
                                               .sort(([_, a], [__, b]) => b - a);
                                           const categorieSenzaValore = Object.entries(costiPerCategoria)
                                               .filter(([_, valore]) => valore === 0)
                                               .sort(([a], [b]) => a.localeCompare(b));
                                           const tutteCategorie = [...categorieConValore, ...categorieSenzaValore];
                                           
                                           return (
                                               <div className="space-y-3">
                                                   {tutteCategorie.map(([categoria, valore]) => {
                                                       const percentuale = totaleGenerale > 0 ? (valore / totaleGenerale) * 100 : 0;
                                                       const haValore = valore > 0;
                                                       return (
                                                           <div key={categoria} className={`bg-gray-900/50 rounded-lg p-4 ${!haValore ? 'opacity-60' : ''}`}>
                                                               <div className="flex justify-between items-center mb-2">
                                                                   <span className={`font-medium ${haValore ? 'text-white' : 'text-gray-500'}`}>
                                                                       {categoria}
                                                                       {!haValore && <span className="text-xs ml-2 text-gray-600">(nessun costo inserito)</span>}
                                                                   </span>
                                                                   <span className={`text-xl font-bold ${haValore ? 'text-white' : 'text-gray-600'}`}>
                                                                       €{valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                   </span>
                                                               </div>
                                                               {haValore && (
                                                                   <div className="flex items-center gap-2">
                                                                       <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                                                           <div 
                                                                               className="h-full bg-blue-500 transition-all duration-300"
                                                                               style={{ width: `${percentuale}%` }}
                                                                           ></div>
                                                                       </div>
                                                                       <span className="text-sm text-gray-400 w-16 text-right">{percentuale.toFixed(1)}%</span>
                                                                   </div>
                                                               )}
                                                           </div>
                                                       );
                                                   })}
                                                   <div className="pt-4 border-t border-gray-700 mt-4">
                                                       <div className="flex justify-between items-center">
                                                           <span className="text-lg font-semibold text-white">Totale Generale</span>
                                                           <span className="text-2xl font-bold text-green-400">€{totaleGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                       </div>
                                                   </div>
                                               </div>
                                           );
                                       })()}
                                   </div>
                               </div>

                               {/* Export Button */}
                               <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
                                   <div className="flex gap-4">
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
                                       <button
                                           onClick={() => {
                                               // Calcola costi per categoria
                                               const ristorazioneTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                   ? monthlyCosts.reduce((sum, mc) => sum + (mc.costs.ristorazione?.reduce((s, item) => s + (item.importo || 0), 0) || 0), 0)
                                                   : (costs.ristorazione?.reduce((sum, item) => sum + (item.importo || 0), 0) || 0);
                                               
                                               const utenzeTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                   ? monthlyCosts.reduce((sum, mc) => {
                                                       const ut = mc.costs.utenze;
                                                       return sum + (ut?.energia?.importo || 0) + (ut?.gas?.importo || 0) + (ut?.acqua?.importo || 0);
                                                   }, 0)
                                                   : ((costs.utenze?.energia?.importo || 0) + (costs.utenze?.gas?.importo || 0) + (costs.utenze?.acqua?.importo || 0));
                                               
                                               const personaleTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                   ? monthlyCosts.reduce((sum, mc) => {
                                                       const pers = mc.costs.personale;
                                                       return sum + (pers?.bustePaga || 0) + (pers?.sicurezza || 0) + (pers?.contributiINPS || 0);
                                                   }, 0)
                                                   : ((costs.personale?.bustePaga || 0) + (costs.personale?.sicurezza || 0) + (costs.personale?.contributiINPS || 0));
                                               
                                               const marketingTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                   ? monthlyCosts.reduce((sum, mc) => {
                                                       const mark = mc.costs.marketing;
                                                       return sum + (mark?.costiMarketing || 0) + (mark?.commissioniOTA || 0);
                                                   }, 0)
                                                   : ((costs.marketing?.costiMarketing || 0) + (costs.marketing?.commissioniOTA || 0));
                                               
                                               const altriCostiTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                   ? monthlyCosts.reduce((sum, mc) => sum + (mc.costs.altriCosti ? Object.values(mc.costs.altriCosti).reduce((s, v) => s + (v || 0), 0) : 0), 0)
                                                   : (costs.altriCosti ? Object.values(costs.altriCosti).reduce((sum, val) => sum + (val || 0), 0) : 0);
                                               
                                               const totaleGenerale = kpi.totaleSpese;
                                               const percentualeRistorazione = totaleGenerale > 0 ? (ristorazioneTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                               const percentualeUtenze = totaleGenerale > 0 ? (utenzeTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                               const percentualePersonale = totaleGenerale > 0 ? (personaleTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                               const percentualeMarketing = totaleGenerale > 0 ? (marketingTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                               const percentualeAltri = totaleGenerale > 0 ? (altriCostiTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                               
                                               // Genera report testuale
                                               let reportText = `╔═══════════════════════════════════════════════════════╗\n`;
                                               reportText += `║    REPORT COSTI PER CATEGORIA - ${hotelName.padEnd(20)}║\n`;
                                               reportText += `╚═══════════════════════════════════════════════════════╝\n\n`;
                                               reportText += `Periodo analizzato: ${revenues[revenues.length - 1]?.mese || 'N/A'}\n`;
                                               reportText += `Data generazione: ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\n`;
                                               
                                               reportText += `RIEPILOGO COSTI PER CATEGORIA\n`;
                                               reportText += `${'═'.repeat(60)}\n\n`;
                                               
                                               const categorie = [
                                                   { nome: 'Ristorazione', valore: ristorazioneTotale, percentuale: percentualeRistorazione },
                                                   { nome: 'Utenze', valore: utenzeTotale, percentuale: percentualeUtenze },
                                                   { nome: 'Personale', valore: personaleTotale, percentuale: percentualePersonale },
                                                   { nome: 'Marketing', valore: marketingTotale, percentuale: percentualeMarketing },
                                                   { nome: 'Altri Costi', valore: altriCostiTotale, percentuale: percentualeAltri },
                                               ].filter(cat => cat.valore > 0).sort((a, b) => b.valore - a.valore);
                                               
                                               categorie.forEach((cat) => {
                                                   reportText += `${cat.nome.padEnd(20)} €${cat.valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15)} (${cat.percentuale}%)\n`;
                                               });
                                               
                                               reportText += `${'-'.repeat(60)}\n`;
                                               reportText += `TOTALE GENERALE${' '.repeat(27)} €${totaleGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(15)}\n\n`;
                                               
                                               const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
                                               const url = URL.createObjectURL(blob);
                                               const a = document.createElement('a');
                                               a.href = url;
                                               a.download = `report-costi-${hotelName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
                                               a.click();
                                               URL.revokeObjectURL(url);
                                           }}
                                           className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition"
                                       >
                                           Esporta Riepilogo Costi (TXT)
                                       </button>
                                       <button
                                           onClick={async () => {
                                               try {
                                                   // Import dinamico di jsPDF
                                                   const { jsPDF } = await import('jspdf');
                                                   const doc = new jsPDF({
                                                       orientation: 'portrait',
                                                       unit: 'mm',
                                                       format: 'a4'
                                                   });

                                                   const pageWidth = doc.internal.pageSize.getWidth();
                                                   const pageHeight = doc.internal.pageSize.getHeight();
                                                   const margin = 15;
                                                   let yPos = margin;
                                                   
                                                   // Colori del tema
                                                   const primaryColor: [number, number, number] = [59, 130, 246]; // blue-500
                                                   const secondaryColor: [number, number, number] = [147, 197, 253]; // blue-300
                                                   const darkColor: [number, number, number] = [31, 41, 55]; // gray-800
                                                   const textColor: [number, number, number] = [17, 24, 39]; // gray-900
                                                   const lightGray: [number, number, number] = [229, 231, 235]; // gray-200
                                                   const greenColor: [number, number, number] = [16, 185, 129]; // green-500
                                                   const redColor: [number, number, number] = [239, 68, 68]; // red-500

                                                   // Helper per aggiungere nuova pagina se necessario
                                                   const checkPageBreak = (requiredSpace: number) => {
                                                       if (yPos + requiredSpace > pageHeight - margin) {
                                                           doc.addPage();
                                                           yPos = margin;
                                                           return true;
                                                       }
                                                       return false;
                                                   };

                                                   // Header con logo e titolo
                                                   doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                                   doc.rect(0, 0, pageWidth, 40, 'F');
                                                   
                                                   // Disegna logo (cerchio con gradient e icone)
                                                   const logoSize = 16;
                                                   const logoX = margin;
                                                   const logoY = 12;
                                                   
                                                   // Cerchio di sfondo con gradiente (approssimato)
                                                   doc.setFillColor(59, 130, 246); // blue-500
                                                   doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 'F');
                                                   
                                                   // Barre del grafico (rappresentano crescita)
                                                   doc.setFillColor(255, 255, 255);
                                                   const barWidth = 1.2;
                                                   const barSpacing = 1.5;
                                                   const barsStartX = logoX + 4;
                                                   const barsStartY = logoY + 8;
                                                   doc.rect(barsStartX, barsStartY + 4, barWidth, 3, 'F'); // Barra 1
                                                   doc.rect(barsStartX + barSpacing, barsStartY + 2, barWidth, 5, 'F'); // Barra 2
                                                   doc.rect(barsStartX + barSpacing * 2, barsStartY, barWidth, 7, 'F'); // Barra 3
                                                   doc.rect(barsStartX + barSpacing * 3, barsStartY - 1, barWidth, 9, 'F'); // Barra 4
                                                   doc.rect(barsStartX + barSpacing * 4, barsStartY - 2, barWidth, 11, 'F'); // Barra 5
                                                   
                                                   // Simbolo Euro semplificato (E)
                                                   doc.setFontSize(8);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.setTextColor(255, 255, 255);
                                                   doc.text('€', logoX + logoSize / 2, logoY + 4.5, { align: 'center' });
                                                   
                                                   // Nome del sito con grafica migliorata
                                                   const textStartX = logoX + logoSize + 6;
                                                   doc.setFontSize(24);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.setTextColor(255, 255, 255);
                                                   doc.text('Revenue', textStartX, 18);
                                                   
                                                   doc.setFontSize(18);
                                                   doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                                                   doc.text('Sentry', textStartX, 26);
                                                   
                                                   doc.setFontSize(20);
                                                   doc.setTextColor(255, 255, 255);
                                                   doc.text('Report Completo', pageWidth - margin, 20, { align: 'right' });
                                                   
                                                   doc.setFontSize(10);
                                                   doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                                                   const dataGen = new Date().toLocaleDateString('it-IT', { 
                                                       day: '2-digit', 
                                                       month: '2-digit', 
                                                       year: 'numeric',
                                                       hour: '2-digit',
                                                       minute: '2-digit'
                                                   });
                                                   doc.text(`Generato il: ${dataGen}`, pageWidth - margin, 30, { align: 'right' });
                                                   doc.text(`Hotel: ${hotelName}`, pageWidth - margin, 35, { align: 'right' });

                                                   yPos = 50; // Spazio dopo header
                                                   
                                                   // Aggiungi spazio extra per evitare sovrapposizioni
                                                   checkPageBreak(30);

                                                   // ========== SEZIONE 1: PANORAMICA (KPI) ==========
                                                   doc.setFontSize(16);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                   doc.text('1. PANORAMICA - INDICATORI CHIAVE', margin, yPos);
                                                   yPos += 8;

                                                   // Box per KPI
                                                   checkPageBreak(40);
                                                   doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                   doc.roundedRect(margin, yPos - 5, pageWidth - (margin * 2), 35, 3, 3, 'F');
                                                   yPos += 5;

                                                   doc.setFontSize(10);
                                                   doc.setFont('helvetica', 'normal');
                                                   doc.setTextColor(textColor[0], textColor[1], textColor[2]);

                                                   if (kpi) {
                                                       const kpiData = [
                                                           [`RevPAR: €${kpi.revpar.toFixed(2)}`, `Occupazione: ${kpi.occupazione.toFixed(1)}%`],
                                                           [`ADR: €${kpi.adr.toFixed(2)}`, `TRevPAR: €${kpi.trevpar?.toFixed(2) || '0.00'}`],
                                                           [`GOP: €${kpi.gop.toLocaleString('it-IT')}`, `GOP Margin: ${kpi.gopMargin.toFixed(1)}%`],
                                                           [`CPOR: €${kpi.cpor?.toFixed(2) || '0.00'}`, kpi.goppar ? `GOPPAR: €${kpi.goppar.toFixed(2)}` : '']
                                                       ];

                                                       kpiData.forEach((row, idx) => {
                                                           if (row[0]) doc.text(row[0], margin + 5, yPos);
                                                           if (row[1]) doc.text(row[1], margin + 100, yPos);
                                                           if (idx < kpiData.length - 1) yPos += 6;
                                                       });
                                                   }

                                                   yPos += 15;

                                                   // ========== SEZIONE 2: CONSIGLI AI ==========
                                                   checkPageBreak(30);
                                                   doc.setFontSize(16);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.text('2. CONSIGLI AI', margin, yPos);
                                                   yPos += 8;

                                                   if (recommendations && recommendations.length > 0) {
                                                       recommendations.slice(0, 5).forEach((rec, idx) => {
                                                           checkPageBreak(25);
                                                           
                                                           if (idx % 2 === 0) {
                                                               doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                           } else {
                                                               doc.setFillColor(255, 255, 255);
                                                           }
                                                           doc.roundedRect(margin, yPos - 5, pageWidth - (margin * 2), 20, 3, 3, 'F');
                                                           
                                                           doc.setFontSize(11);
                                                           doc.setFont('helvetica', 'bold');
                                                           doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                                           const titleLines = doc.splitTextToSize(rec.titolo || `Consiglio ${idx + 1}`, pageWidth - (margin * 2) - 10);
                                                           doc.text(titleLines[0], margin + 5, yPos);
                                                           
                                                           yPos += 6;
                                                           doc.setFontSize(9);
                                                           doc.setFont('helvetica', 'normal');
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           const descLines = doc.splitTextToSize(rec.descrizione || '', pageWidth - (margin * 2) - 10);
                                                           doc.text(descLines.slice(0, 2), margin + 5, yPos);
                                                           
                                                           yPos += 12;
                                                       });
                                                   } else {
                                                       doc.setFontSize(10);
                                                       doc.setTextColor(128, 128, 128);
                                                       doc.text('Nessun consiglio disponibile. Inserisci dati e ricalcola le analisi.', margin, yPos);
                                                       yPos += 8;
                                                   }

                                                   yPos += 10;

                                                   // ========== SEZIONE 3: REPORT SPESE ==========
                                                   checkPageBreak(50);
                                                   doc.setFontSize(16);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.text('3. REPORT SPESE PER CATEGORIA', margin, yPos);
                                                   yPos += 8;

                                                   // Calcola costi per categoria
                                                   const ristorazioneTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => sum + (mc.costs.ristorazione?.reduce((s, item) => s + (item.importo || 0), 0) || 0), 0)
                                                       : (costs.ristorazione?.reduce((sum, item) => sum + (item.importo || 0), 0) || 0);
                                                   
                                                   const utenzeTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const ut = mc.costs.utenze;
                                                           return sum + (ut?.energia?.importo || 0) + (ut?.gas?.importo || 0) + (ut?.acqua?.importo || 0);
                                                       }, 0)
                                                       : ((costs.utenze?.energia?.importo || 0) + (costs.utenze?.gas?.importo || 0) + (costs.utenze?.acqua?.importo || 0));
                                                   
                                                   const personaleTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const pers = mc.costs.personale;
                                                           return sum + (pers?.bustePaga || 0) + (pers?.sicurezza || 0);
                                                       }, 0)
                                                       : ((costs.personale?.bustePaga || 0) + (costs.personale?.sicurezza || 0) + (costs.personale?.contributiINPS || 0));
                                                   
                                                   const marketingTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const mark = mc.costs.marketing;
                                                           return sum + (mark?.costiMarketing || 0) + (mark?.commissioniOTA || 0);
                                                       }, 0)
                                                       : ((costs.marketing?.costiMarketing || 0) + (costs.marketing?.commissioniOTA || 0));
                                                   
                                                   const altriCostiTotale = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => sum + (mc.costs.altriCosti ? Object.values(mc.costs.altriCosti).reduce((s, v) => s + (v || 0), 0) : 0), 0)
                                                       : (costs.altriCosti ? Object.values(costs.altriCosti).reduce((sum, val) => sum + (val || 0), 0) : 0);
                                                   
                                                   const totaleGenerale = kpi?.totaleSpese || 0;
                                                   const percentualeRistorazione = totaleGenerale > 0 ? (ristorazioneTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                                   const percentualeUtenze = totaleGenerale > 0 ? (utenzeTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                                   const percentualePersonale = totaleGenerale > 0 ? (personaleTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                                   const percentualeMarketing = totaleGenerale > 0 ? (marketingTotale / totaleGenerale * 100).toFixed(1) : '0.0';
                                                   const percentualeAltri = totaleGenerale > 0 ? (altriCostiTotale / totaleGenerale * 100).toFixed(1) : '0.0';

                                                   // Header tabella
                                                   checkPageBreak(40);
                                                   doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
                                                   doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 7, 'F');
                                                   doc.setTextColor(255, 255, 255);
                                                   doc.setFontSize(9);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.text('Categoria', margin + 5, yPos);
                                                   doc.text('Importo', margin + 100, yPos, { align: 'right' });
                                                   doc.text('%', pageWidth - margin - 5, yPos, { align: 'right' });
                                                   yPos += 5;

                                                   // Dati tabella
                                                   doc.setFont('helvetica', 'normal');
                                                   doc.setFontSize(9);
                                                   const categorie = [
                                                       { nome: 'Ristorazione', valore: ristorazioneTotale, percentuale: percentualeRistorazione },
                                                       { nome: 'Utenze', valore: utenzeTotale, percentuale: percentualeUtenze },
                                                       { nome: 'Personale', valore: personaleTotale, percentuale: percentualePersonale },
                                                       { nome: 'Marketing', valore: marketingTotale, percentuale: percentualeMarketing },
                                                       { nome: 'Altri Costi', valore: altriCostiTotale, percentuale: percentualeAltri },
                                                   ].filter(cat => cat.valore > 0).sort((a, b) => b.valore - a.valore);

                                                   categorie.forEach((cat, idx) => {
                                                       checkPageBreak(7);
                                                       if (idx % 2 === 0) {
                                                           doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                       } else {
                                                           doc.setFillColor(255, 255, 255);
                                                       }
                                                       doc.rect(margin, yPos - 4, pageWidth - (margin * 2), 5, 'F');
                                                       
                                                       doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                       doc.text(cat.nome, margin + 5, yPos);
                                                       doc.text(`€${cat.valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 100, yPos, { align: 'right' });
                                                       doc.text(`${cat.percentuale}%`, pageWidth - margin - 5, yPos, { align: 'right' });
                                                       yPos += 6;
                                                   });

                                                   // Totale
                                                   checkPageBreak(8);
                                                   doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                                   doc.setLineWidth(0.5);
                                                   doc.line(margin, yPos, pageWidth - margin, yPos);
                                                   yPos += 3;
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.setFontSize(10);
                                                   doc.text('TOTALE', margin + 5, yPos);
                                                   doc.text(`€${totaleGenerale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 100, yPos, { align: 'right' });
                                                   yPos += 10;

                                                   // ========== SEZIONE 4: REPORT RICAVI ==========
                                                   checkPageBreak(50);
                                                   doc.setFontSize(16);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.text('4. REPORT RICAVI MENSILI', margin, yPos);
                                                   yPos += 8;

                                                   if (revenues && revenues.length > 0) {
                                                       // Header tabella ricavi
                                                       checkPageBreak(30);
                                                       doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
                                                       doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 7, 'F');
                                                       doc.setTextColor(255, 255, 255);
                                                       doc.setFontSize(8);
                                                       doc.setFont('helvetica', 'bold');
                                                       doc.text('Mese', margin + 5, yPos);
                                                       doc.text('Ricavi', margin + 50, yPos);
                                                       doc.text('Occup.', margin + 80, yPos);
                                                       doc.text('ADR', margin + 100, yPos);
                                                       doc.text('Camere', pageWidth - margin - 5, yPos, { align: 'right' });
                                                       yPos += 5;

                                                       // Dati ricavi (ultimi 6 mesi o tutti)
                                                       doc.setFont('helvetica', 'normal');
                                                       doc.setFontSize(8);
                                                       revenues.slice().reverse().slice(0, 6).forEach((rev, idx) => {
                                                           checkPageBreak(6);
                                                           if (idx % 2 === 0) {
                                                               doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                           } else {
                                                               doc.setFillColor(255, 255, 255);
                                                           }
                                                           doc.rect(margin, yPos - 4, pageWidth - (margin * 2), 5, 'F');
                                                           
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           const meseFormatted = new Date(rev.mese + '-01').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
                                                           doc.text(meseFormatted, margin + 5, yPos);
                                                           doc.text(`€${rev.entrateTotali.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, margin + 50, yPos);
                                                           doc.text(`${rev.occupazione.toFixed(1)}%`, margin + 80, yPos);
                                                           doc.text(`€${rev.prezzoMedioCamera.toFixed(0)}`, margin + 100, yPos);
                                                           doc.text(rev.camereVendute.toString(), pageWidth - margin - 5, yPos, { align: 'right' });
                                                           yPos += 6;
                                                       });
                                                   } else {
                                                       doc.setFontSize(10);
                                                       doc.setTextColor(128, 128, 128);
                                                       doc.text('Nessun dato ricavi disponibile.', margin, yPos);
                                                       yPos += 8;
                                                   }

                                                   // Footer
                                                   const totalPages = doc.internal.pages.length - 1;
                                                   for (let i = 1; i <= totalPages; i++) {
                                                       doc.setPage(i);
                                                       doc.setFontSize(8);
                                                       doc.setTextColor(128, 128, 128);
                                                       doc.text(
                                                           `Pagina ${i} di ${totalPages} - RevenueSentry Report`,
                                                           pageWidth / 2,
                                                           pageHeight - 10,
                                                           { align: 'center' }
                                                       );
                                                   }

                                                   // ========== SEZIONE 5: GRAFICI ==========
                                                   checkPageBreak(80);
                                                   yPos += 10; // Spazio extra prima della sezione grafici
                                                   doc.setFontSize(16);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.text('5. GRAFICI ANALITICI', margin, yPos);
                                                   yPos += 15; // Spazio dopo titolo sezione

                                                   // Grafico 1: Ricavi e Spese nel Tempo (LineChart)
                                                   if (revenues && revenues.length > 0) {
                                                       checkPageBreak(70); // Controlla spazio per titolo + grafico + legenda
                                                       yPos += 8; // Spazio extra prima del titolo
                                                       doc.setFontSize(12);
                                                       doc.setFont('helvetica', 'bold');
                                                       doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                       doc.text('Ricavi e Spese nel Tempo', margin, yPos);
                                                       yPos += 10; // Spazio dopo titolo prima del grafico

                                                       // Prepara dati
                                                       const chartData: Array<{ mese: string; ricavi: number; spese: number }> = [];
                                                       const recentRevenues = revenues.slice(-6);
                                                       
                                                       recentRevenues.forEach(revenue => {
                                                           const monthKey = revenue.mese;
                                                           const monthCosts = monthlyCosts.find(mc => mc.mese === monthKey);
                                                           const speseMese = monthCosts ? calculateTotalCostsForMonth(monthCosts.costs) : 0;
                                                           
                                                           chartData.push({
                                                               mese: new Date(monthKey + '-01').toLocaleDateString('it-IT', { month: 'short' }),
                                                               ricavi: revenue.entrateTotali || 0,
                                                               spese: speseMese,
                                                           });
                                                       });

                                                       if (chartData.length > 0) {
                                                           const chartWidth = pageWidth - (margin * 2);
                                                           const chartHeight = 40;
                                                           const chartX = margin;
                                                           // Assicura che il grafico non vada sopra
                                                           checkPageBreak(chartHeight + 15); // Grafico + etichette + legenda
                                                           const chartY = yPos + chartHeight; // Grafico disegnato verso l'alto da yPos
                                                           
                                                           // Trova valori max per scala
                                                           const maxValue = Math.max(
                                                               ...chartData.map(d => Math.max(d.ricavi, d.spese)),
                                                               1000
                                                           );
                                                           const scale = chartHeight / maxValue;
                                                           
                                                           // Disegna assi
                                                           doc.setDrawColor(textColor[0], textColor[1], textColor[2]);
                                                           doc.setLineWidth(0.5);
                                                           doc.line(chartX, chartY, chartX + chartWidth, chartY); // X axis (linea base)
                                                           doc.line(chartX, chartY - chartHeight, chartX, chartY); // Y axis
                                                           
                                                           // Etichette Y (a sinistra dell'asse Y)
                                                           doc.setFontSize(7);
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           for (let i = 0; i <= 4; i++) {
                                                               const value = (maxValue / 4) * i;
                                                               const y = chartY - (chartHeight / 4) * i;
                                                               doc.text(`€${Math.round(value / 1000)}k`, chartX - 8, y, { align: 'right' });
                                                           }
                                                           
                                                           // Disegna linee
                                                           const stepX = chartWidth / (chartData.length - 1 || 1);
                                                           const blueColor: [number, number, number] = [59, 130, 246];
                                                           const redColorChart: [number, number, number] = [239, 68, 68];
                                                           
                                                           // Linea Ricavi
                                                           doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
                                                           doc.setFillColor(blueColor[0], blueColor[1], blueColor[2]);
                                                           doc.setLineWidth(1.5);
                                                           for (let i = 0; i < chartData.length - 1; i++) {
                                                               const x1 = chartX + stepX * i;
                                                               const y1 = chartY - chartData[i].ricavi * scale;
                                                               const x2 = chartX + stepX * (i + 1);
                                                               const y2 = chartY - chartData[i + 1].ricavi * scale;
                                                               doc.line(x1, y1, x2, y2);
                                                               doc.circle(x1, y1, 1, 'F');
                                                           }
                                                           if (chartData.length > 0) {
                                                               const lastX = chartX + stepX * (chartData.length - 1);
                                                               const lastY = chartY - chartData[chartData.length - 1].ricavi * scale;
                                                               doc.circle(lastX, lastY, 1, 'F');
                                                           }
                                                           
                                                           // Linea Spese
                                                           doc.setDrawColor(redColorChart[0], redColorChart[1], redColorChart[2]);
                                                           doc.setFillColor(redColorChart[0], redColorChart[1], redColorChart[2]);
                                                           doc.setLineWidth(1.5);
                                                           for (let i = 0; i < chartData.length - 1; i++) {
                                                               const x1 = chartX + stepX * i;
                                                               const y1 = chartY - chartData[i].spese * scale;
                                                               const x2 = chartX + stepX * (i + 1);
                                                               const y2 = chartY - chartData[i + 1].spese * scale;
                                                               doc.line(x1, y1, x2, y2);
                                                               doc.circle(x1, y1, 1, 'F');
                                                           }
                                                           
                                                           // Etichette X (mesi sotto il grafico)
                                                           doc.setFontSize(8);
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           chartData.forEach((d, i) => {
                                                               const x = chartX + stepX * i;
                                                               doc.text(d.mese, x, chartY + 5, { align: 'center' });
                                                           });
                                                           
                                                           // Legenda (sotto le etichette X)
                                                           yPos = chartY + 18; // Aggiorna yPos dopo etichette X
                                                           doc.setFontSize(8);
                                                           doc.setFillColor(blueColor[0], blueColor[1], blueColor[2]);
                                                           doc.rect(chartX + 10, yPos - 2, 3, 3, 'F');
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           doc.text('Ricavi', chartX + 15, yPos);
                                                           
                                                           doc.setFillColor(redColorChart[0], redColorChart[1], redColorChart[2]);
                                                           doc.rect(chartX + 40, yPos - 2, 3, 3, 'F');
                                                           doc.text('Spese', chartX + 45, yPos);
                                                           
                                                           yPos += 12; // Spazio dopo il grafico completo
                                                       }
                                                   }

                                                   // Grafico 2: Comparazione KPI vs Benchmark
                                                   if (kpi) {
                                                       checkPageBreak(70); // Controlla spazio per titolo + grafico + legenda
                                                       yPos += 10; // Spazio extra prima del titolo
                                                       doc.setFontSize(12);
                                                       doc.setFont('helvetica', 'bold');
                                                       doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                       doc.text('Comparazione KPI vs Benchmark Settore', margin, yPos);
                                                       yPos += 10; // Spazio dopo titolo prima del grafico

                                                       const benchmarkRevpar = 60;
                                                       const benchmarkOccupazione = 65;
                                                       const benchmarkGOPMargin = 25;
                                                       
                                                       const kpiComparisons = [
                                                           { nome: 'RevPAR', tuo: kpi.revpar, benchmark: benchmarkRevpar },
                                                           { nome: 'Occupazione', tuo: kpi.occupazione, benchmark: benchmarkOccupazione },
                                                           { nome: 'GOP Margin', tuo: kpi.gopMargin, benchmark: benchmarkGOPMargin },
                                                       ];

                                                       const barChartWidth = pageWidth - (margin * 2);
                                                       const barChartHeight = 35;
                                                       checkPageBreak(barChartHeight + 20); // Grafico + etichette + legenda
                                                       const barChartX = margin;
                                                       const barChartY = yPos + barChartHeight; // Barre verso l'alto da yPos
                                                       const maxBarValue = Math.max(...kpiComparisons.map(k => Math.max(k.tuo, k.benchmark)));
                                                       
                                                       kpiComparisons.forEach((comp, idx) => {
                                                           const barX = barChartX + (barChartWidth / kpiComparisons.length) * idx + 5;
                                                           const barWidth = (barChartWidth / kpiComparisons.length) - 10;
                                                           const scale = barChartHeight / maxBarValue;
                                                           
                                                           // Barra Benchmark
                                                           doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                           const benchHeight = comp.benchmark * scale;
                                                           doc.rect(barX, barChartY - benchHeight, barWidth / 2 - 2, benchHeight, 'F');
                                                           
                                                           // Barra Tuo
                                                           const tuoHeight = comp.tuo * scale;
                                                           const colorRatio = comp.tuo / comp.benchmark;
                                                           if (colorRatio >= 1) {
                                                               doc.setFillColor(greenColor[0], greenColor[1], greenColor[2]);
                                                           } else if (colorRatio >= 0.7) {
                                                               doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                                           } else {
                                                               doc.setFillColor(redColor[0], redColor[1], redColor[2]);
                                                           }
                                                           doc.rect(barX + barWidth / 2 + 2, barChartY - tuoHeight, barWidth / 2 - 2, tuoHeight, 'F');
                                                           
                                                           // Valori
                                                           doc.setFontSize(7);
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           doc.text(comp.nome, barX + barWidth / 2, barChartY + 3, { align: 'center' });
                                                           doc.text(`${comp.tuo.toFixed(1)}${comp.nome === 'Occupazione' || comp.nome === 'GOP Margin' ? '%' : '€'}`, barX + barWidth / 2, barChartY - tuoHeight - 2, { align: 'center' });
                                                       });
                                                       
                                                           // Legenda (sotto il grafico)
                                                       yPos = barChartY + 15; // Aggiorna yPos dopo il grafico
                                                       doc.setFontSize(8);
                                                       doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                                                       doc.rect(barChartX + 10, yPos - 2, 3, 3, 'F');
                                                       doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                       doc.text('Benchmark', barChartX + 15, yPos);
                                                       
                                                       doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                                       doc.rect(barChartX + 50, yPos - 2, 3, 3, 'F');
                                                       doc.text('Il Tuo Hotel', barChartX + 55, yPos);
                                                       
                                                       yPos += 12; // Spazio dopo il grafico completo
                                                   }

                                                   // Grafico 3: Distribuzione Costi (Pie Chart semplificato con approccio alternativo)
                                                   checkPageBreak(90); // Controlla spazio per titolo + pie chart + etichette + legenda
                                                   yPos += 10; // Spazio extra prima del titolo
                                                   doc.setFontSize(12);
                                                   doc.setFont('helvetica', 'bold');
                                                   doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                   doc.text('Distribuzione Costi per Categoria (Grafico a Torta)', margin, yPos);
                                                   yPos += 12; // Spazio dopo titolo prima del grafico

                                                   // Calcola costi per il grafico
                                                   const ristorazioneTotaleChart = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => sum + (mc.costs.ristorazione?.reduce((s, item) => s + (item.importo || 0), 0) || 0), 0)
                                                       : (costs.ristorazione?.reduce((sum, item) => sum + (item.importo || 0), 0) || 0);
                                                   
                                                   const utenzeTotaleChart = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const ut = mc.costs.utenze;
                                                           return sum + (ut?.energia?.importo || 0) + (ut?.gas?.importo || 0) + (ut?.acqua?.importo || 0);
                                                       }, 0)
                                                       : ((costs.utenze?.energia?.importo || 0) + (costs.utenze?.gas?.importo || 0) + (costs.utenze?.acqua?.importo || 0));
                                                   
                                                   const personaleTotaleChart = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const pers = mc.costs.personale;
                                                           return sum + (pers?.bustePaga || 0) + (pers?.sicurezza || 0) + (pers?.contributiINPS || 0);
                                                       }, 0)
                                                       : ((costs.personale?.bustePaga || 0) + (costs.personale?.sicurezza || 0) + (costs.personale?.contributiINPS || 0));
                                                   
                                                   const marketingTotaleChart = Array.isArray(monthlyCosts) && monthlyCosts.length > 0
                                                       ? monthlyCosts.reduce((sum, mc) => {
                                                           const mark = mc.costs.marketing;
                                                           return sum + (mark?.costiMarketing || 0) + (mark?.commissioniOTA || 0);
                                                       }, 0)
                                                       : ((costs.marketing?.costiMarketing || 0) + (costs.marketing?.commissioniOTA || 0));

                                                   const costiChartData = [
                                                       { nome: 'Ristorazione', valore: ristorazioneTotaleChart },
                                                       { nome: 'Utenze', valore: utenzeTotaleChart },
                                                       { nome: 'Personale', valore: personaleTotaleChart },
                                                       { nome: 'Marketing', valore: marketingTotaleChart },
                                                   ].filter(c => c.valore > 0).sort((a, b) => b.valore - a.valore);

                                                   if (costiChartData.length > 0) {
                                                       const totalCosts = costiChartData.reduce((sum, c) => sum + c.valore, 0);
                                                       const pieRadius = 22;
                                                       const pieX = margin + 35;
                                                       // Controlla che il pie chart e le etichette non vadano oltre la pagina
                                                       const pieChartHeight = pieRadius * 2 + 30; // Raggio * 2 + spazio per etichette
                                                       checkPageBreak(pieChartHeight);
                                                       const pieY = yPos + pieRadius + 10; // Spazio sopra il grafico
                                                       
                                                       const colors = [
                                                           [59, 130, 246], [16, 185, 129], [245, 158, 11], [239, 68, 68], 
                                                           [139, 92, 246], [236, 72, 153], [6, 182, 212], [132, 204, 22]
                                                       ];
                                                       
                                                       // Disegna il grafico a torta usando settori circolari approssimati
                                                       let currentAngle = -90; // Inizia dall'alto
                                                       
                                                       costiChartData.forEach((cat, idx) => {
                                                           const slicePercent = cat.valore / totalCosts;
                                                           const sliceAngle = slicePercent * 360;
                                                           const color = colors[idx % colors.length];
                                                           
                                                           // Calcola angolo medio della fetta per l'etichetta
                                                           const midAngle = currentAngle + sliceAngle / 2;
                                                           const midRad = (midAngle * Math.PI) / 180;
                                                           
                                                           // Calcola punti dell'arco
                                                           const startRad = (currentAngle * Math.PI) / 180;
                                                           const endRad = ((currentAngle + sliceAngle) * Math.PI) / 180;
                                                           
                                                           // Disegna la fetta usando molti piccoli settori triangolari
                                                           doc.setFillColor(color[0], color[1], color[2]);
                                                           const numSegments = Math.max(15, Math.ceil(sliceAngle / 3));
                                                           
                                                           for (let seg = 0; seg < numSegments; seg++) {
                                                               const segStartAngle = currentAngle + (sliceAngle * seg) / numSegments;
                                                               const segEndAngle = currentAngle + (sliceAngle * (seg + 1)) / numSegments;
                                                               const segStartRad = (segStartAngle * Math.PI) / 180;
                                                               const segEndRad = (segEndAngle * Math.PI) / 180;
                                                               
                                                               // Crea triangolo settore: centro -> punto1 -> punto2 -> centro
                                                               const x1 = pieX;
                                                               const y1 = pieY;
                                                               const x2 = pieX + pieRadius * Math.cos(segStartRad);
                                                               const y2 = pieY + pieRadius * Math.sin(segStartRad);
                                                               const x3 = pieX + pieRadius * Math.cos(segEndRad);
                                                               const y3 = pieY + pieRadius * Math.sin(segEndRad);
                                                               
                                                               // Disegna il triangolo riempiendo un'area rettangolare che lo contiene
                                                               // e poi disegnando sopra solo la parte visibile
                                                               const centerX = (x1 + x2 + x3) / 3;
                                                               const centerY = (y1 + y2 + y3) / 3;
                                                               const size = Math.sqrt((x2 - x3) ** 2 + (y2 - y3) ** 2) / 3;
                                                               
                                                               // Disegna piccolo cerchio che approssima il triangolo
                                                               if (size > 0.5) {
                                                                   doc.circle(centerX, centerY, size, 'F');
                                                               }
                                                               
                                                               // Disegna anche il bordo del triangolo
                                                               doc.setDrawColor(color[0], color[1], color[2]);
                                                               doc.setLineWidth(0.1);
                                                               doc.line(x1, y1, x2, y2);
                                                               doc.line(x2, y2, x3, y3);
                                                           }
                                                           
                                                           // Linee di separazione tra fette
                                                           doc.setDrawColor(255, 255, 255);
                                                           doc.setLineWidth(1);
                                                           doc.line(pieX, pieY, pieX + pieRadius * Math.cos(startRad), pieY + pieRadius * Math.sin(startRad));
                                                           doc.line(pieX, pieY, pieX + pieRadius * Math.cos(endRad), pieY + pieRadius * Math.sin(endRad));
                                                           
                                                           // Aggiungi etichetta sulla fetta (solo se la fetta è abbastanza grande)
                                                           if (slicePercent > 0.05) { // Solo se rappresenta almeno il 5%
                                                               const labelDistance = pieRadius * 1.25; // Punto fuori dal cerchio
                                                               const labelX = pieX + labelDistance * Math.cos(midRad);
                                                               const labelY = pieY + labelDistance * Math.sin(midRad);
                                                               
                                                               // Linea guida dal centro verso l'etichetta
                                                               doc.setDrawColor(textColor[0], textColor[1], textColor[2]);
                                                               doc.setLineWidth(0.3);
                                                               const guideStartX = pieX + pieRadius * Math.cos(midRad);
                                                               const guideStartY = pieY + pieRadius * Math.sin(midRad);
                                                               doc.line(guideStartX, guideStartY, labelX, labelY);
                                                               
                                                               // Testo dell'etichetta
                                                               doc.setFontSize(7);
                                                               doc.setTextColor(color[0], color[1], color[2]);
                                                               doc.setFont('helvetica', 'bold');
                                                               
                                                               // Posiziona il testo vicino alla fine della linea guida
                                                               const percent = (slicePercent * 100).toFixed(0);
                                                               const labelText = `${cat.nome} ${percent}%`;
                                                               
                                                               // Allinea il testo in base alla posizione
                                                               if (Math.cos(midRad) > 0) {
                                                                   // Fetta a destra - testo allineato a sinistra
                                                                   doc.text(labelText, labelX + 2, labelY);
                                                               } else {
                                                                   // Fetta a sinistra - testo allineato a destra
                                                                   doc.text(labelText, labelX - 2, labelY, { align: 'right' });
                                                               }
                                                           }
                                                           
                                                           currentAngle += sliceAngle;
                                                       });
                                                       
                                                       // Disegna bordo esterno del cerchio
                                                       doc.setDrawColor(textColor[0], textColor[1], textColor[2]);
                                                       doc.setLineWidth(0.5);
                                                       // Disegna cerchio esterno usando piccoli segmenti
                                                       for (let i = 0; i < 72; i++) { // 360/5 = 72 segmenti per cerchio liscio
                                                           const angle1 = (i * 5 * Math.PI) / 180;
                                                           const angle2 = ((i + 1) * 5 * Math.PI) / 180;
                                                           const x1 = pieX + pieRadius * Math.cos(angle1);
                                                           const y1 = pieY + pieRadius * Math.sin(angle1);
                                                           const x2 = pieX + pieRadius * Math.cos(angle2);
                                                           const y2 = pieY + pieRadius * Math.sin(angle2);
                                                           doc.line(x1, y1, x2, y2);
                                                       }
                                                       
                                                       // Legenda con valori (a destra del grafico)
                                                       const legendX = margin + 75;
                                                       let legendY = pieY - pieRadius + 5; // Allinea con il top del pie chart
                                                       doc.setFontSize(8);
                                                       
                                                       costiChartData.forEach((cat, idx) => {
                                                           const color = colors[idx % colors.length];
                                                           doc.setFillColor(color[0], color[1], color[2]);
                                                           doc.rect(legendX, legendY - 2, 3, 3, 'F');
                                                           
                                                           doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                                                           const percent = ((cat.valore / totalCosts) * 100).toFixed(1);
                                                           doc.text(`${cat.nome}:`, legendX + 6, legendY);
                                                           doc.text(`${percent}%`, legendX + 48, legendY);
                                                           doc.text(`€${cat.valore.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, legendX + 62, legendY);
                                                           
                                                           legendY += 5.5;
                                                       });
                                                       
                                                       // Aggiorna yPos dopo il grafico a torta completo
                                                       yPos = pieY + pieRadius + 25; // Sotto il grafico + spazio extra per etichette
                                                   }

                                                   // Salva PDF
                                                   doc.save(`report-completo-${hotelName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
                                                   
                                                   setToastMessage('PDF generato con successo!');
                                                   setShowToast(true);
                                                   setTimeout(() => setShowToast(false), 3000);
                                               } catch (error) {
                                                   console.error('Errore generazione PDF:', error);
                                                   setToastMessage('Errore durante la generazione del PDF. Riprova.');
                                                   setShowToast(true);
                                                   setTimeout(() => setShowToast(false), 4000);
                                               }
                                           }}
                                           className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition"
                                       >
                                           📑 Esporta Report Completo (PDF)
                                       </button>
                                   </div>
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
        
        {/* Upload Payroll Dialog */}
        <UploadPayrollDialog
            isOpen={showPayrollDialog}
            onClose={() => setShowPayrollDialog(false)}
            onImport={handleImportCosts}
            selectedMonth={selectedMonth}
        />
        
        {showCategorizeDialog && importedCostsUncategorized.length > 0 && (
            <CategorizeCostsDialog
                costs={importedCostsUncategorized}
                onCategorize={handleCategorizeCost}
                onClose={() => {
                    setShowCategorizeDialog(false);
                }}
                onConfirm={() => {
                    setShowCategorizeDialog(false);
                    setToastMessage('Categorie assegnate! Ora clicca "Salva Costi Mese" per salvare definitivamente.');
                    setShowToast(true);
                    setTimeout(() => setShowToast(false), 4000);
                }}
            />
        )}

        {/* MonthPicker */}
        <MonthPicker
            isOpen={showMonthPicker}
            onClose={() => setShowMonthPicker(false)}
            onSelect={(mese) => {
                if (monthPickerType === 'costi') {
                    setSelectedMonth(mese);
                    setCosts({});
                } else if (monthPickerType === 'ricavi') {
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
                setShowMonthPicker(false);
            }}
            excludeMonths={[
                ...monthlyCosts.map(mc => mc.mese),
                ...revenues.map(r => r.mese)
            ]}
        />
    </div>
);

}