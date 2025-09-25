import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ===============================================================
// IMPORTANTE: INCOLLA QUI LE TUE CREDENZIALI FIREBASE
// ===============================================================
const firebaseConfig = {
apiKey: "AIzaSyCJUsp6HVm8Qf_GepXttxC4CE7oBtWjf5k",
authDomain: "revenuesentry.firebaseapp.com",
projectId: "revenuesentry",
storageBucket: "https://www.google.com/search?q=revenuesentry.appspot.com",
messagingSenderId: "833757769470",
appId: "1:833757769470:web:f89fe6022ab7b953e33faf"
};

// Inizializza Firebase in modo sicuro (evita di reinizializzare)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };