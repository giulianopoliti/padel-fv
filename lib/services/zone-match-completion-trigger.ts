/**
 * ZONE MATCH COMPLETION TRIGGER SERVICE
 * 
 * Handles automated zone analysis when zone matches are completed.
 * Optimized for single-zone analysis with intelligent batching and error recovery.
 * 
 * DESIGN PRINCIPLES:
 * - Single Responsibility: Only handles zone match completion events
 * - Fail-Safe: Graceful degradation if analysis fails
 * - Performance-Optimized: Zone-specific analysis instead of tournament-wide
 * - Idempotent: Safe to call multiple times for same match
 * - Event-Driven: Reactive to match state changes
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-22
 */

import { createClient } from '@/utils/supabase/server'
import { CorrectedDefinitiveAnalyzer } from './corrected-definitive-analyzer'
import type { ZoneAnalysisResult } from './corrected-definitive-analyzer'
import { getZoneAnalysisErrorRecoveryService } from './zone-analysis-error-recovery'
import type { ZoneAnalysisErrorRecoveryService } from './zone-analysis-error-recovery'
import { recordZoneAnalysisMetric } from './zone-analysis-metrics'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ZoneMatchCompletionEvent {
  matchId: string
  tournamentId: string
  zoneId: string
  winnerCoupleId: string
  completedAt: string
  metadata?: {
    previousStatus?: string
    isModification?: boolean
    triggerSource: 'MATCH_UPDATE' | 'MANUAL' | 'BATCH'
  }
}

export interface ZoneAnalysisTriggerResult {
  success: boolean
  event: ZoneMatchCompletionEvent
  analysisExecuted: boolean
  zoneAnalysis?: ZoneAnalysisResult
  updatesApplied: number
  processingTimeMs: number
  optimizationsUsed: string[]
  error?: string
  skipReason?: string
}

export interface ZoneAnalysisConfig {
  enableImmediateAnalysis: boolean
  debounceMs: number
  maxConcurrentZones: number
  analysisTimeoutMs: number
  enableCaching: boolean
  cacheTimeoutMs: number
}

// ============================================================================
// ZONE MATCH COMPLETION TRIGGER SERVICE
// ============================================================================

export class ZoneMatchCompletionTriggerService {
  private analyzer: CorrectedDefinitiveAnalyzer
  private errorRecovery: ZoneAnalysisErrorRecoveryService
  private config: ZoneAnalysisConfig
  private processingZones = new Set<string>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private recentAnalysis = new Map<string, { timestamp: number; result: ZoneAnalysisResult }>()

  constructor(config: Partial<ZoneAnalysisConfig> = {}) {
    this.analyzer = new CorrectedDefinitiveAnalyzer()
    this.errorRecovery = getZoneAnalysisErrorRecoveryService()
    this.config = {
      enableImmediateAnalysis: true,
      debounceMs: 3000, // 3 seconds debounce
      maxConcurrentZones: 5,
      analysisTimeoutMs: 10000, // 10 seconds max
      enableCaching: true,
      cacheTimeoutMs: 60000, // 1 minute cache
      ...config
    }

    console.log('🔧 [ZONE-TRIGGER] Initialized with config:', this.config)
  }

