import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getAdminDb } from '@/lib/firebase-admin';
import { logAdmin } from '@/lib/admin-log';

// Configura OpenAI
// Vercel AI Gateway viene usato automaticamente se configurato tramite variabili d'ambiente
// Altrimenti usa OpenAI diretto con OPENAI_API_KEY
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Forza rendering dinamico
export const dynamic = 'force-dynamic';

/**
 * Chatbot API per domande su revenue e dati hotel
 * Usa Vercel AI Gateway con OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, hotelId } = await request.json();

    if (!hotelId) {
      return new Response(
        JSON.stringify({ error: 'hotelId è richiesto' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages è richiesto' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logAdmin('[Chat] Richiesta chat', { hotelId, messagesCount: messages.length });

    // Recupera dati hotel
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error('Firebase Admin non inizializzato');
    }

    const userDoc = await adminDb.collection('users').doc(hotelId).get();
    if (!userDoc.exists) {
      return new Response(
        JSON.stringify({ error: 'Hotel non trovato' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userData = userDoc.data();
    const hotelData = userData?.hotelData || {};
    const revenues: any[] = userData?.revenues || [];
    const costs = userData?.costs || {};
    const monthlyCosts: any[] = userData?.monthlyCosts || [];
    const kpi = userData?.kpi || {};

    // Costruisci contesto con dati hotel
    const contextData = {
      hotelName: hotelData.hotelName || userData?.hotelName || 'Hotel',
      camereTotali: hotelData.camereTotali || 0,
      stelle: hotelData.stelle || 0,
      localita: hotelData.localita || '',
      tipoHotel: hotelData.tipoHotel || 'standard',
      revenues: revenues.slice(-6), // Ultimi 6 mesi
      totalRevenue: revenues.reduce((sum, r) => sum + (r.entrateTotali || 0), 0),
      avgRevenue: revenues.length > 0 
        ? revenues.reduce((sum, r) => sum + (r.entrateTotali || 0), 0) / revenues.length 
        : 0,
      avgOccupancy: revenues.length > 0
        ? revenues.reduce((sum, r) => sum + (r.occupazione || 0), 0) / revenues.length
        : 0,
      avgADR: revenues.length > 0
        ? revenues.reduce((sum, r) => sum + (r.prezzoMedioCamera || 0), 0) / revenues.length
        : 0,
      kpi: {
        revpar: kpi.revpar || 0,
        adr: kpi.adr || 0,
        occupazione: kpi.occupazione || 0,
        gop: kpi.gop || 0,
        gopMargin: kpi.gopMargin || 0,
      },
      costsCount: monthlyCosts.length,
      lastUpdate: userData?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    // Costruisci system prompt con contesto hotel
    const systemPrompt = `Sei un assistente AI esperto di revenue management e gestione hotel. 
Aiuti gli hotel a comprendere i loro dati finanziari, KPI e performance.

DATI HOTEL CORRENTI:
- Nome: ${contextData.hotelName}
- Camere: ${contextData.camereTotali}
- Stelle: ${contextData.stelle}
- Località: ${contextData.localita}
- Tipo: ${contextData.tipoHotel}

KPI CORRENTI:
- RevPAR: €${contextData.kpi.revpar.toFixed(2)}
- ADR: €${contextData.kpi.adr.toFixed(2)}
- Occupazione: ${contextData.kpi.occupazione.toFixed(1)}%
- GOP: €${contextData.kpi.gop.toFixed(2)}
- GOP Margin: ${contextData.kpi.gopMargin.toFixed(1)}%

RICAVI (ultimi 6 mesi):
${contextData.revenues.map(r => 
  `- ${r.mese}: €${r.entrateTotali?.toFixed(2) || 0}, Occupazione: ${r.occupazione?.toFixed(1) || 0}%, ADR: €${r.prezzoMedioCamera?.toFixed(2) || 0}`
).join('\n')}

Rispondi in italiano, in modo chiaro e professionale. 
Se l'utente chiede dati specifici che non hai nel contesto, indica che non sono disponibili.
Fornisci analisi pratiche e suggerimenti concreti basati sui dati disponibili.`;

    // Usa OpenAI con AI Gateway (se configurato) o OpenAI diretto
    const result = await streamText({
      model: openai('gpt-4o-mini'), // Usa modello economico per chat
      system: systemPrompt,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      maxTokens: 1000,
      temperature: 0.7,
    });

    logAdmin('[Chat] Risposta generata');

    return result.toDataStreamResponse();

  } catch (error: any) {
    logAdmin('[Chat] Errore', { error: error.message, stack: error.stack });
    
    return new Response(
      JSON.stringify({ 
        error: 'Errore nella generazione risposta',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

