/**
 * NATURAL LANGUAGE GENERATOR - Genera comunicazioni in linguaggio naturale
 * 
 * Converte insights strutturati in messaggi comprensibili e naturali
 */

import { Insight, ReasoningChain, ActionableRecommendation, ImpactEstimate } from './reasoning-engine';

export interface NaturalLanguageMessage {
  title: string;
  summary: string;
  detailedExplanation: string;
  recommendations: string[];
  impactSummary: string;
  urgencyMessage: string;
}

export class NaturalLanguageGenerator {
  
  /**
   * Genera messaggio completo in linguaggio naturale da Insight
   */
  public generateMessage(insight: Insight): NaturalLanguageMessage {
    return {
      title: this.generateTitle(insight),
      summary: this.generateSummary(insight),
      detailedExplanation: this.generateDetailedExplanation(insight),
      recommendations: this.generateRecommendationsText(insight.recommendations),
      impactSummary: this.generateImpactSummary(insight.impact),
      urgencyMessage: this.generateUrgencyMessage(insight)
    };
  }
  
  /**
   * Genera titolo naturale
   */
  private generateTitle(insight: Insight): string {
    return insight.title;
  }
  
  /**
   * Genera summary breve e comprensibile
   */
  private generateSummary(insight: Insight): string {
    const categoryEmoji = {
      'opportunity': '💡',
      'problem': '⚠️',
      'risk': '🚨',
      'achievement': '🎉'
    };
    
    const emoji = categoryEmoji[insight.category] || '📊';
    
    return `${emoji} ${insight.description} ` +
           `Confidenza: ${(insight.confidence * 100).toFixed(0)}%. ` +
           `Priorità: ${insight.priority}/10.`;
  }
  
  /**
   * Genera spiegazione dettagliata con reasoning
   */
  private generateDetailedExplanation(insight: Insight): string {
    const { reasoning } = insight;
    
    let explanation = `📊 **Cosa ho osservato:**\n${reasoning.observation}\n\n`;
    
    explanation += `🔍 **Analisi:**\n${reasoning.analysis}\n\n`;
    
    if (reasoning.causes.length > 0) {
      explanation += `🔎 **Possibili cause:**\n`;
      reasoning.causes.forEach((cause, idx) => {
        explanation += `${idx + 1}. ${cause}\n`;
      });
      explanation += '\n';
    }
    
    if (reasoning.consequences.length > 0) {
      explanation += `⚠️ **Cosa succede se ignori:**\n`;
      reasoning.consequences.forEach((consequence, idx) => {
        explanation += `${idx + 1}. ${consequence}\n`;
      });
      explanation += '\n';
    }
    
    explanation += `💭 **Ragionamento completo:**\n${reasoning.logic}`;
    
    return explanation;
  }
  
  /**
   * Genera testo raccomandazioni in linguaggio naturale
   */
  private generateRecommendationsText(recommendations: ActionableRecommendation[]): string[] {
    return recommendations.map((rec, idx) => {
      const effortEmoji = {
        'low': '🟢',
        'medium': '🟡',
        'high': '🔴'
      };
      
      return `**${idx + 1}. ${rec.action}** ${effortEmoji[rec.effort]}\n` +
             `   💡 **Perché:** ${rec.why}\n` +
             `   📋 **Come:** ${rec.how}\n` +
             `   🎯 **Risultato atteso:** ${rec.expectedOutcome}\n` +
             `   ⏱️ **Tempo impatto:** ${rec.timeToImpact}` +
             (rec.dependencies.length > 0 ? `\n   📌 **Dipendenze:** ${rec.dependencies.join(', ')}` : '');
    });
  }
  
  /**
   * Genera summary impatto in linguaggio naturale
   */
  private generateImpactSummary(impact: ImpactEstimate): string {
    const parts: string[] = [];
    
    if (Math.abs(impact.revenueChange) > 0.01) {
      const sign = impact.revenueChange > 0 ? '+' : '';
      parts.push(`💰 Revenue: ${sign}€${Math.abs(impact.revenueChange).toFixed(0)}`);
    }
    
    if (Math.abs(impact.costChange) > 0.01) {
      const sign = impact.costChange > 0 ? '+' : '';
      parts.push(`💸 Costi: ${sign}€${Math.abs(impact.costChange).toFixed(0)}`);
    }
    
    if (Math.abs(impact.profitChange) > 0.01) {
      const sign = impact.profitChange > 0 ? '+' : '';
      parts.push(`📈 Profitto: ${sign}€${Math.abs(impact.profitChange).toFixed(0)}`);
    }
    
    if (Math.abs(impact.occupancyChange) > 0.01) {
      const sign = impact.occupancyChange > 0 ? '+' : '';
      parts.push(`🏨 Occupazione: ${sign}${Math.abs(impact.occupancyChange).toFixed(1)}%`);
    }
    
    if (parts.length === 0) {
      return 'Impatto da valutare in base all\'implementazione';
    }
    
    return parts.join(' | ') + ` (${impact.timeframe}, confidenza: ${(impact.confidence * 100).toFixed(0)}%)`;
  }
  
  /**
   * Genera messaggio urgenza
   */
  private generateUrgencyMessage(insight: Insight): string {
    const urgencyMessages = {
      'immediate': '🚨 **AZIONE IMMEDIATA RICHIESTA** - Questo problema richiede attenzione entro 1 settimana per evitare conseguenze significative.',
      'short-term': '⏰ **AZIONE A BREVE TERMINE** - Consigliato intervenire entro 2-4 settimane per massimizzare l\'impatto positivo.',
      'long-term': '📅 **PIANIFICAZIONE STRATEGICA** - Questa opportunità può essere pianificata nei prossimi 1-3 mesi per ottimale implementazione.'
    };
    
    return urgencyMessages[insight.urgency];
  }
  
  /**
   * Genera messaggio completo formattato per UI
   */
  public generateFormattedMessage(insight: Insight): string {
    const message = this.generateMessage(insight);
    
    let formatted = `# ${message.title}\n\n`;
    formatted += `${message.summary}\n\n`;
    formatted += `---\n\n`;
    formatted += `${message.detailedExplanation}\n\n`;
    formatted += `---\n\n`;
    formatted += `## 💡 Raccomandazioni\n\n`;
    message.recommendations.forEach((rec, idx) => {
      formatted += `${rec}\n\n`;
    });
    formatted += `---\n\n`;
    formatted += `## 📊 Impatto Stimato\n\n${message.impactSummary}\n\n`;
    formatted += `---\n\n`;
    formatted += `${message.urgencyMessage}`;
    
    return formatted;
  }
  
  /**
   * Genera messaggio breve per notifiche
   */
  public generateBriefNotification(insight: Insight): string {
    const categoryEmoji = {
      'opportunity': '💡',
      'problem': '⚠️',
      'risk': '🚨',
      'achievement': '🎉'
    };
    
    const emoji = categoryEmoji[insight.category] || '📊';
    
    return `${emoji} **${insight.title}**\n\n` +
           `${insight.description}\n\n` +
           `Priorità: ${insight.priority}/10 | Urgenza: ${this.translateUrgency(insight.urgency)}`;
  }
  
  private translateUrgency(urgency: string): string {
    const translations: Record<string, string> = {
      'immediate': 'Immediata',
      'short-term': 'Breve termine',
      'long-term': 'Lungo termine'
    };
    return translations[urgency] || urgency;
  }
}