  /**
   * MAIN ENTRY POINT: Process zone match completion
   * This should be called from the match update endpoint when a zone match completes
   */
  async processZoneMatchCompletion(event: ZoneMatchCompletionEvent): Promise<ZoneAnalysisTriggerResult> {
    const startTime = performance.now()
    
    console.log(`📊 [ZONE-TRIGGER] Processing zone match completion:`, {
      matchId: event.matchId,
      zoneId: event.zoneId,
      winner: event.winnerCoupleId,
      source: event.metadata?.triggerSource
    })

    try {
      // 1. Check circuit breaker status
      const circuitCheck = this.errorRecovery.canProcessRequest()
      if (!circuitCheck.allowed) {
        console.warn(`🔒 [ZONE-TRIGGER] Circuit breaker blocked request: ${circuitCheck.reason}`)
        return this.createSkippedResult(event, startTime, circuitCheck.reason!)
      }

      // 2. Validate event
      const validationError = this.validateEvent(event)
      if (validationError) {
        await this.errorRecovery.recordFailure(event, validationError, 'LOW')
        return this.createErrorResult(event, startTime, validationError, 'VALIDATION_FAILED')
      }

      // 3. Check if analysis should be skipped
      const shouldSkip = this.shouldSkipAnalysis(event)
      if (shouldSkip) {
        return this.createSkippedResult(event, startTime, shouldSkip)
      }

      // 4. Handle debouncing for rapid successive completions
      if (this.config.debounceMs > 0) {
        return await this.handleDebouncedAnalysis(event)
      }

      // 5. Execute immediate analysis
      return await this.executeZoneAnalysis(event)

    } catch (error: any) {
      console.error('❌ [ZONE-TRIGGER] Unexpected error:', error)
      await this.errorRecovery.recordFailure(event, error.message, 'HIGH')
      return this.createErrorResult(event, startTime, error.message, 'UNEXPECTED_ERROR')
    }
  }

