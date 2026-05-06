/**
 * ZONE ANALYSIS METRICS SERVICE
 * 
 * Collects and analyzes performance metrics for zone analysis operations.
 * Provides observability for monitoring and optimization.
 * 
 * METRICS TRACKED:
 * - Analysis execution time by method
 * - Success/failure rates by zone and tournament
 * - Performance trends and bottlenecks
 * - Resource utilization patterns
 * - Error distribution by type
 */

import { createClient } from '@/utils/supabase/server'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ZoneAnalysisMetric {
  metricId: string
  zoneId: string
  tournamentId: string
  executionTimeMs: number
  analysisData: {
    success: boolean
    couplesAnalyzed: number
    definitiveFound: number
    optimizationsUsed: string[]
    analysisMethod: 'FAST_VALIDATION' | 'CONSTRAINT_ANALYSIS' | 'BACKTRACKING'
    errorType?: string
  }
  triggerSource: 'MATCH_UPDATE' | 'MANUAL' | 'BATCH'
  timestamp: string
  sessionId?: string
}

export interface PerformanceStats {
  avgExecutionTime: number
  p50ExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  successRate: number
  totalAnalyses: number
  methodDistribution: Record<string, number>
  optimizationEffectiveness: Record<string, number>
}

export interface ZonePerformanceSummary {
  zoneId: string
  tournamentId: string
  stats: PerformanceStats
  recentTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING'
  lastAnalysis: string
  recommendedOptimizations: string[]
}

// ============================================================================
// ZONE ANALYSIS METRICS SERVICE
// ============================================================================

export class ZoneAnalysisMetricsService {
  private metrics: ZoneAnalysisMetric[] = []
  private maxMetricsInMemory: number = 1000
  private performanceCache = new Map<string, PerformanceStats>()
  private cacheTTL: number = 300000 // 5 minutes

  constructor(maxMemoryMetrics: number = 1000) {
    this.maxMetricsInMemory = maxMemoryMetrics
    console.log(`📊 [METRICS] Initialized with memory limit: ${maxMemoryMetrics}`)
  }

  /**
   * Record a zone analysis metric
   */
  recordMetric(
    zoneId: string,
    tournamentId: string,
    executionTimeMs: number,
    analysisData: ZoneAnalysisMetric['analysisData'],
    triggerSource: ZoneAnalysisMetric['triggerSource'],
    sessionId?: string
  ): void {
    const metric: ZoneAnalysisMetric = {
      metricId: this.generateMetricId(zoneId, tournamentId),
      zoneId,
      tournamentId,
      executionTimeMs,
      analysisData,
      triggerSource,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || this.generateSessionId()
    }

    // Add to in-memory storage
    this.addMetricToMemory(metric)

    // Invalidate cache for this zone
    this.invalidateCache(zoneId)

    // Log performance summary
    this.logPerformanceSummary(metric)

    // Store to database asynchronously (don't block)
    this.storeMetricToDatabase(metric).catch(error => {
      console.error('📊 [METRICS] Failed to store metric to database:', error)
    })
  }

  /**
   * Get performance statistics for a zone
   */
  getZonePerformanceStats(zoneId: string): PerformanceStats | null {
    // Check cache first
    const cached = this.performanceCache.get(zoneId)
    if (cached) {
      return cached
    }

    // Calculate from in-memory metrics
    const zoneMetrics = this.metrics.filter(m => m.zoneId === zoneId)
    if (zoneMetrics.length === 0) {
      return null
    }

    const stats = this.calculatePerformanceStats(zoneMetrics)
    
    // Cache the result
    this.performanceCache.set(zoneId, stats)
    
    return stats
  }

  /**
   * Get performance summary for a tournament
   */
  getTournamentPerformanceSummary(tournamentId: string): ZonePerformanceSummary[] {
    const tournamentMetrics = this.metrics.filter(m => m.tournamentId === tournamentId)
    
    // Group by zone
    const metricsByZone = new Map<string, ZoneAnalysisMetric[]>()
    tournamentMetrics.forEach(metric => {
      if (!metricsByZone.has(metric.zoneId)) {
        metricsByZone.set(metric.zoneId, [])
      }
      metricsByZone.get(metric.zoneId)!.push(metric)
    })

    const summaries: ZonePerformanceSummary[] = []
    
    for (const [zoneId, zoneMetrics] of metricsByZone) {
      const stats = this.calculatePerformanceStats(zoneMetrics)
      const trend = this.calculateTrend(zoneMetrics)
      const lastAnalysis = zoneMetrics[zoneMetrics.length - 1]?.timestamp
      const recommendations = this.generateOptimizationRecommendations(stats, zoneMetrics)

      summaries.push({
        zoneId,
        tournamentId,
        stats,
        recentTrend: trend,
        lastAnalysis,
        recommendedOptimizations: recommendations
      })
    }

    return summaries.sort((a, b) => 
      new Date(b.lastAnalysis).getTime() - new Date(a.lastAnalysis).getTime()
    )
  }

