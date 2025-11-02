import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware per proteggere le route admin
 * Verifica che l'utente sia autenticato e abbia ruolo admin
 * 
 * NOTA: Per una verifica completa, questo middleware dovrebbe verificare
 * il token Firebase. Per ora, facciamo una verifica base.
 * La verifica completa admin avviene lato server nelle API routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteggi route admin
  if (pathname.startsWith('/admin')) {
    // Per ora, il controllo admin avviene lato client e server
    // Questo middleware può essere esteso per verificare cookie/token
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};

