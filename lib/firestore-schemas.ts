// Schema validators e helper per collezioni Firestore ML

import { HistoricalData, MLPrediction, AgentAction, CompetitorData, CompetitorConfig, LocalEvent, MLModel, RevenueData, HotelData } from './types';

/**
 * Valida e normalizza HistoricalData
 */
export function validateHistoricalData(data: Partial<HistoricalData>): HistoricalData | null {
  if (!data.hotelId || !data.date) {
    return null;
  }

  return {
    hotelId: data.hotelId,
    date: data.date,
    occupancy_rate: data.occupancy_rate ?? 0,
    adr: data.adr ?? 0,
    revpar: data.revpar ?? 0,
    total_revenue: data.total_revenue ?? 0,
    total_costs: data.total_costs ?? 0,
    weather_condition: data.weather_condition,
    weather_score: data.weather_score,
    local_events: data.local_events ?? [],
    event_impact_score: data.event_impact_score,
    competitor_prices: data.competitor_prices ?? {},
    competitor_avg_price: data.competitor_avg_price,
    competitor_min_price: data.competitor_min_price,
    competitor_max_price: data.competitor_max_price,
    is_weekend: data.is_weekend ?? false,
    is_holiday: data.is_holiday ?? false,
    day_of_week: data.day_of_week,
    month: data.month,
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  };
}

/**
 * Valida MLPrediction
 */
export function validateMLPrediction(data: Partial<MLPrediction>): MLPrediction | null {
  if (!data.hotelId || !data.prediction_date) {
    return null;
  }

  return {
    hotelId: data.hotelId,
    prediction_date: data.prediction_date,
    predicted_occupancy: data.predicted_occupancy ?? 0,
    suggested_price: data.suggested_price ?? 0,
    confidence_score: data.confidence_score ?? 0,
    reasoning: data.reasoning ?? '',
    factors: data.factors,
    competitor_analysis: data.competitor_analysis,
    created_at: data.created_at ?? new Date(),
  };
}

/**
 * Valida AgentAction
 */
export function validateAgentAction(data: Partial<AgentAction>): AgentAction | null {
  if (!data.hotelId || !data.action_type) {
    return null;
  }

  return {
    hotelId: data.hotelId,
    action_type: data.action_type,
    action_data: data.action_data ?? {},
    status: data.status ?? 'pending',
    reasoning: data.reasoning,
    impact_estimate: data.impact_estimate,
    created_at: data.created_at ?? new Date(),
    updated_at: data.updated_at,
    user_feedback: data.user_feedback,
  };
}

/**
 * Valida CompetitorData
 */
export function validateCompetitorData(data: Partial<CompetitorData>): CompetitorData | null {
  if (!data.hotelId || !data.competitor_name || !data.date) {
    return null;
  }

  // Costruisce oggetto senza campi undefined (Firestore non li accetta)
  const validated: any = {
    hotelId: data.hotelId,
    competitor_name: data.competitor_name,
    location: data.location ?? '',
    date: data.date,
    price: data.price ?? 0,
    price_unit: data.price_unit ?? 'per_camera', // Default: per camera
    scraped_at: data.scraped_at ?? new Date(),
  };

  // Aggiunge solo campi opzionali se definiti
  if (data.rating !== undefined) validated.rating = data.rating;
  if (data.availability !== undefined) validated.availability = data.availability;
  if (data.room_type !== undefined && data.room_type !== null) validated.room_type = data.room_type;
  if (data.treatment !== undefined && data.treatment !== null) validated.treatment = data.treatment;
  if (data.guests !== undefined) validated.guests = data.guests;
  if (data.nights !== undefined) validated.nights = data.nights;
  if (data.source !== undefined && data.source !== null) validated.source = data.source;
  if (data.cache_ttl !== undefined) validated.cache_ttl = data.cache_ttl;

  return validated as CompetitorData;
}

/**
 * Valida CompetitorConfig
 */
