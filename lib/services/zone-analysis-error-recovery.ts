/**
 * ZONE ANALYSIS ERROR RECOVERY SERVICE
 * 
 * Implements circuit breaker pattern and error recovery for zone analysis operations.
 * Provides graceful degradation when analysis systems fail.
 * 
 * DESIGN PRINCIPLES:
 * - Circuit Breaker: Fail fast when system is degraded
 * - Error Classification: Different handling for different error types
 * - Automatic Recovery: Self-healing when conditions improve
 * - Metrics Collection: Track failure patterns for monitoring
 */

import { createClient } from '@/utils/supabase/server'
import type { ZoneMatchCompletionEvent } from './zone-match-completion-trigger'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorRecord {
  eventId: string
  zoneId: string
  tournamentId: string
  errorMessage: string
  severity: ErrorSeverity
  timestamp: string
  context?: Record<string, any>
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
  lastFailureTime: number
  nextRetryTime: number
  successCount: number
}

export interface RecoveryConfig {
  failureThreshold: number      // Failures before opening circuit
  recoveryTimeoutMs: number     // Time to wait before half-open
  successThreshold: number      // Successes needed to close circuit
  maxErrorHistory: number       // Max errors to keep in memory
  criticalErrorCooldownMs: number // Extended cooldown for critical errors
}

// ============================================================================
// ZONE ANALYSIS ERROR RECOVERY SERVICE
// ============================================================================