  /**
   * Execute zone analysis with proper concurrency control and error handling
   */
  private async executeZoneAnalysis(event: ZoneMatchCompletionEvent): Promise<ZoneAnalysisTriggerResult> {
    const startTime = performance.now()
    const { zoneId } = event

    // Check concurrency limits
    if (this.processingZones.size >= this.config.maxConcurrentZones) {
      return this.createSkippedResult(
        event, 
        startTime, 
        `Max concurrent analyses reached (${this.config.maxConcurrentZones})`
      )
    }

    // Mark zone as processing
    this.processingZones.add(zoneId)

    try {
      console.log(`🔍 [ZONE-TRIGGER] Executing analysis for zone ${zoneId}`)

      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedAnalysis(zoneId)
        if (cached) {
          console.log(`⚡ [ZONE-TRIGGER] Using cached analysis for zone ${zoneId}`)
          
          const updatesApplied = await this.updateDatabaseWithAnalysis(zoneId, cached)
          
          return {
            success: true,
            event,
            analysisExecuted: true,
            zoneAnalysis: cached,
            updatesApplied,
            processingTimeMs: performance.now() - startTime,
            optimizationsUsed: ['CACHE_HIT']
          }
        }
      }

      // Execute fresh analysis with timeout
      const analysisResult = await this.executeWithTimeout(
        () => this.analyzer.analyzeZonePositions(zoneId),
        this.config.analysisTimeoutMs,
        `Zone analysis timeout for ${zoneId}`
      )

      console.log(`✅ [ZONE-TRIGGER] Analysis complete for zone ${zoneId}:`, {
        totalCouples: analysisResult.totalCouples,
        definitive: analysisResult.definitivePositions,
        computationTime: analysisResult.totalComputationTime
      })

      // Update database
      const updatesApplied = await this.updateDatabaseWithAnalysis(zoneId, analysisResult)

      // Cache result
      if (this.config.enableCaching) {
        this.cacheAnalysis(zoneId, analysisResult)
      }

      // Record success for circuit breaker
      this.errorRecovery.recordSuccess()

      // Record metrics for monitoring
      recordZoneAnalysisMetric(
        zoneId,
        event.tournamentId,
        performance.now() - startTime,
        {
          success: true,
          couplesAnalyzed: analysisResult.totalCouples,
          definitiveFound: analysisResult.definitivePositions,
          optimizationsUsed: analysisResult.optimizationsApplied,
          analysisMethod: this.getAnalysisMethodFromOptimizations(analysisResult.optimizationsApplied)
        },
        event.metadata?.triggerSource || 'MATCH_UPDATE'
      )

      return {
        success: true,
        event,
        analysisExecuted: true,
        zoneAnalysis: analysisResult,
        updatesApplied,
        processingTimeMs: performance.now() - startTime,
        optimizationsUsed: analysisResult.optimizationsApplied
      }

    } catch (error: any) {
      console.error(`❌ [ZONE-TRIGGER] Analysis failed for zone ${zoneId}:`, error)
      
      // Record failure for error recovery
      await this.errorRecovery.recordFailure(event, error.message, 'MEDIUM')
      
      // Record failure metrics
      recordZoneAnalysisMetric(
        zoneId,
        event.tournamentId,
        performance.now() - startTime,
        {
          success: false,
          couplesAnalyzed: 0,
          definitiveFound: 0,
          optimizationsUsed: [],
          analysisMethod: 'BACKTRACKING', // Default for unknown failures
          errorType: 'ANALYSIS_FAILED'
        },
        event.metadata?.triggerSource || 'MATCH_UPDATE'
      )
      
      return this.createErrorResult(event, startTime, error.message, 'ANALYSIS_FAILED')
    } finally {
      this.processingZones.delete(zoneId)
    }
  }

  /**
   * Handle debounced analysis to prevent spam from rapid match completions
   */
  private async handleDebouncedAnalysis(event: ZoneMatchCompletionEvent): Promise<ZoneAnalysisTriggerResult> {
    const startTime = performance.now()
    const { zoneId } = event

    // Cancel existing timer for this zone
    if (this.debounceTimers.has(zoneId)) {
      clearTimeout(this.debounceTimers.get(zoneId)!)
      this.debounceTimers.delete(zoneId)
    }

    // Set up new debounced execution
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(zoneId)
        
        try {
          const result = await this.executeZoneAnalysis(event)
          resolve(result)
        } catch (error: any) {
          resolve(this.createErrorResult(event, startTime, error.message, 'DEBOUNCE_ERROR'))
        }
      }, this.config.debounceMs)

      this.debounceTimers.set(zoneId, timer)

      // Return immediate acknowledgment
      resolve({
        success: true,
        event,
        analysisExecuted: false,
        updatesApplied: 0,
        processingTimeMs: performance.now() - startTime,
        optimizationsUsed: ['DEBOUNCED'],
        skipReason: `Debounced for ${this.config.debounceMs}ms`
      })
    })
  }

  /**
   * Update database with analysis results
   */
  private async updateDatabaseWithAnalysis(zoneId: string, analysis: ZoneAnalysisResult): Promise<number> {
    try {
      const supabase = await createClient()
      let updatesApplied = 0

      for (const coupleAnalysis of analysis.analysis) {
        const { error } = await supabase
          .from('zone_positions')
          .update({
            is_definitive: coupleAnalysis.isDefinitive,
            updated_at: new Date().toISOString()
          })
          .eq('zone_id', zoneId)
          .eq('couple_id', coupleAnalysis.coupleId)

        if (error) {
          console.error(`❌ [ZONE-TRIGGER] Failed to update couple ${coupleAnalysis.coupleId}:`, error)
        } else {
          updatesApplied++
        }
      }

      console.log(`📝 [ZONE-TRIGGER] Database updated: ${updatesApplied} couples in zone ${zoneId}`)
      return updatesApplied

    } catch (error: any) {
      console.error(`❌ [ZONE-TRIGGER] Database update failed:`, error)
      return 0
    }
  }

  /**
   * Validation and utility methods
   */
  private validateEvent(event: ZoneMatchCompletionEvent): string | null {
    if (!event.matchId) return 'Missing matchId'
    if (!event.tournamentId) return 'Missing tournamentId'
    if (!event.zoneId) return 'Missing zoneId'
    if (!event.winnerCoupleId) return 'Missing winnerCoupleId'
    if (!event.completedAt) return 'Missing completedAt'
    return null
  }

  private shouldSkipAnalysis(event: ZoneMatchCompletionEvent): string | null {
    const { zoneId, metadata } = event

    // Skip if disabled
    if (!this.config.enableImmediateAnalysis) {
      return 'Immediate analysis disabled'
    }

    // Skip if already processing this zone
    if (this.processingZones.has(zoneId)) {
      return 'Zone already being processed'
    }

    // Skip if this is a modification and we have recent analysis
    if (metadata?.isModification && this.hasRecentAnalysis(zoneId)) {
      return 'Recent analysis available for modification'
    }

    return null
  }

  private hasRecentAnalysis(zoneId: string): boolean {
    const cached = this.recentAnalysis.get(zoneId)
    if (!cached) return false
    
    const ageMs = Date.now() - cached.timestamp
    return ageMs < this.config.cacheTimeoutMs
  }

  private getCachedAnalysis(zoneId: string): ZoneAnalysisResult | null {
    const cached = this.recentAnalysis.get(zoneId)
    if (!cached) return null
    
    const ageMs = Date.now() - cached.timestamp
    if (ageMs > this.config.cacheTimeoutMs) {
      this.recentAnalysis.delete(zoneId)
      return null
    }
    
    return cached.result
  }

  private cacheAnalysis(zoneId: string, result: ZoneAnalysisResult): void {
    this.recentAnalysis.set(zoneId, {
      timestamp: Date.now(),
      result
    })
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, timeoutMs)

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer))
    })
  }

  // Result builders
  private createErrorResult(
    event: ZoneMatchCompletionEvent, 
    startTime: number, 
    error: string,
    errorType: string
  ): ZoneAnalysisTriggerResult {
    return {
      success: false,
      event,
      analysisExecuted: false,
      updatesApplied: 0,
      processingTimeMs: performance.now() - startTime,
      optimizationsUsed: [],
      error: `${errorType}: ${error}`
    }
  }

  private createSkippedResult(
    event: ZoneMatchCompletionEvent,
    startTime: number,
    skipReason: string
  ): ZoneAnalysisTriggerResult {
    return {
      success: true,
      event,
      analysisExecuted: false,
      updatesApplied: 0,
      processingTimeMs: performance.now() - startTime,
      optimizationsUsed: ['SKIPPED'],
      skipReason
    }
  }

  /**
   * Public utilities and cleanup
   */
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Clear caches
    this.recentAnalysis.clear()
    this.processingZones.clear()

    // Cleanup analyzer
    this.analyzer.clearCache()

    console.log('🧹 [ZONE-TRIGGER] Cleanup completed')
  }

  getStatus() {
    return {
      processingZones: Array.from(this.processingZones),
      debouncedZones: Array.from(this.debounceTimers.keys()),
      cachedAnalyses: this.recentAnalysis.size,
      config: this.config
    }
  }

  /**
   * Helper method to determine analysis method from optimizations
   */
  private getAnalysisMethodFromOptimizations(optimizations: string[]): 'FAST_VALIDATION' | 'CONSTRAINT_ANALYSIS' | 'BACKTRACKING' {
    if (optimizations.some(opt => opt.includes('FAST_VALIDATION'))) {
      return 'FAST_VALIDATION'
    } else if (optimizations.some(opt => opt.includes('CONSTRAINT_ANALYSIS'))) {
      return 'CONSTRAINT_ANALYSIS'
    } else {
      return 'BACKTRACKING'
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE FOR GLOBAL USE
// ============================================================================

let globalTriggerService: ZoneMatchCompletionTriggerService | null = null

export function getZoneMatchTriggerService(config?: Partial<ZoneAnalysisConfig>): ZoneMatchCompletionTriggerService {
  if (!globalTriggerService) {
    globalTriggerService = new ZoneMatchCompletionTriggerService(config)
  }
  return globalTriggerService
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON USE CASES
// ============================================================================

/**
 * Quick helper to trigger zone analysis from match completion
 * Use this in your match update endpoint
 */
export async function triggerZoneAnalysisOnMatchCompletion(
  matchId: string,
  tournamentId: string,
  zoneId: string,
  winnerCoupleId: string,
  options: {
    isModification?: boolean
    triggerSource?: 'MATCH_UPDATE' | 'MANUAL' | 'BATCH'
  } = {}
): Promise<ZoneAnalysisTriggerResult> {
  const service = getZoneMatchTriggerService()
  
  const event: ZoneMatchCompletionEvent = {
    matchId,
    tournamentId,
    zoneId,
    winnerCoupleId,
    completedAt: new Date().toISOString(),
    metadata: {
      isModification: options.isModification || false,
      triggerSource: options.triggerSource || 'MATCH_UPDATE'
    }
  }

  return service.processZoneMatchCompletion(event)
}