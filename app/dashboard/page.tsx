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
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        camereTotali: data?.camereTotali || hotelData?.camereTotali || 0,
        stelle: data?.stelle !== undefined ? data.stelle : hotelData?.stelle,
        localita: data?.localita || hotelData?.localita,
        annoInizio: data?.annoInizio || hotelData?.annoInizio,
        tipoHotel: data?.tipoHotel || hotelData?.tipoHotel,
        giorniApertura: data?.giorniApertura !== undefined ? data.giorniApertura : hotelData?.giorniApertura,
    };
    
    // Non salvare se non ci sono almeno le informazioni essenziali
    if (!hotelDataToSave.camereTotali || hotelDataToSave.camereTotali <= 0) {
        setToastMessage('Inserisci il numero di camere prima di salvare.');
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
            <div className="h-16 flex items-center justify-center border-b border-gray-700">
                <Link href="/" className="text-2xl font-bold text-white">
                    Revenue<span className="text-blue-400">Sentry</span>
                </Link>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                <NavLink id="panoramica" text="Panoramica" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
                <NavLink id="ricavi" text="Ricavi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>} />
                <NavLink id="costi" text="Costi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zM15 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"/></svg>} />
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
                                            <ResponsiveContainer width="100%" height={300}>
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
                                                            
                                                            return Object.entries(costiPerCategoria)
                                                                .map(([name, value]) => ({ name, value }))
                                                                .sort((a, b) => b.value - a.value);
                                                        })()}
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
                                     <input type="number" step="0.01" value={costs.personale?.bustePaga || ''} onChange={(e) => handleInputChange('personale', 'bustePaga', '', e.target.value)} placeholder="Costo Totale Buste Paga €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                                     <input type="number" step="0.01" value={costs.personale?.sicurezza || ''} onChange={(e) => handleInputChange('personale', 'sicurezza', '', e.target.value)} placeholder="Aggiornamento Sicurezza Dipendenti €" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
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
                                            {(hotelData?.tipoHotel === 'stagionale' || revenue.giorniAperturaMese) && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        Giorni di Apertura del Mese
                                                        {hotelData?.tipoHotel === 'stagionale' && (
                                                            <span className="text-xs text-blue-400 ml-1">*</span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="31"
                                                        value={revenue.giorniAperturaMese || ''}
                                                        onChange={(e) => {
                                                            const updated = [...revenues];
                                                            updated[revenues.length - 1 - idx] = { ...revenue, giorniAperturaMese: parseInt(e.target.value) || undefined };
                                                            setRevenues(updated);
                                                            handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                        }}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                        placeholder="Es. 28"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">Giorni di apertura effettivi in questo mese</p>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Numero Prenotazioni</label>
                                                <input
                                                    type="number"
                                                    value={revenue.numeroPrenotazioni || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, numeroPrenotazioni: parseInt(e.target.value) || undefined };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                    placeholder="Es. 150"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Numero totale di prenotazioni ricevute (per calcolo CAC)</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Permanenza Media (ALOS)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={revenue.permanenzaMedia || ''}
                                                    onChange={(e) => {
                                                        const updated = [...revenues];
                                                        updated[revenues.length - 1 - idx] = { ...revenue, permanenzaMedia: parseFloat(e.target.value) || undefined };
                                                        setRevenues(updated);
                                                        handleSaveRevenues(updated[revenues.length - 1 - idx]);
                                                    }}
                                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                                    placeholder="Es. 3.5"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Durata media del soggiorno in giorni (se vuoto, calcolato automaticamente)</p>
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
                                                       return sum + (pers?.bustePaga || 0) + (pers?.sicurezza || 0);
                                                   }, 0)
                                                   : ((costs.personale?.bustePaga || 0) + (costs.personale?.sicurezza || 0));
                                               
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
    </div>
);

}