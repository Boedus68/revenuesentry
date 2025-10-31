// API Route per analisi costi - Server Side
import { NextRequest, NextResponse } from 'next/server';
import { analyzeCosts, getBenchmarkValues } from '../../../../lib/calculations';
import { CostsData, HotelData } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentCosts, previousCosts, hotelData } = body;

    // Validazione input
    if (!currentCosts) {
      return NextResponse.json(
        { error: 'Current costs data required' },
        { status: 400 }
      );
    }

    // Ottieni benchmark
    const benchmark = getBenchmarkValues(hotelData as HotelData | undefined);

    // Analizza costi
    const analyses = analyzeCosts(
      currentCosts as Partial<CostsData>,
      previousCosts as Partial<CostsData> | undefined,
      benchmark
    );

    return NextResponse.json({ analyses, benchmark }, { status: 200 });
  } catch (error: any) {
    console.error('Error analyzing costs:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

