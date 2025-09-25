"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, firebaseConfig } from '../../lib/firebase';

export default function LoginPage() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
const router = useRouter();

const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (firebaseConfig.apiKey === "LE_TUE_CREDENZIALI") {
        setError("ERRORE: Le credenziali di Firebase non sono state configurate.");
        setLoading(false);
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/dashboard');
    } catch (err: any) {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
            setError('Email o password non corretti. Riprova.');
        } else {
            setError(`Si è verificato un errore: ${err.code}`);
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
                <h2 className="text-2xl font-bold text-white text-center mb-1">Bentornato!</h2>
                <p className="text-gray-400 text-center mb-6">Inserisci le tue credenziali per accedere.</p>
                <form onSubmit={handleLogin} className="space-y-6">
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
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <div>
                        <button type="submit" disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg text-base transition disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {loading ? 'Accesso in corso...' : 'Accedi'}
                        </button>
                    </div>
                </form>
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-400">
                        Non hai un account? <Link href="/register" className="font-medium text-blue-400 hover:underline">Registrati</Link>
                    </p>
                </div>
            </div>
        </div>
    </div>
);

}