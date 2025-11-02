"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../../lib/firebase';

export default function RegisterPage() {
const [hotelName, setHotelName] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
const router = useRouter();

const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (firebaseConfig.apiKey === "LE_TUE_CREDENZIALI") {
        setError("ERRORE: Le credenziali di Firebase non sono state configurate.");
        setLoading(false);
        return;
    }

    if (password !== confirmPassword) {
        setError('Le password non coincidono. Riprova.');
        setLoading(false);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            hotelName: hotelName,
            email: email,
            role: 'user', // Default role
            createdAt: new Date()
        });
        
        // Invia email di benvenuto (in background, non blocca la navigazione)
        fetch('/api/email/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, hotelName }),
        }).catch(err => console.error('Errore invio email benvenuto:', err));
        
        router.push('/dashboard');
    } catch (err: any) {
         switch (err.code) {
            case 'auth/email-already-in-use':
                setError('Questo indirizzo email è già stato registrato.');
                break;
            case 'auth/invalid-email':
                setError('L\'indirizzo email inserito non è valido.');
                break;
            case 'auth/weak-password':
                setError('La password è troppo debole. Deve contenere almeno 6 caratteri.');
                break;
            default:
                setError(`Si è verificato un errore: ${err.code}`);
                break;
        }
        console.error("Dettaglio errore Firebase:", err);
    } finally {
        setLoading(false);
    }
};

return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
             <div className="text-center mb-8">
                <Link href="/" className="text-3xl font-bold text-white">
                    Revenue<span className="text-blue-400">Sentry</span>
                </Link>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 shadow-2xl shadow-blue-500/10">
                <h2 className="text-2xl font-bold text-white text-center mb-1">Crea il tuo account</h2>
                <p className="text-gray-400 text-center mb-6">Inizia a ottimizzare i tuoi ricavi oggi stesso.</p>
                <form onSubmit={handleRegister} className="space-y-6">
                    <div>
                        <label htmlFor="hotel-name" className="block text-sm font-medium text-gray-300">Nome del tuo Hotel</label>
                        <input id="hotel-name" type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} required
                               className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                    </div>
                     <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                               className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                               className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                    </div>
                     <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300">Conferma Password</label>
                        <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                               className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <div>
                        <button type="submit" disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-base transition disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {loading ? 'Creazione account...' : 'Crea Account'}
                        </button>
                    </div>
                </form>
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-400">
                        Hai già un account? <Link href="/login" className="font-medium text-blue-400 hover:underline">Accedi</Link>
                    </p>
                </div>
            </div>
        </div>
    </div>
);

}