export class ZoneAnalysisErrorRecoveryService {
  private circuitBreaker: CircuitBreakerState
  private errorHistory: ErrorRecord[] = []
  private config: RecoveryConfig
  private errorCountByZone = new Map<string, number>()
  private lastErrorByType = new Map<string, number>()

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000, // 1 minute
      successThreshold: 3,
      maxErrorHistory: 100,
      criticalErrorCooldownMs: 300000, // 5 minutes
      ...config
    }

    this.circuitBreaker = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      successCount: 0
    }

    console.log('🔧 [ERROR-RECOVERY] Initialized with config:', this.config)
  }

  /**
   * Check if a request can be processed based on circuit breaker state
   */
  canProcessRequest(): { allowed: boolean; reason?: string } {
    const now = Date.now()

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return { allowed: true }
      
      case 'OPEN':
        if (now >= this.circuitBreaker.nextRetryTime) {
          this.circuitBreaker.state = 'HALF_OPEN'
          this.circuitBreaker.successCount = 0
          console.log('🔄 [ERROR-RECOVERY] Circuit breaker moved to HALF_OPEN')
          return { allowed: true }
        }
        return { 
          allowed: false, 
          reason: `Circuit breaker OPEN until ${new Date(this.circuitBreaker.nextRetryTime).toISOString()}` 
        }
      
      case 'HALF_OPEN':
        return { allowed: true }
      
      default:
        return { allowed: false, reason: 'Unknown circuit breaker state' }
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    const prevState = this.circuitBreaker.state

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.successCount++
      
      if (this.circuitBreaker.successCount >= this.config.successThreshold) {
        this.circuitBreaker.state = 'CLOSED'
        this.circuitBreaker.failureCount = 0
        console.log('✅ [ERROR-RECOVERY] Circuit breaker CLOSED - system recovered')
      }
    } else if (this.circuitBreaker.state === 'CLOSED') {
      // Reset failure count on success
      this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1)
    }

    if (prevState !== this.circuitBreaker.state) {
      console.log(`🔄 [ERROR-RECOVERY] State transition: ${prevState} → ${this.circuitBreaker.state}`)
    }
  }

  /**
   * Record a failure and update circuit breaker state
   */
  async recordFailure(
    event: ZoneMatchCompletionEvent, 
    errorMessage: string, 
    severity: ErrorSeverity
  ): Promise<void> {
    const now = Date.now()
    
    // Create error record
    const errorRecord: ErrorRecord = {
      eventId: `${event.matchId}_${event.zoneId}_${now}`,
      zoneId: event.zoneId,
      tournamentId: event.tournamentId,
      errorMessage,
      severity,
      timestamp: new Date().toISOString(),
      context: {
        matchId: event.matchId,
        triggerSource: event.metadata?.triggerSource,
        isModification: event.metadata?.isModification
      }
    }

    // Add to history
    this.addToErrorHistory(errorRecord)

    // Update zone-specific error counts
    const zoneErrors = this.errorCountByZone.get(event.zoneId) || 0
    this.errorCountByZone.set(event.zoneId, zoneErrors + 1)

    // Update circuit breaker based on severity
    this.updateCircuitBreakerOnFailure(severity, now)

    // Log the failure
    console.error(`❌ [ERROR-RECOVERY] Recorded ${severity} failure:`, {
      zone: event.zoneId,
      tournament: event.tournamentId,
      error: errorMessage,
      circuitState: this.circuitBreaker.state
    })

    // Store critical errors for longer-term analysis
    if (severity === 'CRITICAL') {
      await this.storeCriticalError(errorRecord)
    }
  }

  /**
   * Update circuit breaker state based on failure severity
   */
  private updateCircuitBreakerOnFailure(severity: ErrorSeverity, timestamp: number): void {
    const prevState = this.circuitBreaker.state

    // Increment failure count based on severity
    const failureWeight = this.getFailureWeight(severity)
    this.circuitBreaker.failureCount += failureWeight
    this.circuitBreaker.lastFailureTime = timestamp

    // Open circuit if threshold exceeded
    if (this.circuitBreaker.failureCount >= this.config.failureThreshold) {
      this.circuitBreaker.state = 'OPEN'
      
      // Calculate recovery time based on severity
      const recoveryDelay = severity === 'CRITICAL' 
        ? this.config.criticalErrorCooldownMs 
        : this.config.recoveryTimeoutMs
      
      this.circuitBreaker.nextRetryTime = timestamp + recoveryDelay
    } else if (this.circuitBreaker.state === 'HALF_OPEN') {
      // Any failure in half-open state reopens the circuit
      this.circuitBreaker.state = 'OPEN'
      this.circuitBreaker.nextRetryTime = timestamp + this.config.recoveryTimeoutMs
    }

    if (prevState !== this.circuitBreaker.state) {
      console.warn(`⚠️ [ERROR-RECOVERY] State transition: ${prevState} → ${this.circuitBreaker.state}`)
    }
  }

  /**
   * Get failure weight for different severities
   */
  private getFailureWeight(severity: ErrorSeverity): number {
    switch (severity) {
      case 'LOW': return 0.5
      case 'MEDIUM': return 1
      case 'HIGH': return 2
      case 'CRITICAL': return 3
      default: return 1
    }
  }

  /**
   * Add error to history with size limit
   */
  private addToErrorHistory(errorRecord: ErrorRecord): void {
    this.errorHistory.push(errorRecord)
    
    // Maintain size limit
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory)
    }
  }

  /**
   * Store critical errors for long-term analysis
   */
  private async storeCriticalError(errorRecord: ErrorRecord): Promise<void> {
    try {
      const supabase = await createClient()
      
      await supabase
        .from('zone_analysis_errors')
        .insert({
          event_id: errorRecord.eventId,
          zone_id: errorRecord.zoneId,
          tournament_id: errorRecord.tournamentId,
          error_message: errorRecord.errorMessage,
          severity: errorRecord.severity,
          context: errorRecord.context,
          created_at: errorRecord.timestamp
        })
    } catch (dbError) {
      console.error('❌ [ERROR-RECOVERY] Failed to store critical error:', dbError)
      // Don't throw - we don't want to fail the main operation
    }
  }

  /**
   * Get current system health status
   */
  getHealthStatus() {
    const recentErrors = this.getRecentErrors(300000) // Last 5 minutes
    const errorsByZone = this.getErrorsByZone()
    
    return {
      circuitBreaker: this.circuitBreaker,
      recentErrorCount: recentErrors.length,
      totalErrorCount: this.errorHistory.length,
      errorsByZone: Object.fromEntries(errorsByZone),
      systemHealth: this.calculateSystemHealth(),
      lastError: this.errorHistory[this.errorHistory.length - 1]?.timestamp
    }
  }

  /**
   * Get recent errors within time window
   */
  private getRecentErrors(timeWindowMs: number): ErrorRecord[] {
    const cutoff = Date.now() - timeWindowMs
    return this.errorHistory.filter(error => 
      new Date(error.timestamp).getTime() > cutoff
    )
  }

  /**
   * Get error counts by zone
   */
  private getErrorsByZone(): Map<string, number> {
    return new Map(this.errorCountByZone)
  }

  /**
   * Calculate overall system health score (0-1)
   */
  private calculateSystemHealth(): number {
    if (this.circuitBreaker.state === 'OPEN') return 0.1
    if (this.circuitBreaker.state === 'HALF_OPEN') return 0.5
    
    const recentErrors = this.getRecentErrors(300000) // Last 5 minutes
    if (recentErrors.length === 0) return 1.0
    
    // Degrade health based on recent error frequency
    const maxRecentErrors = 10
    const healthScore = Math.max(0.1, 1.0 - (recentErrors.length / maxRecentErrors))
    
    return healthScore
  }

  /**
   * Reset circuit breaker (for manual intervention)
   */
  forceReset(): void {
    console.log('🔄 [ERROR-RECOVERY] Manual circuit breaker reset')
    
    this.circuitBreaker = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextRetryTime: 0,
      successCount: 0
    }
    
    this.errorCountByZone.clear()
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics() {
    return {
      config: this.config,
      circuitBreaker: this.circuitBreaker,
      errorHistory: this.errorHistory.slice(-10), // Last 10 errors
      errorsByZone: Object.fromEntries(this.errorCountByZone),
      healthStatus: this.getHealthStatus()
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalErrorRecoveryService: ZoneAnalysisErrorRecoveryService | null = null

export function getZoneAnalysisErrorRecoveryService(
  config?: Partial<RecoveryConfig>
): ZoneAnalysisErrorRecoveryService {
  if (!globalErrorRecoveryService) {
    globalErrorRecoveryService = new ZoneAnalysisErrorRecoveryService(config)
  }
  return globalErrorRecoveryService
}