  /**
   * Get global performance dashboard data
   */
  getGlobalPerformanceDashboard() {
    const recentMetrics = this.getRecentMetrics(3600000) // Last hour
    const allStats = this.calculatePerformanceStats(recentMetrics)
    
    const methodPerformance = this.getMethodPerformanceComparison(recentMetrics)
    const triggerSourceStats = this.getTriggerSourceStats(recentMetrics)
    const errorAnalysis = this.getErrorAnalysis(recentMetrics)
    
    return {
      overview: {
        totalAnalyses: recentMetrics.length,
        avgExecutionTime: allStats.avgExecutionTime,
        successRate: allStats.successRate,
        activeTournaments: new Set(recentMetrics.map(m => m.tournamentId)).size,
        activeZones: new Set(recentMetrics.map(m => m.zoneId)).size
      },
      performance: {
        overall: allStats,
        byMethod: methodPerformance,
        byTriggerSource: triggerSourceStats
      },
      reliability: {
        errorAnalysis,
        healthScore: this.calculateHealthScore(recentMetrics)
      },
      trends: {
        timeSeriesData: this.generateTimeSeriesData(recentMetrics),
        performanceTrend: this.calculateGlobalTrend(recentMetrics)
      }
    }
  }

  /**
   * Calculate performance statistics from metrics
   */
  private calculatePerformanceStats(metrics: ZoneAnalysisMetric[]): PerformanceStats {
    if (metrics.length === 0) {
      return {
        avgExecutionTime: 0,
        p50ExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        successRate: 0,
        totalAnalyses: 0,
        methodDistribution: {},
        optimizationEffectiveness: {}
      }
    }

    // Execution times
    const times = metrics.map(m => m.executionTimeMs).sort((a, b) => a - b)
    const avgExecutionTime = times.reduce((sum, time) => sum + time, 0) / times.length
    const p50ExecutionTime = this.percentile(times, 0.5)
    const p95ExecutionTime = this.percentile(times, 0.95)
    const p99ExecutionTime = this.percentile(times, 0.99)

    // Success rate
    const successfulAnalyses = metrics.filter(m => m.analysisData.success).length
    const successRate = successfulAnalyses / metrics.length

    // Method distribution
    const methodDistribution: Record<string, number> = {}
    metrics.forEach(m => {
      const method = m.analysisData.analysisMethod
      methodDistribution[method] = (methodDistribution[method] || 0) + 1
    })

    // Optimization effectiveness
    const optimizationEffectiveness: Record<string, number> = {}
    metrics.forEach(m => {
      m.analysisData.optimizationsUsed.forEach(opt => {
        if (!optimizationEffectiveness[opt]) {
          optimizationEffectiveness[opt] = { total: 0, avgTime: 0 }
        }
        optimizationEffectiveness[opt].total++
        optimizationEffectiveness[opt].avgTime += m.executionTimeMs
      })
    })

    // Calculate average times for optimizations
    Object.keys(optimizationEffectiveness).forEach(opt => {
      const data = optimizationEffectiveness[opt]
      data.avgTime = data.avgTime / data.total
    })

    return {
      avgExecutionTime,
      p50ExecutionTime,
      p95ExecutionTime,
      p99ExecutionTime,
      successRate,
      totalAnalyses: metrics.length,
      methodDistribution,
      optimizationEffectiveness
    }
  }

  /**
   * Calculate performance trend for metrics
   */
  private calculateTrend(metrics: ZoneAnalysisMetric[]): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    if (metrics.length < 5) return 'STABLE'

    // Get recent vs older metrics
    const sortedMetrics = metrics.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    
    const halfPoint = Math.floor(sortedMetrics.length / 2)
    const olderMetrics = sortedMetrics.slice(0, halfPoint)
    const recentMetrics = sortedMetrics.slice(halfPoint)

    const olderAvg = olderMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / olderMetrics.length
    const recentAvg = recentMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / recentMetrics.length

    const improvementRatio = olderAvg / recentAvg
    
