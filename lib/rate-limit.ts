/**
 * Simple in-memory rate limiter for admin login
 * Tracks failed login attempts by IP address
 */

interface RateLimitEntry {
  count: number
  resetAt: number
  blockedUntil?: number
}

// Store rate limit data in memory
// In production, consider using Redis for persistence across server restarts
const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const MAX_ATTEMPTS = 5 // Maximum failed attempts
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes window
const BLOCK_DURATION_MS = 30 * 60 * 1000 // 30 minutes block

/**
 * Clean up expired entries (run periodically)
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000)

/**
 * Check if an IP is currently blocked
 */
export function isBlocked(identifier: string): { blocked: boolean; resetIn?: number } {
  const entry = rateLimitStore.get(identifier)

  if (!entry) {
    return { blocked: false }
  }

  const now = Date.now()

  // Check if blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const resetIn = Math.ceil((entry.blockedUntil - now) / 1000) // seconds
    return { blocked: true, resetIn }
  }

  // Block expired, cleanup
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    rateLimitStore.delete(identifier)
    return { blocked: false }
  }

  return { blocked: false }
}

/**
 * Record a failed login attempt
 * Returns true if the IP should be blocked
 */
export function recordFailedAttempt(identifier: string): {
  shouldBlock: boolean
  attemptsLeft: number
  resetIn: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry) {
    // First failed attempt
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS
    })
    return {
      shouldBlock: false,
      attemptsLeft: MAX_ATTEMPTS - 1,
      resetIn: Math.ceil(WINDOW_MS / 1000)
    }
  }

  // Window expired, reset counter
  if (entry.resetAt < now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS
    })
    return {
      shouldBlock: false,
      attemptsLeft: MAX_ATTEMPTS - 1,
      resetIn: Math.ceil(WINDOW_MS / 1000)
    }
  }

  // Increment counter
  entry.count++

  // Check if should block
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS
    rateLimitStore.set(identifier, entry)
    return {
      shouldBlock: true,
      attemptsLeft: 0,
      resetIn: Math.ceil(BLOCK_DURATION_MS / 1000)
    }
  }

  rateLimitStore.set(identifier, entry)
  return {
    shouldBlock: false,
    attemptsLeft: MAX_ATTEMPTS - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000)
  }
}

/**
 * Clear rate limit for an identifier (e.g., after successful login)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier)
}

/**
 * Get client IP from request headers
 * Supports various proxy headers
 */
export function getClientIP(headers: Headers): string {
  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = headers.get('cf-connecting-ip') // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback
  return 'unknown'
}

/**
 * Format time remaining for user-friendly display
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`
  }
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
}
