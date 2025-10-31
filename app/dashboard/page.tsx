"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

// Definiamo i tipi per i dati dei costi
interface CostItem {
fornitore: string;
importo: number;
}
interface CostsData {
ristorazione: CostItem[];
utenze: {
energia: CostItem;
gas: CostItem;
acqua: CostItem;
};
personale: {
bustePaga: number;
sicurezza: number;
};
altriCosti: {
[key: string]: number;
};
}

export default function DashboardPage() {
const [user, setUser] = useState<User | null>(null);
const [hotelName, setHotelName] = useState('Caricamento...');
const [activeSection, setActiveSection] = useState('costi');
const [costs, setCosts] = useState<Partial<CostsData>>({});
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [showToast, setShowToast] = useState(false);
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
                    if (userData.costs) {
                        setCosts(userData.costs);
                    }
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
    if (!user) return;
    setSaving(true);
    
    const cleanedCosts = JSON.parse(JSON.stringify(costs));
    if (cleanedCosts.ristorazione) {
        cleanedCosts.ristorazione = cleanedCosts.ristorazione.filter(
            (item: CostItem | null) => item && (item.fornitore || (item.importo && item.importo > 0))
        );
    }

    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { costs: cleanedCosts }, { merge: true });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
        console.error("Errore nel salvataggio dei costi:", error);
        alert("Si è verificato un errore durante il salvataggio.");
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
            <nav className="flex-1 px-4 py-6 space-y-2">
                <NavLink id="panoramica" text="Panoramica" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
                <NavLink id="costi" text="Costi" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zM15 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z"/></svg>} />
                <NavLink id="report" text="Report" icon={<svg className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>} />
            </nav>
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
                        <h2 className="text-3xl font-bold text-white mb-6">Panoramica Generale</h2>
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                            <p className="text-gray-400">Questa sezione è in costruzione. A breve qui potrai visualizzare i grafici e le analisi principali.</p>
                        </div>
                    </div>
                )}
                {activeSection === 'costi' && (
                    <form onSubmit={handleSaveCosts}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-white">Inserimento Costi Mensili</h2>
                            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition disabled:bg-gray-600">
                                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
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
                )}
                {activeSection === 'report' && (
                    <div>
                       <h2 className="text-3xl font-bold text-white mb-6">Report e Analisi</h2>
                        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
                            <p className="text-gray-400">Questa sezione è in costruzione. A breve qui potrai generare e scaricare i report dettagliati.</p>
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* Toast */}
        {showToast && (
            <div className="fixed bottom-8 right-8 bg-green-500 text-white py-3 px-6 rounded-lg shadow-lg">
                Dati salvati con successo!
            </div>
        )}
    </div>
);

}