export function validateCompetitorConfig(data: Partial<CompetitorConfig>): CompetitorConfig | null {
  if (!data.hotelId || !data.competitor_name || !data.location) {
    return null;
  }

  return {
    hotelId: data.hotelId,
    competitor_name: data.competitor_name,
    location: data.location,
    bookingUrl: data.bookingUrl,
    bookingId: data.bookingId,
    isActive: data.isActive ?? true,
    priority: data.priority ?? 'medium',
    notes: data.notes,
    created_at: data.created_at ?? new Date(),
    updated_at: data.updated_at ?? new Date(),
  };
}

/**
 * Valida LocalEvent
 */
export function validateLocalEvent(data: Partial<LocalEvent>): LocalEvent | null {
  if (!data.hotelId || !data.event_name || !data.event_date) {
    return null;
  }

  return {
    hotelId: data.hotelId,
    event_name: data.event_name,
    event_date: data.event_date,
    event_type: data.event_type ?? 'other',
    impact_level: data.impact_level ?? 'medium',
    description: data.description,
    location: data.location,
    expected_attendance: data.expected_attendance,
    created_at: data.created_at ?? new Date(),
    source: data.source ?? 'manual',
  };
}

/**
 * Converte RevenueData mensile in HistoricalData giornaliero
 * Distribuisce i dati mensili uniformemente sui giorni del mese
 */
export function convertRevenueToHistorical(
  revenue: RevenueData,
  hotelData: HotelData | undefined,
  hotelId: string
): HistoricalData[] {
  const [year, month] = revenue.mese.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const historicalData: HistoricalData[] = [];

  // Calcola valori giornalieri medi
  const dailyRevenue = revenue.entrateTotali / daysInMonth;
  const dailyOccupancy = revenue.occupazione; // Occupancy è già percentuale
  const dailyADR = revenue.prezzoMedioCamera;
  const dailyRevpar = (dailyRevenue / (hotelData?.camereTotali || 1));

  // Distribuisci costi mensili sui giorni (se disponibili)
  // Per ora usiamo 0, verrà popolato quando avremo i costi giornalieri

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    historicalData.push({
      hotelId,
      date,
      occupancy_rate: dailyOccupancy,
      adr: dailyADR,
      revpar: dailyRevpar,
      total_revenue: dailyRevenue,
      total_costs: 0, // Sarà popolato quando avremo dati costi giornalieri
      is_weekend: isWeekend,
      day_of_week: dayOfWeek,
      month: month,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return historicalData;
}

/**
 * Calcola ID documento per HistoricalData
 */
export function getHistoricalDataDocId(hotelId: string, date: string): string {
  return `${hotelId}_${date}`;
}

/**
 * Calcola ID documento per MLPrediction
 */
export function getMLPredictionDocId(hotelId: string, predictionDate: string): string {
  return `${hotelId}_${predictionDate}`;
}

/**
 * Calcola ID documento per CompetitorData
 */
export function getCompetitorDataDocId(hotelId: string, competitorName: string, date: string): string {
  return `${hotelId}_${competitorName}_${date}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Verifica se una data è festività italiana
 */
export function isItalianHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Festività fisse
  const fixedHolidays: { [key: string]: number[] } = {
    '1-1': [1, 1], // Capodanno
    '1-6': [1, 6], // Epifania
    '4-25': [4, 25], // Liberazione
    '5-1': [5, 1], // Festa del Lavoro
    '6-2': [6, 2], // Festa della Repubblica
    '8-15': [8, 15], // Ferragosto
    '11-1': [11, 1], // Ognissanti
    '12-8': [12, 8], // Immacolata
    '12-25': [12, 25], // Natale
    '12-26': [12, 26], // Santo Stefano
  };

  const holidayKey = `${month}-${day}`;
  if (fixedHolidays[holidayKey]) {
    return true;
  }

  // Pasqua (calcolo dinamico - formula di Gauss)
  const easter = calculateEaster(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);

  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getTime() === easter.getTime() ||
    testDate.getTime() === easterMonday.getTime()
  );
}

/**
 * Calcola la data di Pasqua per un anno dato (formula di Gauss)
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}
