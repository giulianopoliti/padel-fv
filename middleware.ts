import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Skip middleware for static files and API routes that don't need auth
  const path = request.nextUrl.pathname;
  
  // Skip completely for these patterns
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/api/auth/') ||
    path.includes('.') ||
    path === '/favicon.ico'
  ) {
    return;
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Optimized matcher - only run on paths that actually need auth checking
     * Excludes:
     * - Static files (_next/static, _next/image)
     * - Image optimization files
     * - All file extensions (images, fonts, etc.)
     * - Auth callback routes (handled separately)
     * - Prefetch requests (performance optimization)
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ]
    }
  ],
}