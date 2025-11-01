// Tipi TypeScript per RevenueSentry

export interface CostItem {
  fornitore: string;
  importo: number;
}

export interface CostsData {
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
  marketing?: {
    costiMarketing?: number; // Costi marketing totali
    commissioniOTA?: number; // Commissioni Booking.com, Expedia, etc.
  };
  altriCosti: {
    [key: string]: number;
  };
}

// Struttura Hotel
export interface HotelData {
  hotelName: string;
  camereTotali: number;
  stelle?: number;
  localita?: string;
  annoInizio?: number; // anno in cui è iniziato il monitoraggio
  tipoHotel?: 'annuale' | 'stagionale'; // carattere dell'hotel (annuale o stagionale)
  giorniApertura?: number; // numero di giorni di apertura (solo per hotel stagionali)
}

// Dati Ricavi (mensili)
export interface RevenueData {
  mese: string; // formato "YYYY-MM"
  entrateTotali: number; // Ricavi totali camere
  occupazione: number; // percentuale
  prezzoMedioCamera: number; // ADR - Average Daily Rate
  camereVendute: number;
  nottiTotali: number;
  ricaviRistorazione?: number; // F&B - Food & Beverage
  ricaviServiziAggiuntivi?: number; // Spa, altri servizi
  giorniAperturaMese?: number; // giorni di apertura per questo mese (utile per hotel stagionali)
  numeroPrenotazioni?: number; // Numero totale di prenotazioni ricevute (per CAC)
  permanenzaMedia?: number; // ALOS - Average Length of Stay (in notti)
}

// Dati Costi (mensili)
export interface MonthlyCostsData {
  mese: string; // formato "YYYY-MM"
  costs: Partial<CostsData>;
}

// KPI Calcolati
export interface KPIData {
  // KPI Revenue Management (Performance Camere)
  revpar: number; // Revenue Per Available Room
  adr: number; // Average Daily Rate
  occupazione: number; // Occupancy Rate
  trevpar?: number; // Total Revenue Per Available Room (ricavi totali hotel / camere disponibili)
  
  // KPI Redditività USALI
  gop: number; // Gross Operating Profit
  gopMargin: number; // GOP Margin %
  goppar?: number; // Gross Operating Profit Per Available Room
  
  // KPI Costi
  cppr: number; // Cost Per Paying Room
  cpor?: number; // Cost Per Occupied Room (costi reparto camere / camere vendute)
  
  // Altri KPI
  profitPerRoom: number;
  totaleSpese: number;
  totaleRicavi: number;
  roi?: number; // Return on Investment (%)
  cac?: number; // Costo Acquisto Clienti (CAC)
  alos?: number; // Average Length of Stay (permanenza media)
  
  // Metriche stagionali
  costiGiornalieriMedi?: number; // Costi medi giornalieri (per hotel stagionali)
  ricaviGiornalieriMedi?: number; // Ricavi medi giornalieri (per hotel stagionali)
}

// Analisi e Benchmark
export interface CostAnalysis {
  categoria: string;
  importoAttuale: number;
  importoMesePrecedente?: number;
  variazionePercentuale?: number;
  benchmarkSettore?: number;
  differenzaBenchmark?: number;
  trend: 'incremento' | 'decremento' | 'stabile';
  anomalia: boolean;
  priorita: 'alta' | 'media' | 'bassa';
}

// Raccomandazione IA
export interface Recommendation {
  id: string;
  categoria: string;
  titolo: string;
  descrizione: string;
  impattoStimato: number; // risparmio potenziale in €
  difficolta: 'facile' | 'media' | 'complessa';
  priorita: 'critica' | 'alta' | 'media' | 'bassa';
  azioni: string[];
  evidenze?: string[];
}

// Alert
export interface Alert {
  id: string;
  tipo: 'anomalia' | 'soglia' | 'trend';
  categoria: string;
  messaggio: string;
  severita: 'critica' | 'alta' | 'media' | 'bassa';
  data: string;
  risolto: boolean;
}

// Dati Utente Completi
export interface UserData {
  hotelName: string;
  hotelData?: HotelData;
  costs?: Partial<CostsData>;
  revenues?: RevenueData[];
  kpi?: KPIData;
  recommendations?: Recommendation[];
  alerts?: Alert[];
  createdAt?: any;
  updatedAt?: any;
}

