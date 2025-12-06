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
    contributiINPS?: number; // Contributi INPS mensili
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
  postiLettoTotali?: number; // numero totale di posti letto (fondamentale per calcolo occupazione corretto)
  stelle?: number;
  localita?: string;
  annoInizio?: number; // anno in cui è iniziato il monitoraggio
  tipoHotel?: 'annuale' | 'stagionale'; // carattere dell'hotel (annuale o stagionale)
  giorniApertura?: number; // numero di giorni di apertura (solo per hotel stagionali)
  // Configurazione competitor monitoring
  competitorMonitoring?: {
    enabled: boolean;
    priceUnit: 'per_camera' | 'per_persona' | 'per_camera_per_notte'; // Unità di misura prezzo
    defaultTreatment?: string; // Trattamento di default (es. "BB", "HB", "FB", "solo pernottamento")
    autoScraping?: boolean; // Abilita scraping automatico
    scrapingFrequency?: 'daily' | 'weekly' | 'manual'; // Frequenza scraping
  };
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

// ==========================================
// ML & AI Agent Types
// ==========================================

// Dati storici giornalieri per ML
export interface HistoricalData {
  hotelId: string;
  date: string; // formato "YYYY-MM-DD"
  occupancy_rate: number; // percentuale occupazione giornaliera
  adr: number; // Average Daily Rate
  revpar: number; // Revenue Per Available Room
  total_revenue: number; // Ricavi totali giornata
  total_costs: number; // Costi totali giornata
  weather_condition?: string; // "excellent" | "good" | "fair" | "poor"
  weather_score?: number; // 0-10
  local_events?: string[]; // Array di eventi locali
  event_impact_score?: number; // 0-10
  competitor_prices?: {
    [competitorName: string]: number; // Prezzo competitor per quella data
  };
  competitor_avg_price?: number;
  competitor_min_price?: number;
  competitor_max_price?: number;
  is_weekend?: boolean;
  is_holiday?: boolean;
  day_of_week?: number; // 0-6
  month?: number; // 1-12
  createdAt?: any;
  updatedAt?: any;
}

// Predizioni ML
export interface MLPrediction {
  hotelId: string;
  prediction_date: string; // formato "YYYY-MM-DD"
  predicted_occupancy: number; // percentuale prevista
  suggested_price: number; // Prezzo suggerito
  confidence_score: number; // 0-1
  reasoning: string; // Spiegazione predizione
  factors?: {
    weather?: number;
    events?: number;
    demand?: number;
    competitor?: number;
  };
  competitor_analysis?: {
    avg_price: number;
    min_price: number;
    max_price: number;
    market_position: 'above' | 'below' | 'average';
  };
  created_at: any;
}

// Azioni agent eseguite
export interface AgentAction {
  hotelId: string;
  action_type: 'price_suggestion' | 'cost_alert' | 'revenue_prediction' | 'competitor_alert' | 'weather_alert' | 'event_alert';
  action_data: {
    [key: string]: any; // Dati specifici per tipo azione
  };
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  reasoning?: string; // Perché l'agente ha suggerito questa azione
  impact_estimate?: number; // Impatto stimato in €
  created_at: any;
  updated_at?: any;
  user_feedback?: string; // Feedback utente se modificato/rifiutato
}

// Competitor configurato dall'utente
export interface CompetitorConfig {
  hotelId: string;
  competitor_name: string;
  location: string;
  bookingUrl?: string; // URL Booking.com o altro OTA per scraping
  bookingId?: string; // ID hotel su Booking.com (se disponibile)
  isActive: boolean;
  priority: 'high' | 'medium' | 'low'; // Priorità nel monitoraggio
  notes?: string; // Note utente sul competitor
  created_at: any;
  updated_at?: any;
}

// Dati competitor scraped
export interface CompetitorData {
  hotelId: string;
  competitor_name: string;
  location: string;
  date: string; // formato "YYYY-MM-DD"
  price: number; // Prezzo nella unità configurata (per_camera, per_persona, etc.)
  price_unit: 'per_camera' | 'per_persona' | 'per_camera_per_notte'; // Unità di misura del prezzo
  treatment?: string; // Trattamento (BB, HB, FB, solo pernottamento)
  room_type?: string; // Tipo camera (singola, doppia, suite, etc.)
  rating?: number;
  availability?: boolean;
  guests?: number; // Numero ospiti per cui è valido il prezzo (se per_persona)
  nights?: number; // Numero notti (se per_camera_per_notte)
  scraped_at: any;
  cache_ttl?: any; // Timestamp scadenza cache (24h)
  source?: 'booking' | 'expedia' | 'manual' | 'other'; // Fonte dati
}

// Eventi locali
export interface LocalEvent {
  hotelId: string;
  event_name: string;
  event_date: string; // formato "YYYY-MM-DD"
  event_type: 'concert' | 'fair' | 'festival' | 'sports' | 'other';
  impact_level: 'high' | 'medium' | 'low';
  description?: string;
  location?: string;
  expected_attendance?: number;
  created_at: any;
  source?: 'manual' | 'scraped' | 'api';
}

// Modello ML serializzato
export interface MLModel {
  hotelId: string;
  model_type: 'pricing' | 'demand_forecast' | 'cost_optimizer';
  model_version: string;
  model_data: string; // JSON serializzato del modello
  training_date: any;
  accuracy_score?: number;
  features_used: string[];
  performance_metrics?: {
    mae?: number; // Mean Absolute Error
    rmse?: number; // Root Mean Squared Error
    r2?: number; // R-squared
  };
}

