// API Route per calcolo KPI - Server Side
import { NextRequest, NextResponse } from 'next/server';
import { calculateKPI } from '../../../../lib/calculations';
import { CostsData, RevenueData, HotelData } from '../../../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { costs, revenues, hotelData } = body;

    // Validazione input
    if (!costs || !revenues) {
      return NextResponse.json(
        { error: 'Costs and revenues data required' },
        { status: 400 }
      );
    }

    // Calcola KPI
    const kpi = calculateKPI(
      costs as Partial<CostsData>,
      revenues as RevenueData[],
      hotelData as HotelData | undefined
    );

    return NextResponse.json({ kpi }, { status: 200 });
  } catch (error: any) {
    console.error('Error calculating KPI:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