    if (improvementRatio > 1.1) return 'IMPROVING'
    if (improvementRatio < 0.9) return 'DEGRADING'
    return 'STABLE'
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(
    stats: PerformanceStats, 
    metrics: ZoneAnalysisMetric[]
  ): string[] {
    const recommendations: string[] = []

    // High execution time recommendations
    if (stats.avgExecutionTime > 1000) {
      recommendations.push('Consider enabling caching for improved performance')
    }

    if (stats.p95ExecutionTime > 5000) {
      recommendations.push('Implement timeout controls for long-running analyses')
    }

    // Success rate recommendations
    if (stats.successRate < 0.95) {
      recommendations.push('Investigate error patterns and implement better error handling')
    }

    // Method distribution recommendations
    const backtrackingRatio = (stats.methodDistribution['BACKTRACKING'] || 0) / stats.totalAnalyses
    if (backtrackingRatio > 0.1) {
      recommendations.push('High backtracking usage detected - consider constraint analysis improvements')
    }

    // Recent error patterns
    const recentErrors = metrics
      .filter(m => !m.analysisData.success)
      .slice(-10) // Last 10 errors
    
    if (recentErrors.length > 2) {
      recommendations.push('Recent error spike detected - review system stability')
    }

    return recommendations
  }

  /**
   * Helper methods for calculations
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = percentile * (sortedArray.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1]
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
  }

  private getRecentMetrics(timeWindowMs: number): ZoneAnalysisMetric[] {
    const cutoff = Date.now() - timeWindowMs
    return this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoff
    )
  }

  private getMethodPerformanceComparison(metrics: ZoneAnalysisMetric[]) {
    const methodGroups = new Map<string, ZoneAnalysisMetric[]>()
    
    metrics.forEach(m => {
      const method = m.analysisData.analysisMethod
      if (!methodGroups.has(method)) {
        methodGroups.set(method, [])
      }
      methodGroups.get(method)!.push(m)
    })

    const comparison: Record<string, PerformanceStats> = {}
    methodGroups.forEach((methodMetrics, method) => {
      comparison[method] = this.calculatePerformanceStats(methodMetrics)
    })

    return comparison
  }

  private getTriggerSourceStats(metrics: ZoneAnalysisMetric[]) {
    const sourceGroups = new Map<string, ZoneAnalysisMetric[]>()
    
    metrics.forEach(m => {
      if (!sourceGroups.has(m.triggerSource)) {
        sourceGroups.set(m.triggerSource, [])
      }
      sourceGroups.get(m.triggerSource)!.push(m)
    })

    const stats: Record<string, PerformanceStats> = {}
    sourceGroups.forEach((sourceMetrics, source) => {
      stats[source] = this.calculatePerformanceStats(sourceMetrics)
    })

    return stats
  }

  private getErrorAnalysis(metrics: ZoneAnalysisMetric[]) {
    const errors = metrics.filter(m => !m.analysisData.success)
    const errorTypes: Record<string, number> = {}
    
    errors.forEach(m => {
      const errorType = m.analysisData.errorType || 'UNKNOWN'
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
    })

    return {
      totalErrors: errors.length,
      errorRate: errors.length / metrics.length,
      errorTypes,
      recentErrors: errors.slice(-10).map(m => ({
        timestamp: m.timestamp,
        zoneId: m.zoneId,
        errorType: m.analysisData.errorType,
        executionTime: m.executionTimeMs
      }))
    }
  }

  private calculateHealthScore(metrics: ZoneAnalysisMetric[]): number {
    if (metrics.length === 0) return 1.0

    const successRate = metrics.filter(m => m.analysisData.success).length / metrics.length
    const avgTime = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length
    
    // Health score based on success rate and performance
    const successScore = successRate
    const performanceScore = Math.max(0, 1 - (avgTime - 100) / 2000) // Degrade after 100ms, zero at 2100ms
    
    return (successScore * 0.7 + performanceScore * 0.3)
  }

  private calculateGlobalTrend(metrics: ZoneAnalysisMetric[]): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    if (metrics.length < 10) return 'STABLE'

    // Calculate trend over time windows
    const sortedMetrics = metrics.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Compare first third vs last third
    const thirdSize = Math.floor(sortedMetrics.length / 3)
    const oldMetrics = sortedMetrics.slice(0, thirdSize)
    const newMetrics = sortedMetrics.slice(-thirdSize)

    const oldAvgTime = oldMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / oldMetrics.length
    const newAvgTime = newMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / newMetrics.length

    const oldSuccessRate = oldMetrics.filter(m => m.analysisData.success).length / oldMetrics.length
    const newSuccessRate = newMetrics.filter(m => m.analysisData.success).length / newMetrics.length

    // Weighted score improvement
    const timeImprovement = (oldAvgTime - newAvgTime) / oldAvgTime
    const successImprovement = newSuccessRate - oldSuccessRate
    
    const overallImprovement = timeImprovement * 0.3 + successImprovement * 0.7

    if (overallImprovement > 0.05) return 'IMPROVING'
    if (overallImprovement < -0.05) return 'DEGRADING'
    return 'STABLE'
  }

  private generateTimeSeriesData(metrics: ZoneAnalysisMetric[]) {
    // Group metrics by time windows (e.g., 5-minute buckets)
    const timeWindows = new Map<string, ZoneAnalysisMetric[]>()
    const windowSizeMs = 5 * 60 * 1000 // 5 minutes
    
    metrics.forEach(m => {
      const timestamp = new Date(m.timestamp).getTime()
      const windowStart = Math.floor(timestamp / windowSizeMs) * windowSizeMs
      const windowKey = new Date(windowStart).toISOString()
      
      if (!timeWindows.has(windowKey)) {
        timeWindows.set(windowKey, [])
      }
      timeWindows.get(windowKey)!.push(m)
    })

    // Convert to time series data
    const timeSeries = Array.from(timeWindows.entries())
      .map(([timestamp, windowMetrics]) => ({
        timestamp,
        count: windowMetrics.length,
        avgExecutionTime: windowMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / windowMetrics.length,
        successRate: windowMetrics.filter(m => m.analysisData.success).length / windowMetrics.length
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return timeSeries
  }

  /**
   * Utility methods for metric management
   */
  private addMetricToMemory(metric: ZoneAnalysisMetric): void {
    this.metrics.push(metric)
    
    // Maintain size limit
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory)
    }
  }

  private invalidateCache(zoneId: string): void {
    this.performanceCache.delete(zoneId)
  }

  private generateMetricId(zoneId: string, tournamentId: string): string {
    return `${zoneId}_${tournamentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private logPerformanceSummary(metric: ZoneAnalysisMetric): void {
    const { analysisData, executionTimeMs, zoneId } = metric
    
    if (analysisData.success) {
      console.log(`📊 [METRICS] Zone ${zoneId}: ${analysisData.analysisMethod} in ${executionTimeMs}ms, ${analysisData.definitiveFound}/${analysisData.couplesAnalyzed} definitive`)
    } else {
      console.warn(`📊 [METRICS] Zone ${zoneId}: FAILED in ${executionTimeMs}ms - ${analysisData.errorType}`)
    }
  }

  private async storeMetricToDatabase(metric: ZoneAnalysisMetric): Promise<void> {
    try {
      const supabase = await createClient()
      
      await supabase
        .from('zone_analysis_metrics')
        .insert({
          metric_id: metric.metricId,
          zone_id: metric.zoneId,
          tournament_id: metric.tournamentId,
          execution_time_ms: metric.executionTimeMs,
          analysis_data: metric.analysisData,
          trigger_source: metric.triggerSource,
          session_id: metric.sessionId,
          created_at: metric.timestamp
        })
    } catch (error) {
      // Don't throw - this is auxiliary functionality
      console.error('📊 [METRICS] Database storage failed:', error)
    }
  }

  /**
   * Public utility methods
   */
  clearMetrics(): void {
    this.metrics = []
    this.performanceCache.clear()
    console.log('📊 [METRICS] All metrics cleared')
  }

  getMetricsSummary() {
    return {
      totalMetrics: this.metrics.length,
      cacheSize: this.performanceCache.size,
      memoryLimit: this.maxMetricsInMemory,
      oldestMetric: this.metrics[0]?.timestamp,
      newestMetric: this.metrics[this.metrics.length - 1]?.timestamp
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

let globalMetricsService: ZoneAnalysisMetricsService | null = null

export function getZoneAnalysisMetricsService(): ZoneAnalysisMetricsService {
  if (!globalMetricsService) {
    globalMetricsService = new ZoneAnalysisMetricsService()
  }
  return globalMetricsService
}

/**
 * Convenience function to record metrics from anywhere in the system
 */
export function recordZoneAnalysisMetric(
  zoneId: string,
  tournamentId: string,
  executionTimeMs: number,
  analysisData: ZoneAnalysisMetric['analysisData'],
  triggerSource: ZoneAnalysisMetric['triggerSource'],
  sessionId?: string
): void {
  const service = getZoneAnalysisMetricsService()
  service.recordMetric(zoneId, tournamentId, executionTimeMs, analysisData, triggerSource, sessionId)
}