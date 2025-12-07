/**
 * REASONING ENGINE - Il cervello di Sentry
 * 
 * Questo modulo implementa un sistema di ragionamento multi-livello che:
 * 1. Analizza dati hotel (KPI, trend, anomalie)
 * 2. Costruisce un "mental model" dello stato attuale
 * 3. Identifica problemi, opportunità, rischi
 * 4. Genera raccomandazioni prioritizzate con reasoning chain
 * 5. Valuta impatto potenziale di ogni azione
 * 
 * NESSUNA DIPENDENZA ESTERNA - tutto algoritmi proprietari
 */

import { HotelData, KPIData, HistoricalData, RevenueData, CostsData } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface HotelContext {
  // Stato attuale hotel
  currentMonth: string;
  hotelData: HotelData;
  kpis: KPIData;
  revenueData: RevenueData[];
  costsData: CostsData[];
  historicalData: HistoricalData[];
  
  // Metriche derivate
  trends: TrendAnalysis;
  anomalies: Anomaly[];
  benchmarks: BenchmarkComparison;
  seasonality: SeasonalityPattern;
}

export interface TrendAnalysis {
  revenue: TrendMetrics;
  occupancy: TrendMetrics;
  costs: TrendMetrics;
  profitability: TrendMetrics;
}

export interface TrendMetrics {
  direction: 'up' | 'down' | 'stable';
  strength: number; // 0-10
  changePercent: number;
  timeframe: string;
  significance: 'high' | 'medium' | 'low';
}

export interface Anomaly {
  type: 'cost' | 'revenue' | 'occupancy' | 'kpi';
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  actual: number;
  expected: number;
  deviation: number;
  period: string;
  possibleCauses: string[];
}

export interface BenchmarkComparison {
  adr: { actual: number; benchmark: number; gap: number };
  occupancy: { actual: number; benchmark: number; gap: number };
  revpar: { actual: number; benchmark: number; gap: number };
  goppar: { actual: number; benchmark: number; gap: number };
  costRatio: { actual: number; benchmark: number; gap: number };
}

export interface SeasonalityPattern {
  currentMonthFactor: number; // 0.8-1.2
  nextMonthFactor: number;
  isLowSeason: boolean;
  isHighSeason: boolean;
  historicalPattern: { month: string; avgOccupancy: number }[];
}

export interface Insight {
  id: string;
  category: 'opportunity' | 'problem' | 'risk' | 'achievement';
  priority: number; // 1-10
  title: string;
  description: string;
  reasoning: ReasoningChain;
  recommendations: ActionableRecommendation[];
  impact: ImpactEstimate;
  confidence: number; // 0-1
  urgency: 'immediate' | 'short-term' | 'long-term';
  createdAt: Date;
}

export interface ReasoningChain {
  observation: string; // Cosa ho osservato
  analysis: string; // Perché è importante
  causes: string[]; // Possibili cause
  consequences: string[]; // Cosa succede se ignori
  logic: string; // Ragionamento completo
}

export interface ActionableRecommendation {
  action: string;
  why: string;
  how: string;
  expectedOutcome: string;
  effort: 'low' | 'medium' | 'high';
  timeToImpact: string;
  dependencies: string[];
}

export interface ImpactEstimate {
  revenueChange: number; // €
  costChange: number; // €
  profitChange: number; // €
  occupancyChange: number; // %
  confidence: number; // 0-1
  timeframe: string;
}

// ============================================================================
// REASONING ENGINE CLASS
// ============================================================================

export class SentryReasoningEngine {
  private context: HotelContext;
  
  constructor(context: HotelContext) {
    this.context = context;
  }
  
  /**
   * METODO PRINCIPALE: Genera insights completi
   */
  public async generateInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // 1. ANALISI TREND - Identifica direzioni chiave
    const trendInsights = this.analyzeTrends();
    insights.push(...trendInsights);
    
    // 2. ANALISI ANOMALIE - Identifica deviazioni significative
    const anomalyInsights = this.analyzeAnomalies();
    insights.push(...anomalyInsights);
    
    // 3. ANALISI BENCHMARK - Confronta con standard settore
    const benchmarkInsights = this.analyzeBenchmarks();
    insights.push(...benchmarkInsights);
    
    // 4. ANALISI STAGIONALITÀ - Identifica pattern temporali
    const seasonalInsights = this.analyzeSeasonality();
    insights.push(...seasonalInsights);
    
    // 5. ANALISI OPPORTUNITÀ - Identifica growth opportunities
    const opportunityInsights = this.identifyOpportunities();
    insights.push(...opportunityInsights);
    
    // 6. ANALISI RISCHI - Identifica minacce potenziali
    const riskInsights = this.identifyRisks();
    insights.push(...riskInsights);
    
    // 7. PRIORITIZZAZIONE - Ordina per impatto e urgenza
    const prioritizedInsights = this.prioritizeInsights(insights);
    
    return prioritizedInsights;
  }
  
  /**
   * ANALISI TREND: Identifica tendenze significative
   */
  private analyzeTrends(): Insight[] {
    const insights: Insight[] = [];
    const { trends } = this.context;
    
    // REVENUE TREND ANALYSIS
    if (trends.revenue.direction === 'down' && trends.revenue.significance === 'high') {
      insights.push({
        id: `trend-revenue-declining-${Date.now()}`,
        category: 'problem',
        priority: 9,
        title: 'Revenue in Calo Significativo',
        description: `Il fatturato è diminuito del ${Math.abs(trends.revenue.changePercent).toFixed(1)}% negli ultimi ${trends.revenue.timeframe}.`,
        reasoning: this.buildReasoningChain({
          observation: `Revenue trend negativo: ${trends.revenue.changePercent.toFixed(1)}% in ${trends.revenue.timeframe}`,
          analysisType: 'revenue_decline',
          context: this.context
        }),
        recommendations: this.generateRevenueTrendRecommendations(trends.revenue),
        impact: this.estimateImpact({
          type: 'revenue_recovery',
          baseline: this.getAverageRevenue(),
          targetChange: Math.abs(trends.revenue.changePercent) * 0.5
        }),
        confidence: 0.85,
        urgency: 'immediate',
        createdAt: new Date()
      });
    }
    
    // COST TREND ANALYSIS
    if (trends.costs.direction === 'up' && trends.costs.significance === 'high') {
      insights.push({
        id: `trend-costs-rising-${Date.now()}`,
        category: 'problem',
        priority: 8,
        title: 'Costi in Crescita Preoccupante',
        description: `I costi sono aumentati del ${trends.costs.changePercent.toFixed(1)}% senza corrispondente aumento di occupancy.`,
        reasoning: this.buildReasoningChain({
          observation: `Cost trend positivo anomalo: +${trends.costs.changePercent.toFixed(1)}%`,
          analysisType: 'cost_increase',
          context: this.context
        }),
        recommendations: this.generateCostTrendRecommendations(trends.costs),
        impact: this.estimateImpact({
          type: 'cost_reduction',
          baseline: this.getAverageCosts(),
          targetChange: -trends.costs.changePercent * 0.3
        }),
        confidence: 0.8,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    // OCCUPANCY TREND ANALYSIS
    if (trends.occupancy.direction === 'down' && trends.occupancy.significance === 'medium') {
      insights.push({
        id: `trend-occupancy-declining-${Date.now()}`,
        category: 'problem',
        priority: 7,
        title: 'Occupancy in Diminuzione',
        description: `Il tasso di occupazione è sceso del ${Math.abs(trends.occupancy.changePercent).toFixed(1)}%.`,
        reasoning: this.buildReasoningChain({
          observation: `Occupancy trend: ${trends.occupancy.changePercent.toFixed(1)}%`,
          analysisType: 'occupancy_decline',
          context: this.context
        }),
        recommendations: this.generateOccupancyTrendRecommendations(trends.occupancy),
        impact: this.estimateImpact({
          type: 'occupancy_improvement',
          baseline: this.getAverageOccupancy(),
          targetChange: Math.abs(trends.occupancy.changePercent) * 0.6
        }),
        confidence: 0.75,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    // PROFITABILITY TREND ANALYSIS
    if (trends.profitability.direction === 'down' && trends.profitability.significance === 'high') {
      insights.push({
        id: `trend-profitability-declining-${Date.now()}`,
        category: 'problem',
        priority: 10,
        title: 'Profittabilità in Calo Critico',
        description: `La profittabilità è diminuita del ${Math.abs(trends.profitability.changePercent).toFixed(1)}%. Questo è un segnale critico.`,
        reasoning: this.buildReasoningChain({
          observation: `Profitability trend: ${trends.profitability.changePercent.toFixed(1)}%`,
          analysisType: 'profitability_decline',
          context: this.context
        }),
        recommendations: this.generateProfitabilityRecommendations(trends.profitability),
        impact: this.estimateImpact({
          type: 'profitability_recovery',
          baseline: this.getAverageProfitability(),
          targetChange: Math.abs(trends.profitability.changePercent) * 0.4
        }),
        confidence: 0.9,
        urgency: 'immediate',
        createdAt: new Date()
      });
    }
    
    return insights;
  }
  
  /**
   * ANALISI ANOMALIE: Identifica deviazioni significative
   */
  private analyzeAnomalies(): Insight[] {
    const insights: Insight[] = [];
    const { anomalies } = this.context;
    
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'warning') {
        insights.push({
          id: `anomaly-${anomaly.type}-${Date.now()}-${Math.random()}`,
          category: anomaly.severity === 'critical' ? 'problem' : 'risk',
          priority: anomaly.severity === 'critical' ? 9 : 6,
          title: `Anomalia ${anomaly.type.toUpperCase()}: ${anomaly.metric}`,
          description: `${anomaly.metric} è ${anomaly.actual > anomaly.expected ? 'superiore' : 'inferiore'} del ${Math.abs(anomaly.deviation).toFixed(1)}% rispetto al valore atteso (€${anomaly.expected.toFixed(0)} vs €${anomaly.actual.toFixed(0)}) nel periodo ${anomaly.period}.`,
          reasoning: {
            observation: `Anomalia rilevata: ${anomaly.metric} devia del ${Math.abs(anomaly.deviation).toFixed(1)}%`,
            analysis: `Questa deviazione è ${anomaly.severity === 'critical' ? 'critica' : 'significativa'} e richiede attenzione immediata.`,
            causes: anomaly.possibleCauses,
            consequences: this.getAnomalyConsequences(anomaly),
            logic: this.buildAnomalyLogic(anomaly)
          },
          recommendations: this.generateAnomalyRecommendations(anomaly),
          impact: {
            revenueChange: anomaly.type === 'revenue' ? anomaly.deviation * this.getAverageRevenue() / 100 : 0,
            costChange: anomaly.type === 'cost' ? anomaly.deviation * this.getAverageCosts() / 100 : 0,
            profitChange: 0,
            occupancyChange: anomaly.type === 'occupancy' ? anomaly.deviation : 0,
            confidence: 0.7,
            timeframe: '1 mese'
          },
          confidence: anomaly.severity === 'critical' ? 0.9 : 0.7,
          urgency: anomaly.severity === 'critical' ? 'immediate' : 'short-term',
          createdAt: new Date()
        });
      }
    }
    
    return insights;
  }
  
  /**
   * ANALISI BENCHMARK: Confronta con standard settore
   */
  private analyzeBenchmarks(): Insight[] {
    const insights: Insight[] = [];
    const { benchmarks } = this.context;
    
    // ADR Benchmark
    if (benchmarks.adr.gap < -0.15) {
      insights.push({
        id: `benchmark-adr-low-${Date.now()}`,
        category: 'opportunity',
        priority: 8,
        title: 'ADR Sotto Benchmark di Mercato',
        description: `Il tuo ADR (€${benchmarks.adr.actual.toFixed(0)}) è del ${Math.abs(benchmarks.adr.gap * 100).toFixed(1)}% sotto il benchmark di mercato (€${benchmarks.adr.benchmark.toFixed(0)}).`,
        reasoning: this.buildReasoningChain({
          observation: `ADR gap: ${(benchmarks.adr.gap * 100).toFixed(1)}% sotto benchmark`,
          analysisType: 'adr_benchmark',
          context: this.context
        }),
        recommendations: this.generateADRBenchmarkRecommendations(),
        impact: {
          revenueChange: (benchmarks.adr.benchmark - benchmarks.adr.actual) * this.getAverageRoomsSold() * 25,
          costChange: 0,
          profitChange: (benchmarks.adr.benchmark - benchmarks.adr.actual) * this.getAverageRoomsSold() * 25,
          occupancyChange: 0,
          confidence: 0.8,
          timeframe: '1 mese'
        },
        confidence: 0.85,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    // Occupancy Benchmark
    if (benchmarks.occupancy.gap < -0.1) {
      insights.push({
        id: `benchmark-occupancy-low-${Date.now()}`,
        category: 'opportunity',
        priority: 7,
        title: 'Occupancy Sotto Benchmark',
        description: `La tua occupazione (${(benchmarks.occupancy.actual * 100).toFixed(1)}%) è del ${Math.abs(benchmarks.occupancy.gap * 100).toFixed(1)}% sotto il benchmark (${(benchmarks.occupancy.benchmark * 100).toFixed(1)}%).`,
        reasoning: this.buildReasoningChain({
          observation: `Occupancy gap: ${(benchmarks.occupancy.gap * 100).toFixed(1)}%`,
          analysisType: 'occupancy_benchmark',
          context: this.context
        }),
        recommendations: this.generateOccupancyBenchmarkRecommendations(),
        impact: {
          revenueChange: this.calculateRevenuePerOccupancyPoint(this.context) * Math.abs(benchmarks.occupancy.gap) * 100,
          costChange: 0,
          profitChange: this.calculateRevenuePerOccupancyPoint(this.context) * Math.abs(benchmarks.occupancy.gap) * 100,
          occupancyChange: Math.abs(benchmarks.occupancy.gap) * 100,
          confidence: 0.75,
          timeframe: '2-3 mesi'
        },
        confidence: 0.8,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    // Cost Ratio Benchmark
    if (benchmarks.costRatio.gap > 0.1) {
      insights.push({
        id: `benchmark-cost-ratio-high-${Date.now()}`,
        category: 'problem',
        priority: 7,
        title: 'Cost Ratio Sopra Benchmark',
        description: `Il tuo cost ratio (${(benchmarks.costRatio.actual * 100).toFixed(1)}%) è del ${(benchmarks.costRatio.gap * 100).toFixed(1)}% sopra il benchmark (${(benchmarks.costRatio.benchmark * 100).toFixed(1)}%).`,
        reasoning: this.buildReasoningChain({
          observation: `Cost ratio gap: +${(benchmarks.costRatio.gap * 100).toFixed(1)}%`,
          analysisType: 'cost_ratio_benchmark',
          context: this.context
        }),
        recommendations: this.generateCostRatioRecommendations(),
        impact: {
          revenueChange: 0,
          costChange: -this.getAverageRevenue() * benchmarks.costRatio.gap,
          profitChange: this.getAverageRevenue() * benchmarks.costRatio.gap,
          occupancyChange: 0,
          confidence: 0.7,
          timeframe: '2-3 mesi'
        },
        confidence: 0.75,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    return insights;
  }
  
  /**
   * ANALISI STAGIONALITÀ: Identifica pattern temporali
   */
  private analyzeSeasonality(): Insight[] {
    const insights: Insight[] = [];
    const { seasonality } = this.context;
    
    // Preparazione per alta stagione
    if (seasonality.nextMonthFactor > 1.1 && !seasonality.isHighSeason) {
      insights.push({
        id: `seasonality-high-season-coming-${Date.now()}`,
        category: 'opportunity',
        priority: 6,
        title: 'Alta Stagione in Arrivo',
        description: `Il prossimo mese ha un fattore stagionale di ${seasonality.nextMonthFactor.toFixed(2)}x, indicando alta stagione. Preparati per aumentare prezzi e occupazione.`,
        reasoning: {
          observation: `Fattore stagionalità prossimo mese: ${seasonality.nextMonthFactor.toFixed(2)}x`,
          analysis: 'Storicamente, questo periodo mostra occupazione e prezzi più alti. È un\'opportunità per massimizzare revenue.',
          causes: ['Stagione turistica', 'Eventi locali', 'Condizioni meteo favorevoli'],
          consequences: ['Perdita revenue se non preparati', 'Opportunità persa di aumentare prezzi'],
          logic: `Basandomi sui dati storici, il prossimo mese tipicamente mostra occupazione del ${(seasonality.nextMonthFactor * 100 - 100).toFixed(0)}% superiore alla media. Questo è il momento ideale per implementare dynamic pricing e preparare il team per alta occupazione.`
        },
        recommendations: [
          {
            action: 'Aumenta prezzi del 15-25% per il prossimo mese',
            why: 'La domanda sarà alta, puoi massimizzare revenue senza perdere occupazione',
            how: 'Usa il Dynamic Pricing Card nella dashboard per impostare prezzi stagionali',
            expectedOutcome: `+€${this.estimateSeasonalPricingImpact().toFixed(0)} in revenue aggiuntivo`,
            effort: 'low',
            timeToImpact: 'Immediato',
            dependencies: []
          },
          {
            action: 'Prepara team e strutture per alta occupazione',
            why: 'Alta occupazione richiede più risorse e attenzione alla qualità',
            how: 'Assicurati che personale, pulizie e servizi siano pronti per il picco',
            expectedOutcome: 'Migliore esperienza ospiti = recensioni migliori',
            effort: 'medium',
            timeToImpact: '1 settimana',
            dependencies: ['Coordinamento team']
          }
        ],
        impact: {
          revenueChange: this.estimateSeasonalPricingImpact(),
          costChange: this.getAverageCosts() * 0.1, // +10% costi per alta occupazione
          profitChange: this.estimateSeasonalPricingImpact() - (this.getAverageCosts() * 0.1),
          occupancyChange: (seasonality.nextMonthFactor - 1) * 20,
          confidence: 0.8,
          timeframe: 'Prossimo mese'
        },
        confidence: 0.8,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    // Preparazione per bassa stagione
    if (seasonality.nextMonthFactor < 0.85 && !seasonality.isLowSeason) {
      insights.push({
        id: `seasonality-low-season-coming-${Date.now()}`,
        category: 'risk',
        priority: 5,
        title: 'Bassa Stagione in Arrivo',
        description: `Il prossimo mese ha un fattore stagionale di ${seasonality.nextMonthFactor.toFixed(2)}x, indicando bassa stagione. Pianifica strategie per mantenere occupazione.`,
        reasoning: {
          observation: `Fattore stagionalità prossimo mese: ${seasonality.nextMonthFactor.toFixed(2)}x`,
          analysis: 'Storicamente, questo periodo mostra occupazione più bassa. Serve una strategia proattiva per mantenere revenue.',
          causes: ['Stagione turistica bassa', 'Condizioni meteo meno favorevoli'],
          consequences: ['Revenue ridotto', 'Camere vuote', 'Diluizione costi su meno camere'],
          logic: `Il prossimo mese tipicamente mostra occupazione del ${((1 - seasonality.nextMonthFactor) * 100).toFixed(0)}% inferiore alla media. È importante pianificare promozioni, marketing mirato e ottimizzazione costi per mantenere profittabilità.`
        },
        recommendations: [
          {
            action: 'Lancia promozioni last-minute e pacchetti',
            why: 'Bassa stagione richiede strategie aggressive per attirare ospiti',
            how: 'Offerte sconto 20-30% per prenotazioni last-minute, pacchetti weekend, collaborazioni con eventi locali',
            expectedOutcome: `Mantieni occupazione al ${(seasonality.nextMonthFactor * 100).toFixed(0)}% invece di scendere oltre`,
            effort: 'medium',
            timeToImpact: '2-3 settimane',
            dependencies: ['Budget marketing: €500-1000']
          },
          {
            action: 'Ottimizza costi variabili per bassa occupazione',
            why: 'Con meno ospiti, alcuni costi possono essere ridotti senza impatto qualità',
            how: 'Riduci servizi non essenziali, ottimizza turni personale, negozia con fornitori',
            expectedOutcome: `Riduzione costi del 10-15% = €${(this.getAverageCosts() * 0.125).toFixed(0)}/mese risparmiati`,
            effort: 'medium',
            timeToImpact: '1 mese',
            dependencies: []
          }
        ],
        impact: {
          revenueChange: -this.getAverageRevenue() * (1 - seasonality.nextMonthFactor),
          costChange: -this.getAverageCosts() * 0.125,
          profitChange: -this.getAverageRevenue() * (1 - seasonality.nextMonthFactor) + (this.getAverageCosts() * 0.125),
          occupancyChange: -(1 - seasonality.nextMonthFactor) * 30,
          confidence: 0.75,
          timeframe: 'Prossimo mese'
        },
        confidence: 0.75,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    return insights;
  }
  
  /**
   * IDENTIFICA OPPORTUNITÀ: Growth opportunities
   */
  private identifyOpportunities(): Insight[] {
    const insights: Insight[] = [];
    const { kpis, hotelData } = this.context;
    
    // Opportunità: Upselling
    if (kpis.occupazione > 0.7) {
      insights.push({
        id: `opportunity-upselling-${Date.now()}`,
        category: 'opportunity',
        priority: 5,
        title: 'Opportunità Upselling con Alta Occupazione',
        description: `Con occupazione al ${(kpis.occupazione * 100).toFixed(1)}%, hai molte opportunità per aumentare revenue per ospite con servizi extra.`,
        reasoning: {
          observation: `Occupazione alta: ${(kpis.occupazione * 100).toFixed(1)}%`,
          analysis: 'Ogni ospite è un\'opportunità per revenue aggiuntivo a margine alto',
          causes: ['Alta occupazione = più ospiti', 'Margini alti su servizi extra'],
          consequences: ['Revenue incrementale significativo', 'Migliore esperienza ospiti'],
          logic: `Con ${Math.round((hotelData.camereTotali || 30) * kpis.occupazione * 25)} ospiti/mese, anche un upselling medio di €10/ospite su 30% degli ospiti genera €${this.estimateUpsellImpact(this.context).toFixed(0)}/mese in revenue aggiuntivo.`
        },
        recommendations: [
          {
            action: 'Implementa programma upselling strutturato',
            why: 'Revenue incrementale a margine alto senza costi aggiuntivi significativi',
            how: 'Training staff reception, offerte check-in, email pre-arrivo con add-ons (colazione, spa, late checkout, upgrade camera)',
            expectedOutcome: `+€${this.estimateUpsellImpact(this.context).toFixed(0)}/mese`,
            effort: 'low',
            timeToImpact: '1 settimana',
            dependencies: ['Training staff 2h']
          }
        ],
        impact: {
          revenueChange: this.estimateUpsellImpact(this.context),
          costChange: this.estimateUpsellImpact(this.context) * 0.3, // 30% costi
          profitChange: this.estimateUpsellImpact(this.context) * 0.7,
          occupancyChange: 0,
          confidence: 0.7,
          timeframe: '1 mese'
        },
        confidence: 0.7,
        urgency: 'long-term',
        createdAt: new Date()
      });
    }
    
    // Opportunità: Miglioramento recensioni
    if (kpis.occupazione < 0.8) {
      insights.push({
        id: `opportunity-reviews-${Date.now()}`,
        category: 'opportunity',
        priority: 6,
        title: 'Miglioramento Recensioni per Aumentare Occupazione',
        description: 'Recensioni positive possono aumentare significativamente occupazione e permettere prezzi più alti.',
        reasoning: {
          observation: 'Occupazione sotto ottimale',
          analysis: 'Le recensioni online sono uno dei fattori principali nella decisione di prenotazione',
          causes: ['Recensioni negative o insufficienti', 'Mancanza di strategia review management'],
          consequences: ['Perdita potenziale ospiti', 'Impossibilità di aumentare prezzi'],
          logic: 'Migliorare le recensioni da 4.0 a 4.5 può aumentare occupazione del 10-15% e permettere prezzi del 5-10% più alti.'
        },
        recommendations: [
          {
            action: 'Implementa strategia review management proattiva',
            why: 'Recensioni positive = più prenotazioni e prezzi più alti',
            how: 'Email follow-up post-checkout con link recensione, risposta a tutte le recensioni, focus su risoluzione problemi rapidi',
            expectedOutcome: `+10-15% occupazione = +€${(this.calculateRevenuePerOccupancyPoint(this.context) * 12).toFixed(0)}/mese`,
            effort: 'medium',
            timeToImpact: '2-3 mesi',
            dependencies: ['Sistema email automatizzato']
          }
        ],
        impact: {
          revenueChange: this.calculateRevenuePerOccupancyPoint(this.context) * 12,
          costChange: 0,
          profitChange: this.calculateRevenuePerOccupancyPoint(this.context) * 12,
          occupancyChange: 12,
          confidence: 0.65,
          timeframe: '2-3 mesi'
        },
        confidence: 0.65,
        urgency: 'long-term',
        createdAt: new Date()
      });
    }
    
    return insights;
  }
  
  /**
   * IDENTIFICA RISCHI: Minacce potenziali
   */
  private identifyRisks(): Insight[] {
    const insights: Insight[] = [];
    const { kpis, trends } = this.context;
    
    // Rischio: Cash flow negativo
    const goppar = kpis.goppar || 0;
    if (goppar < 0 || (trends.profitability.direction === 'down' && goppar < 20)) {
      insights.push({
        id: `risk-cashflow-${Date.now()}`,
        category: 'risk',
        priority: 10,
        title: 'Rischio Cash Flow Negativo',
        description: `GOPPAR attuale (€${goppar.toFixed(0)}) è ${goppar < 0 ? 'negativo' : 'criticamente basso'}. Questo può portare a problemi di liquidità.`,
        reasoning: {
          observation: `GOPPAR: €${goppar.toFixed(0)}`,
          analysis: 'GOPPAR negativo o molto basso indica che i ricavi non coprono i costi operativi',
          causes: ['Costi troppo alti', 'Revenue troppo basso', 'Occupazione insufficiente'],
          consequences: ['Problemi di liquidità', 'Impossibilità di investimenti', 'Rischio chiusura'],
          logic: `Con GOPPAR di €${goppar.toFixed(0)}, stai generando ${goppar < 0 ? 'perdite' : 'profitti minimi'}. Questo è insostenibile nel lungo termine. Serve un intervento immediato su revenue o costi.`
        },
        recommendations: [
          {
            action: 'Intervento urgente su revenue e costi',
            why: 'Cash flow negativo è critico e richiede azione immediata',
            how: 'Combinazione di: aumento prezzi (se possibile), riduzione costi non essenziali, aumento occupazione con marketing aggressivo',
            expectedOutcome: `Portare GOPPAR sopra €30-40 per sostenibilità`,
            effort: 'high',
            timeToImpact: '1 mese',
            dependencies: ['Analisi approfondita costi', 'Strategia pricing']
          }
        ],
        impact: {
          revenueChange: this.getAverageRevenue() * 0.15,
          costChange: -this.getAverageCosts() * 0.1,
          profitChange: this.getAverageRevenue() * 0.15 + (this.getAverageCosts() * 0.1),
          occupancyChange: 5,
          confidence: 0.8,
          timeframe: '1 mese'
        },
        confidence: 0.9,
        urgency: 'immediate',
        createdAt: new Date()
      });
    }
    
    // Rischio: Competitor aggressivi
    const competitorPressure = this.analyzeCompetitorPressure(this.context);
    if (competitorPressure > 0.7 && kpis.occupazione < 0.75) {
      insights.push({
        id: `risk-competitor-pressure-${Date.now()}`,
        category: 'risk',
        priority: 7,
        title: 'Alta Pressione Competitiva',
        description: 'I competitor stanno applicando prezzi più aggressivi, mettendo a rischio la tua quota di mercato.',
        reasoning: {
          observation: `Pressione competitiva: ${(competitorPressure * 100).toFixed(0)}%`,
          analysis: 'Competitor con prezzi più bassi stanno catturando quota di mercato',
          causes: ['Competitor più aggressivi', 'Mercato saturo', 'Mancanza di differenziazione'],
          consequences: ['Perdita occupazione', 'Necessità di ridurre prezzi (erode margini)', 'Perdita competitività'],
          logic: 'Con alta pressione competitiva e occupazione già sotto ottimale, rischi di perdere ulteriore quota di mercato. Serve una strategia di differenziazione o ottimizzazione costi per competere.'
        },
        recommendations: [
          {
            action: 'Strategia di differenziazione vs competitor',
            why: 'Non puoi competere solo sul prezzo senza erodere margini',
            how: 'Focus su: servizi unici, esperienza ospiti superiore, posizionamento di nicchia, partnership locali',
            expectedOutcome: 'Mantieni occupazione e prezzi senza dover scendere troppo',
            effort: 'high',
            timeToImpact: '2-3 mesi',
            dependencies: ['Analisi competitor', 'Sviluppo servizi']
          }
        ],
        impact: {
          revenueChange: 0,
          costChange: 0,
          profitChange: 0,
          occupancyChange: 0,
          confidence: 0.6,
          timeframe: '2-3 mesi'
        },
        confidence: 0.7,
        urgency: 'short-term',
        createdAt: new Date()
      });
    }
    
    return insights;
  }
  
  /**
   * REASONING CHAIN BUILDER: Costruisce catena logica
   */
  private buildReasoningChain(params: {
    observation: string;
    analysisType: string;
    context: HotelContext;
  }): ReasoningChain {
    const { observation, analysisType, context } = params;
    
    switch (analysisType) {
      case 'revenue_decline':
        return {
          observation,
          analysis: this.analyzeRevenueDecline(context),
          causes: this.identifyRevenueDeclineCauses(context),
          consequences: [
            'Riduzione profittabilità complessiva',
            'Difficoltà nel coprire costi fissi',
            'Perdita competitività vs competitor',
            'Rischio di cash flow negativo'
          ],
          logic: this.buildLogicNarrative('revenue_decline', context)
        };
        
      case 'cost_increase':
        return {
          observation,
          analysis: this.analyzeCostIncrease(context),
          causes: this.identifyCostIncreaseCauses(context),
          consequences: [
            'Erosione margini di profitto',
            'Necessità di aumentare prezzi (rischio perdita clienti)',
            'Riduzione competitività',
            'Insostenibilità economica se protratto'
          ],
          logic: this.buildLogicNarrative('cost_increase', context)
        };
        
      case 'occupancy_decline':
        return {
          observation,
          analysis: this.analyzeOccupancyDecline(context),
          causes: this.identifyOccupancyDeclineCauses(context),
          consequences: [
            'Revenue ridotto per camera vuota',
            'Diluizione costi fissi su meno camere',
            'Segnale di problemi competitivi o di mercato',
            'Effetto negativo su review e visibilità online'
          ],
          logic: this.buildLogicNarrative('occupancy_decline', context)
        };
        
      case 'profitability_decline':
        return {
          observation,
          analysis: 'La profittabilità è in calo significativo, indicando problemi strutturali nel modello di business.',
          causes: ['Revenue in calo', 'Costi in aumento', 'Occupazione insufficiente'],
          consequences: [
            'Rischio cash flow negativo',
            'Impossibilità di investimenti',
            'Rischio sostenibilità aziendale'
          ],
          logic: this.buildLogicNarrative('profitability_decline', context)
        };
        
      case 'adr_benchmark':
        return {
          observation,
          analysis: 'Il tuo ADR è significativamente sotto il benchmark di mercato, indicando che stai lasciando revenue sul tavolo.',
          causes: ['Pricing non ottimizzato', 'Strategia pricing conservativa', 'Mancanza di dynamic pricing'],
          consequences: [
            'Revenue perso significativo',
            'Impossibilità di competere su servizi (margini bassi)',
            'Perdita opportunità di crescita'
          ],
          logic: `Il tuo ADR di €${context.kpis.adr.toFixed(0)} è del ${Math.abs(context.benchmarks.adr.gap * 100).toFixed(1)}% sotto benchmark. Questo significa che stai perdendo circa €${((context.benchmarks.adr.benchmark - context.kpis.adr) * this.getAverageRoomsSold() * 25).toFixed(0)}/mese in revenue potenziale.`
        };
        
      case 'occupancy_benchmark':
        return {
          observation,
          analysis: 'La tua occupazione è sotto il benchmark, indicando problemi di domanda o visibilità.',
          causes: ['Marketing insufficiente', 'Recensioni negative', 'Prezzi non competitivi', 'Visibilità online bassa'],
          consequences: [
            'Revenue perso per camere vuote',
            'Diluizione costi su meno camere',
            'Perdita quota di mercato'
          ],
          logic: `Con occupazione al ${(context.kpis.occupazione * 100).toFixed(1)}% vs benchmark ${(context.benchmarks.occupancy.benchmark * 100).toFixed(1)}%, stai perdendo circa ${Math.abs(context.benchmarks.occupancy.gap * 100).toFixed(1)} punti percentuali di occupazione potenziale.`
        };
        
      case 'cost_ratio_benchmark':
        return {
          observation,
          analysis: 'Il tuo cost ratio è sopra il benchmark, indicando inefficienze operative.',
          causes: ['Costi troppo alti', 'Revenue troppo basso', 'Mancanza di controllo costi'],
          consequences: [
            'Margini erosi',
            'Profittabilità ridotta',
            'Difficoltà competitiva'
          ],
          logic: `Con cost ratio del ${(context.benchmarks.costRatio.actual * 100).toFixed(1)}% vs benchmark ${(context.benchmarks.costRatio.benchmark * 100).toFixed(1)}%, stai spendendo troppo rispetto ai ricavi.`
        };
        
      default:
        return this.buildGenericReasoningChain(observation, context);
    }
  }
  
  /**
   * ANALISI REVENUE DECLINE: Identifica cause
   */
  private analyzeRevenueDecline(context: HotelContext): string {
    const { kpis, trends } = context;
    
    let analysis = '';
    
    // Check se è dovuto a occupancy o pricing
    if (trends.occupancy.direction === 'down') {
      analysis += 'Il calo è principalmente dovuto a una riduzione dell\'occupazione (-' + 
                  Math.abs(trends.occupancy.changePercent).toFixed(1) + '%). ';
      analysis += 'Questo indica un problema di domanda o competitività. ';
    } else if (kpis.adr < this.getBenchmarkADR() * 0.9) {
      analysis += 'Il calo è legato a prezzi troppo bassi rispetto al mercato. ';
      analysis += 'L\'ADR attuale (€' + kpis.adr.toFixed(0) + ') è significativamente sotto benchmark (€' + 
                  this.getBenchmarkADR().toFixed(0) + '). ';
    } else {
      analysis += 'Il calo richiede un\'analisi più approfondita delle cause sottostanti. ';
    }
    
    return analysis;
  }
  
  /**
   * IDENTIFICA CAUSE REVENUE DECLINE
   */
  private identifyRevenueDeclineCauses(context: HotelContext): string[] {
    const causes: string[] = [];
    const { kpis, trends, historicalData } = context;
    
    // Causa 1: Pricing non ottimizzato
    if (kpis.adr < this.getBenchmarkADR() * 0.9) {
      causes.push('Pricing sotto mercato - stai lasciando soldi sul tavolo');
    }
    
    // Causa 2: Occupancy bassa
    if (kpis.occupazione < 0.7) {
      causes.push('Occupazione bassa - problemi di marketing o visibilità online');
    }
    
    // Causa 3: Stagionalità
    if (this.isLowSeason(context.currentMonth)) {
      causes.push('Bassa stagione - normale per il periodo, ma gestibile meglio');
    }
    
    // Causa 4: Competitor aggressivi
    const competitorPressure = this.analyzeCompetitorPressure(context);
    if (competitorPressure > 0.7) {
      causes.push('Pressione competitiva alta - competitor hanno prezzi più aggressivi');
    }
    
    // Causa 5: Trend mercato
    if (trends.revenue.direction === 'down' && trends.revenue.timeframe === '3 mesi') {
      causes.push('Trend mercato negativo prolungato - potrebbe indicare problemi strutturali');
    }
    
    return causes;
  }
  
  /**
   * BUILD LOGIC NARRATIVE: Crea reasoning testuale completo
   */
  private buildLogicNarrative(analysisType: string, context: HotelContext): string {
    const { kpis, trends } = context;
    
    let narrative = '';
    
    switch (analysisType) {
      case 'revenue_decline':
        narrative = `Ho osservato un calo del revenue del ${Math.abs(trends.revenue.changePercent).toFixed(1)}% ` +
                   `negli ultimi ${trends.revenue.timeframe}. Analizzando i dati, emerge che `;
        
        if (trends.occupancy.direction === 'down') {
          narrative += `il problema principale è l'occupazione, scesa al ${(kpis.occupazione * 100).toFixed(1)}%. ` +
                      `Questo suggerisce che il mercato è competitivo o che la visibilità online va migliorata. `;
        }
        
        if (kpis.adr < this.getBenchmarkADR() * 0.9) {
          narrative += `Inoltre, il tuo ADR (€${kpis.adr.toFixed(0)}) è ${((1 - kpis.adr / this.getBenchmarkADR()) * 100).toFixed(0)}% ` +
                      `sotto benchmark di mercato (€${this.getBenchmarkADR().toFixed(0)}). ` +
                      `Questo significa che stai probabilmente lasciando revenue sul tavolo. `;
        }
        
        narrative += `Se non interveniamo, questo trend potrebbe portare a una perdita stimata di €${this.estimateRevenueImpactIfIgnored(context).toFixed(0)} nei prossimi 3 mesi. ` +
                    `Le azioni che consiglio sono prioritizzate per massimo impatto con minimo sforzo.`;
        break;
        
      case 'cost_increase':
        narrative = `I costi sono aumentati del ${trends.costs.changePercent.toFixed(1)}% mentre ` +
                   `l'occupazione ${trends.occupancy.direction === 'up' ? 'è aumentata solo del ' + trends.occupancy.changePercent.toFixed(1) + '%' : 'è diminuita'}. ` +
                   `Questo sbilanciamento è insostenibile e erode i margini. `;
        
        // Identifica categorie costi problematiche
        const problematicCostCategories = this.identifyProblematicCostCategories(context);
        if (problematicCostCategories.length > 0) {
          narrative += `Le categorie più problematiche sono: ${problematicCostCategories.join(', ')}. `;
        }
        
        narrative += `Se continuiamo su questa traiettoria, il margine di profitto scenderà sotto il livello di sostenibilità. ` +
                    `È necessario intervenire con azioni mirate di cost control.`;
        break;
        
      case 'occupancy_decline':
        narrative = `L'occupazione è scesa al ${(kpis.occupazione * 100).toFixed(1)}%, una riduzione del ${Math.abs(trends.occupancy.changePercent).toFixed(1)}%. ` +
                   `Ogni camera vuota rappresenta revenue perso che non può essere recuperato. `;
        
        if (kpis.adr > this.getBenchmarkADR() * 1.1) {
          narrative += `Il tuo ADR (€${kpis.adr.toFixed(0)}) è significativamente sopra mercato (€${this.getBenchmarkADR().toFixed(0)}), ` +
                      `il che potrebbe indicare che il prezzo sta limitando la domanda. `;
        } else {
          narrative += `Nonostante prezzi allineati al mercato, l'occupazione è bassa. ` +
                      `Questo suggerisce problemi di visibilità online, recensioni, o posizionamento. `;
        }
        
        narrative += `Ogni punto percentuale di occupazione in più vale circa €${this.calculateRevenuePerOccupancyPoint(context).toFixed(0)}/mese in revenue aggiuntivo. ` +
                    `Le azioni che suggerisco puntano a recuperare almeno ${(Math.abs(trends.occupancy.changePercent) * 0.6).toFixed(1)} punti percentuali.`;
        break;
        
      case 'profitability_decline':
        const gopparForNarrative = kpis.goppar || 0;
        narrative = `La profittabilità è in calo del ${Math.abs(trends.profitability.changePercent).toFixed(1)}%. ` +
                   `Con GOPPAR attuale di €${gopparForNarrative.toFixed(0)}, stai ${gopparForNarrative < 0 ? 'generando perdite' : 'generando profitti minimi'}. ` +
                   `Questo è un segnale critico che richiede intervento immediato. `;
        
        if (trends.revenue.direction === 'down' && trends.costs.direction === 'up') {
          narrative += `Il problema è doppio: revenue in calo E costi in aumento. ` +
                      `Serve un intervento su entrambi i fronti per riportare la profittabilità a livelli sostenibili.`;
        } else if (trends.revenue.direction === 'down') {
          narrative += `Il problema principale è il calo di revenue. ` +
                      `Focus su aumento occupazione e ottimizzazione pricing.`;
        } else {
          narrative += `Il problema principale è l'aumento dei costi. ` +
                      `Focus su controllo costi e ottimizzazione operativa.`;
        }
        break;
    }
    
    return narrative;
  }
  
  /**
   * GENERA RACCOMANDAZIONI REVENUE TREND
   */
  private generateRevenueTrendRecommendations(trend: TrendMetrics): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    
    // Recommendation 1: Dynamic Pricing
    if (this.context.kpis.adr < this.getBenchmarkADR() * 0.95) {
      recommendations.push({
        action: 'Implementa Dynamic Pricing basato su domanda',
        why: `Il tuo ADR (€${this.context.kpis.adr.toFixed(0)}) è sotto benchmark. ` +
             `Nei giorni di alta occupazione (>80%), puoi aumentare prezzi del 15-25% senza perdere prenotazioni.`,
        how: 'Usa i suggerimenti pricing AI nella dashboard. Inizia con aumenti del 10% nei weekend e giorni pre-evento.',
        expectedOutcome: `+€${this.estimateDynamicPricingImpact(this.context).toFixed(0)}/mese in revenue aggiuntivo`,
        effort: 'low',
        timeToImpact: '1-2 settimane',
        dependencies: []
      });
    }
    
    // Recommendation 2: Marketing Push
    if (this.context.kpis.occupazione < 0.75) {
      recommendations.push({
        action: 'Campagna marketing mirata per colmare vuoti',
        why: 'Con occupazione al ' + (this.context.kpis.occupazione * 100).toFixed(0) + '%, hai margine per acquisire più ospiti. ' +
             'Anche con prezzi scontati, revenue incrementale > costo acquisizione.',
        how: 'Promozioni last-minute (7-14 giorni prima), social media ads targeting località vicine, collaborazioni con eventi locali.',
        expectedOutcome: `+${(this.context.kpis.occupazione * 0.1 * 100).toFixed(0)} punti occupazione = +€${this.estimateMarketingCampaignROI(this.context).toFixed(0)}/mese`,
        effort: 'medium',
        timeToImpact: '2-4 settimane',
        dependencies: ['Budget marketing: €500-1000']
      });
    }
    
    // Recommendation 3: Upselling
    recommendations.push({
      action: 'Programma upselling servizi extra',
      why: 'Ogni ospite è un\'opportunità per revenue aggiuntivo a margine alto (colazione, spa, late checkout).',
      how: 'Training staff reception su tecniche upselling, offerte pacchetto check-in, email pre-arrivo con add-ons.',
      expectedOutcome: `+€${this.estimateUpsellImpact(this.context).toFixed(0)}/mese (stima conservativa: €10/ospite su 30% ospiti)`,
      effort: 'low',
      timeToImpact: '1 settimana',
      dependencies: ['Training staff 2h']
    });
    
    return recommendations;
  }
  
  /**
   * GENERA RACCOMANDAZIONI COST TREND
   */
  private generateCostTrendRecommendations(trend: TrendMetrics): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    const problematicCategories = this.identifyProblematicCostCategories(this.context);
    
    if (problematicCategories.includes('Utenze')) {
      recommendations.push({
        action: 'Audit consumi utenze e ottimizzazione',
        why: 'Le utenze rappresentano una quota significativa dei costi e possono essere ottimizzate.',
        how: 'Analizza consumi storici, confronta fornitori, implementa misure di efficienza energetica, considera contratti più vantaggiosi.',
        expectedOutcome: `Riduzione utenze del 10-15% = €${(this.getAverageCosts() * 0.12 * 0.15).toFixed(0)}/mese risparmiati`,
        effort: 'medium',
        timeToImpact: '1-2 mesi',
        dependencies: ['Analisi consumi', 'Confronto fornitori']
      });
    }
    
    if (problematicCategories.includes('Personale')) {
      recommendations.push({
        action: 'Ottimizzazione turni e produttività personale',
        why: 'Il personale è spesso la voce di costo più alta. Ottimizzare turni può ridurre costi senza impatto qualità.',
        how: 'Analizza picchi occupazione, ottimizza turni per matchare domanda, considera part-time per bassa stagione, training per efficienza.',
        expectedOutcome: `Riduzione costi personale del 5-10% = €${(this.getAverageCosts() * 0.35 * 0.075).toFixed(0)}/mese risparmiati`,
        effort: 'high',
        timeToImpact: '1 mese',
        dependencies: ['Analisi turni', 'Coordinamento team']
      });
    }
    
    recommendations.push({
      action: 'Review generale costi e negoziazione fornitori',
      why: 'Molti costi possono essere ridotti con negoziazione o cambio fornitori.',
      how: 'Review tutti i contratti principali, confronta prezzi di mercato, negozia sconti per pagamenti anticipati o volumi.',
      expectedOutcome: `Riduzione costi del 5-8% = €${(this.getAverageCosts() * 0.065).toFixed(0)}/mese risparmiati`,
      effort: 'medium',
      timeToImpact: '1-2 mesi',
      dependencies: []
    });
    
    return recommendations;
  }
  
  /**
   * GENERA RACCOMANDAZIONI OCCUPANCY TREND
   */
  private generateOccupancyTrendRecommendations(trend: TrendMetrics): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    
    recommendations.push({
      action: 'Marketing digitale mirato per aumentare visibilità',
      why: 'Occupazione bassa spesso indica problemi di visibilità online o marketing insufficiente.',
      how: 'Google Ads targeting ricerca hotel nella tua zona, social media marketing, collaborazioni con influencer locali, ottimizzazione SEO sito web.',
      expectedOutcome: `+${(Math.abs(trend.changePercent) * 0.5).toFixed(1)} punti occupazione = +€${(this.calculateRevenuePerOccupancyPoint(this.context) * Math.abs(trend.changePercent) * 0.5).toFixed(0)}/mese`,
      effort: 'medium',
      timeToImpact: '3-4 settimane',
      dependencies: ['Budget marketing: €800-1500']
    });
    
    if (this.context.kpis.adr > this.getBenchmarkADR() * 1.1) {
      recommendations.push({
        action: 'Riduzione prezzi strategica per aumentare domanda',
        why: 'Prezzi troppo alti possono limitare la domanda. Una riduzione del 10-15% può aumentare occupazione significativamente.',
        how: 'Riduci prezzi del 10-15% per periodi di bassa occupazione, mantieni prezzi alti per alta stagione.',
        expectedOutcome: `+${(Math.abs(trend.changePercent) * 0.4).toFixed(1)} punti occupazione (nonostante ADR più basso, revenue totale aumenta)`,
        effort: 'low',
        timeToImpact: 'Immediato',
        dependencies: []
      });
    }
    
    return recommendations;
  }
  
  /**
   * GENERA RACCOMANDAZIONI PROFITABILITY
   */
  private generateProfitabilityRecommendations(trend: TrendMetrics): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    
    recommendations.push({
      action: 'Piano di recupero profittabilità multi-frontale',
      why: 'Profittabilità in calo richiede intervento su più fronti simultaneamente.',
      how: 'Combinazione di: aumento revenue (pricing, marketing, upselling) + riduzione costi (ottimizzazione, negoziazione)',
      expectedOutcome: `Riportare GOPPAR sopra €30-40 per sostenibilità`,
      effort: 'high',
      timeToImpact: '1-2 mesi',
      dependencies: ['Analisi completa', 'Piano d\'azione strutturato']
    });
    
    return recommendations;
  }
  
  /**
   * GENERA RACCOMANDAZIONI ADR BENCHMARK
   */
  private generateADRBenchmarkRecommendations(): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    
    recommendations.push({
      action: 'Aumenta ADR gradualmente verso benchmark',
      why: `Il tuo ADR è del ${Math.abs(this.context.benchmarks.adr.gap * 100).toFixed(1)}% sotto benchmark. Aumentare prezzi può generare revenue significativo senza perdere occupazione.`,
      how: 'Inizia con aumenti del 5-10% nei periodi di alta domanda, monitora occupazione, aumenta gradualmente.',
      expectedOutcome: `+€${((this.context.benchmarks.adr.benchmark - this.context.benchmarks.adr.actual) * this.getAverageRoomsSold() * 25).toFixed(0)}/mese in revenue aggiuntivo`,
      effort: 'low',
      timeToImpact: '1 mese',
      dependencies: []
    });
    
    return recommendations;
  }
  
  /**
   * GENERA RACCOMANDAZIONI OCCUPANCY BENCHMARK
   */
  private generateOccupancyBenchmarkRecommendations(): ActionableRecommendation[] {
    return this.generateOccupancyTrendRecommendations({
      direction: 'down',
      strength: 5,
      changePercent: this.context.benchmarks.occupancy.gap * 100,
      timeframe: 'benchmark',
      significance: 'medium'
    });
  }
  
  /**
   * GENERA RACCOMANDAZIONI COST RATIO
   */
  private generateCostRatioRecommendations(): ActionableRecommendation[] {
    return this.generateCostTrendRecommendations({
      direction: 'up',
      strength: 6,
      changePercent: this.context.benchmarks.costRatio.gap * 100,
      timeframe: 'benchmark',
      significance: 'high'
    });
  }
  
  /**
   * GENERA RACCOMANDAZIONI ANOMALIE
   */
  private generateAnomalyRecommendations(anomaly: Anomaly): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];
    
    if (anomaly.type === 'cost') {
      recommendations.push({
        action: `Investiga e risolvi anomalia costi: ${anomaly.metric}`,
        why: `Questa anomalia rappresenta una deviazione del ${Math.abs(anomaly.deviation).toFixed(1)}% che richiede attenzione.`,
        how: 'Analizza fatture del periodo, confronta con periodi precedenti, identifica cause specifiche.',
        expectedOutcome: `Riduzione costi di €${Math.abs(anomaly.deviation * anomaly.expected / 100).toFixed(0)}/mese`,
        effort: 'medium',
        timeToImpact: '1 mese',
        dependencies: ['Analisi approfondita']
      });
    } else if (anomaly.type === 'revenue') {
      recommendations.push({
        action: `Investiga e risolvi anomalia revenue: ${anomaly.metric}`,
        why: `Questa anomalia rappresenta una perdita potenziale di €${Math.abs(anomaly.deviation * anomaly.expected / 100).toFixed(0)}/mese.`,
        how: 'Analizza prenotazioni, confronta con competitor, verifica pricing strategy.',
        expectedOutcome: `Recupero revenue di €${Math.abs(anomaly.deviation * anomaly.expected / 100).toFixed(0)}/mese`,
        effort: 'medium',
        timeToImpact: '1 mese',
        dependencies: ['Analisi approfondita']
      });
    }
    
    return recommendations;
  }
  
  /**
   * HELPER METHODS - Calcoli e stime
   */
  
  private getAverageRevenue(): number {
    if (this.context.revenueData.length === 0) return 0;
    const recent = this.context.revenueData.slice(-3);
    return recent.reduce((sum, r) => sum + (r.entrateTotali || 0), 0) / recent.length;
  }
  
  private getAverageCosts(): number {
    if (this.context.costsData.length === 0) return 0;
    const recent = this.context.costsData.slice(-3);
    return recent.reduce((sum, c) => {
      const total = (c.personale?.bustePaga || 0) + 
                    (c.personale?.contributiINPS || 0) +
                    (c.utenze?.energia?.importo || 0) +
                    (c.utenze?.gas?.importo || 0) +
                    (c.utenze?.acqua?.importo || 0);
      return sum + total;
    }, 0) / recent.length;
  }
  
  private getAverageOccupancy(): number {
    if (this.context.revenueData.length === 0) return 0;
    const recent = this.context.revenueData.slice(-3);
    return recent.reduce((sum, r) => sum + (r.occupazione || 0), 0) / (recent.length * 100);
  }
  
  private getAverageProfitability(): number {
    return this.context.kpis.goppar || 0;
  }
  
  private getAverageRoomsSold(): number {
    const { hotelData, kpis } = this.context;
    return (hotelData.camereTotali || 30) * kpis.occupazione;
  }
  
  private getBenchmarkADR(): number {
    // Benchmark basato su stelle hotel
    const benchmarks: Record<number, number> = {
      3: 90,
      4: 140,
      5: 220
    };
    return benchmarks[this.context.hotelData.stelle || 3] || 90;
  }
  
  private isLowSeason(month: string): boolean {
    const lowSeasonMonths = ['01', '02', '03', '04', '10', '11', '12'];
    return lowSeasonMonths.includes(month.substring(5, 7));
  }
  
  private analyzeCompetitorPressure(context: HotelContext): number {
    // TODO: Implementa analisi competitor data quando disponibile
    // Per ora return mock basato su occupancy
    if (context.kpis.occupazione < 0.7) return 0.7;
    if (context.kpis.occupazione < 0.8) return 0.5;
    return 0.3;
  }
  
  private identifyProblematicCostCategories(context: HotelContext): string[] {
    const categories: string[] = [];
    if (context.costsData.length === 0) return categories;
    
    const latestCosts = context.costsData[context.costsData.length - 1];
    const avgCosts = this.getAverageCosts();
    
    const utenze = (latestCosts.utenze?.energia?.importo || 0) + 
                   (latestCosts.utenze?.gas?.importo || 0) + 
                   (latestCosts.utenze?.acqua?.importo || 0);
    
    if (utenze > avgCosts * 0.15) {
      categories.push('Utenze');
    }
    
    const personale = (latestCosts.personale?.bustePaga || 0) + 
                      (latestCosts.personale?.contributiINPS || 0);
    
    if (personale > avgCosts * 0.35) {
      categories.push('Personale');
    }
    
    return categories;
  }
  
  private calculateRevenuePerOccupancyPoint(context: HotelContext): number {
    const { hotelData, kpis } = context;
    const roomsPerPoint = (hotelData.camereTotali || 30) * 0.01;
    const avgNightsPerMonth = 25;
    return roomsPerPoint * kpis.adr * avgNightsPerMonth;
  }
  
  private estimateRevenueImpactIfIgnored(context: HotelContext): number {
    const { trends } = context;
    const avgRevenue = this.getAverageRevenue();
    const monthlyDecline = avgRevenue * (trends.revenue.changePercent / 100);
    return Math.abs(monthlyDecline) * 3; // 3 mesi
  }
  
  private estimateDynamicPricingImpact(context: HotelContext): number {
    const { hotelData, kpis } = context;
    const highDemandDays = 8; // ~giorni weekend/mese
    const priceIncrease = kpis.adr * 0.15; // +15%
    const roomsSold = (hotelData.camereTotali || 30) * kpis.occupazione;
    return highDemandDays * priceIncrease * roomsSold;
  }
  
  private estimateMarketingCampaignROI(context: HotelContext): number {
    const { hotelData, kpis } = context;
    const targetOccupancyIncrease = 0.1; // +10 punti percentuali
    const additionalRoomsPerMonth = (hotelData.camereTotali || 30) * targetOccupancyIncrease * 25;
    const avgRevenuePerRoom = kpis.adr * 0.8; // Prezzo scontato
    return additionalRoomsPerMonth * avgRevenuePerRoom;
  }
  
  private estimateUpsellImpact(context: HotelContext): number {
    const { hotelData, kpis } = context;
    const avgGuests = (hotelData.camereTotali || 30) * kpis.occupazione * 1.5 * 25; // guests/mese
    const upsellRate = 0.3; // 30% accepts
    const avgUpsellValue = 10; // €10/guest
    return avgGuests * upsellRate * avgUpsellValue;
  }
  
  private estimateSeasonalPricingImpact(): number {
    const { hotelData, kpis } = this.context;
    const highSeasonDays = 15;
    const priceIncrease = kpis.adr * 0.2; // +20%
    const roomsSold = (hotelData.camereTotali || 30) * 0.85; // Alta occupazione
    return highSeasonDays * priceIncrease * roomsSold;
  }
  
  private estimateImpact(params: {
    type: string;
    baseline: number;
    targetChange: number;
  }): ImpactEstimate {
    const { type, baseline, targetChange } = params;
    
    let revenueChange = 0;
    let costChange = 0;
    let profitChange = 0;
    let occupancyChange = 0;
    
    switch (type) {
      case 'revenue_recovery':
        revenueChange = baseline * (targetChange / 100);
        profitChange = revenueChange * 0.7; // Assume 70% margin
        break;
      case 'cost_reduction':
        costChange = baseline * (targetChange / 100);
        profitChange = Math.abs(costChange);
        break;
      case 'occupancy_improvement':
        occupancyChange = targetChange;
        revenueChange = this.calculateRevenuePerOccupancyPoint(this.context) * occupancyChange;
        profitChange = revenueChange * 0.6;
        break;
      case 'profitability_recovery':
        profitChange = baseline * (targetChange / 100);
        revenueChange = profitChange * 1.2;
        costChange = -profitChange * 0.2;
        break;
    }
    
    return {
      revenueChange,
      costChange,
      profitChange,
      occupancyChange,
      confidence: 0.7,
      timeframe: '1 mese'
    };
  }
  
  private getAnomalyConsequences(anomaly: Anomaly): string[] {
    if (anomaly.type === 'cost') {
      return [
        'Erosione margini di profitto',
        'Riduzione competitività',
        'Necessità di aumentare prezzi'
      ];
    } else if (anomaly.type === 'revenue') {
      return [
        'Perdita revenue potenziale',
        'Riduzione profittabilità',
        'Problemi di cash flow'
      ];
    }
    return ['Impatto negativo su performance'];
  }
  
  private buildAnomalyLogic(anomaly: Anomaly): string {
    return `Ho rilevato un'anomalia nel ${anomaly.metric} del periodo ${anomaly.period}. ` +
           `Il valore attuale (€${anomaly.actual.toFixed(0)}) devia del ${Math.abs(anomaly.deviation).toFixed(1)}% ` +
           `rispetto al valore atteso (€${anomaly.expected.toFixed(0)}). ` +
           `Le possibili cause includono: ${anomaly.possibleCauses.join(', ')}. ` +
           `Questa deviazione ${anomaly.severity === 'critical' ? 'richiede attenzione immediata' : 'merita investigazione'}.`;
  }
  
  private prioritizeInsights(insights: Insight[]): Insight[] {
    return insights.sort((a, b) => {
      // Sort by: priority * confidence * (urgency weight)
      const urgencyWeight: Record<string, number> = { immediate: 1.5, 'short-term': 1.0, 'long-term': 0.7 };
      const scoreA = a.priority * a.confidence * urgencyWeight[a.urgency];
      const scoreB = b.priority * b.confidence * urgencyWeight[b.urgency];
      return scoreB - scoreA;
    });
  }
  
  private buildGenericReasoningChain(observation: string, context: HotelContext): ReasoningChain {
    return {
      observation,
      analysis: 'Richiede analisi approfondita dei dati per identificare cause e conseguenze.',
      causes: [],
      consequences: [],
      logic: observation
    };
  }
}
