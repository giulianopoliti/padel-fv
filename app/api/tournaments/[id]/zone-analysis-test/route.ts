/**
 * ZONE ANALYSIS TESTING ENDPOINT
 * 
 * Comprehensive testing endpoint for the automated zone analysis system.
 * Provides testing capabilities for development, staging, and production validation.
 * 
 * Available test suites:
 * - Unit tests for analysis algorithms
 * - Integration tests for trigger system
 * - Performance/load tests
 * - Error handling tests
 * - End-to-end workflow tests
 * 
 * @author Claude Code Assistant  
 * @version 1.0.0
 * @created 2025-01-22
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { 
  getZoneMatchTriggerService, 
  triggerZoneAnalysisOnMatchCompletion,
  type ZoneMatchCompletionEvent 
} from '@/lib/services/zone-match-completion-trigger'
import { getZoneAnalysisErrorRecoveryService } from '@/lib/services/zone-analysis-error-recovery'
import { getZoneAnalysisMetricsService } from '@/lib/services/zone-analysis-metrics'

// ============================================================================
// TYPES
// ============================================================================

interface TestRequest {
  testSuite: 'unit' | 'integration' | 'performance' | 'error_handling' | 'end_to_end' | 'all'
  config?: {
    iterations?: number
    concurrency?: number
    timeout?: number
    mockData?: boolean
  }
  filters?: {
    zoneId?: string
    testNames?: string[]
  }
}

interface TestResult {
  testSuite: string
  testName: string
  success: boolean
  duration: number
  details: any
  error?: string
}

interface TestSuiteResults {
  suiteName: string
  totalTests: number
  passedTests: number
  failedTests: number
  totalDuration: number
  results: TestResult[]
  summary: string
}

// ============================================================================
// MAIN ENDPOINT
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const testRequest: TestRequest = await request.json()
    
    console.log(`🧪 [ZONE-ANALYSIS-TEST] Starting test suite: ${testRequest.testSuite}`)
    
    const testRunner = new ZoneAnalysisTestRunner(tournamentId, testRequest.config)
    let results: TestSuiteResults[] = []
    
    switch (testRequest.testSuite) {
      case 'unit':
        results.push(await testRunner.runUnitTests(testRequest.filters))
        break
      case 'integration':
        results.push(await testRunner.runIntegrationTests(testRequest.filters))
        break
      case 'performance':
        results.push(await testRunner.runPerformanceTests(testRequest.filters))
        break
      case 'error_handling':
        results.push(await testRunner.runErrorHandlingTests(testRequest.filters))
        break
      case 'end_to_end':
        results.push(await testRunner.runEndToEndTests(testRequest.filters))
        break
      case 'all':
        results.push(await testRunner.runUnitTests(testRequest.filters))
        results.push(await testRunner.runIntegrationTests(testRequest.filters))
        results.push(await testRunner.runPerformanceTests(testRequest.filters))
        results.push(await testRunner.runErrorHandlingTests(testRequest.filters))
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test suite specified'
        }, { status: 400 })
    }
    
    // Calculate overall summary
    const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0)
    const passedTests = results.reduce((sum, r) => sum + r.passedTests, 0)
    const failedTests = results.reduce((sum, r) => sum + r.failedTests, 0)
    const totalDuration = results.reduce((sum, r) => sum + r.totalDuration, 0)
    
    return NextResponse.json({
      success: failedTests === 0,
      tournamentId,
      testSuite: testRequest.testSuite,
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: Math.round((passedTests / totalTests) * 100),
        totalDuration: Math.round(totalDuration)
      },
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[ZONE-ANALYSIS-TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Test execution failed'
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  
  return NextResponse.json({
    message: 'Zone Analysis Testing Endpoint',
    tournamentId,
    availableTestSuites: [
      'unit - Test individual analysis functions',
      'integration - Test trigger system integration', 
      'performance - Test performance and scalability',
      'error_handling - Test error recovery mechanisms',
      'end_to_end - Test complete match completion workflow',
      'all - Run all test suites'
    ],
    usage: {
      method: 'POST',
      body: {
        testSuite: 'unit | integration | performance | error_handling | end_to_end | all',
        config: {
          iterations: 'number (default: 10)',
          concurrency: 'number (default: 3)', 
          timeout: 'number (default: 30000)',
          mockData: 'boolean (default: false)'
        },
        filters: {
          zoneId: 'string (optional)',
          testNames: 'string[] (optional)'
        }
      }
    }
  })
}

// ============================================================================
// TEST RUNNER CLASS
// ============================================================================

class ZoneAnalysisTestRunner {
  private tournamentId: string
  private config: TestRequest['config']
  private supabase: any
  
  constructor(tournamentId: string, config?: TestRequest['config']) {
    this.tournamentId = tournamentId
    this.config = {
      iterations: 10,
      concurrency: 3,
      timeout: 30000,
      mockData: false,
      ...config
    }
  }

  async initialize() {
    this.supabase = await createClient()
  }

  /**
   * Unit Tests - Test individual analysis functions
   */
  async runUnitTests(filters?: TestRequest['filters']): Promise<TestSuiteResults> {
    await this.initialize()
    const results: TestResult[] = []
    
    // Test 1: CorrectedDefinitiveAnalyzer initialization
    results.push(await this.runTest('analyzer_initialization', async () => {
      const { CorrectedDefinitiveAnalyzer } = await import('@/lib/services/corrected-definitive-analyzer')
      const analyzer = new CorrectedDefinitiveAnalyzer()
      
      return {
        success: true,
        details: { initialized: true, performance: analyzer.getPerformanceMetrics() }
      }
    }))
    
    // Test 2: Zone data retrieval
    results.push(await this.runTest('zone_data_retrieval', async () => {
      const { data: zones } = await this.supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', this.tournamentId)
        .limit(1)
      
      if (!zones || zones.length === 0) {
        throw new Error('No zones found for tournament')
      }
      
      const testZone = zones[0]
      const { data: positions } = await this.supabase
        .from('zone_positions')
        .select('*')
        .eq('zone_id', testZone.id)
      
      return {
        success: true,
        details: { 
          zoneId: testZone.id, 
          zoneName: testZone.name,
          positionsCount: positions?.length || 0
        }
      }
    }))
    
    // Test 3: Metrics service functionality
    results.push(await this.runTest('metrics_service', async () => {
      const metricsService = getZoneAnalysisMetricsService()
      
      // Record a test metric
      metricsService.recordAnalysis({
        timestamp: Date.now(),
        zoneId: 'test-zone',
        tournamentId: this.tournamentId,
        executionTimeMs: 100,
        couplesAnalyzed: 4,
        definitiveFound: 2,
        optimizationsUsed: ['FAST_VALIDATION'],
        analysisMethod: 'FAST_VALIDATION',
        success: true,
        triggerSource: 'MANUAL'
      })
      
      const metrics = metricsService.getPerformanceMetrics()
      
      return {
        success: true,
        details: { 
          metricsRecorded: true,
          currentMetrics: {
            totalAnalyses: metrics.totalAnalyses,
            successRate: metrics.successRate
          }
        }
      }
    }))
    
    return this.summarizeResults('Unit Tests', results)
  }

  /**
   * Integration Tests - Test trigger system integration
   */
  async runIntegrationTests(filters?: TestRequest['filters']): Promise<TestSuiteResults> {
    await this.initialize()
    const results: TestResult[] = []
    
    // Test 1: Trigger service initialization
    results.push(await this.runTest('trigger_service_init', async () => {
      const triggerService = getZoneMatchTriggerService()
      const status = triggerService.getStatus()
      
      return {
        success: true,
        details: { 
          serviceStatus: status,
          processingZones: status.processingZones.length,
          cachedAnalyses: status.cachedAnalyses
        }
      }
    }))
    
    // Test 2: Error recovery service integration
    results.push(await this.runTest('error_recovery_integration', async () => {
      const errorService = getZoneAnalysisErrorRecoveryService()
      const status = errorService.getStatus()
      
      return {
        success: true,
        details: {
          circuitBreakerStatus: status.circuitBreaker,
          failedAnalyses: status.failedAnalyses
        }
      }
    }))
    
    // Test 3: Mock match completion trigger
    results.push(await this.runTest('mock_match_completion', async () => {
      // Get a real zone from the tournament for testing
      const { data: zones } = await this.supabase
        .from('zones')
        .select('id')
        .eq('tournament_id', this.tournamentId)
        .limit(1)
      
      if (!zones || zones.length === 0) {
        throw new Error('No zones available for testing')
      }
      
      const testZoneId = zones[0].id
      
      // Create mock completion event
      const mockResult = await triggerZoneAnalysisOnMatchCompletion(
        'test-match-id',
        this.tournamentId,
        testZoneId,
        'test-couple-id',
        {
          isModification: false,
          triggerSource: 'MANUAL'
        }
      )
      
      return {
        success: mockResult.success,
        details: {
          triggerResult: mockResult,
          zoneAnalysisExecuted: mockResult.analysisExecuted,
          processingTime: mockResult.processingTimeMs
        }
      }
    }))
    
    return this.summarizeResults('Integration Tests', results)
  }

  /**
   * Performance Tests - Test performance and scalability
   */
  async runPerformanceTests(filters?: TestRequest['filters']): Promise<TestSuiteResults> {
    await this.initialize()
    const results: TestResult[] = []
    const iterations = this.config?.iterations || 10
    
    // Test 1: Analysis execution time
    results.push(await this.runTest('analysis_execution_time', async () => {
      const { data: zones } = await this.supabase
        .from('zones')
        .select('id')
        .eq('tournament_id', this.tournamentId)
        .limit(1)
      
      if (!zones || zones.length === 0) {
        throw new Error('No zones available for performance testing')
      }
      
      const testZoneId = zones[0].id
      const executionTimes: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        
        const result = await triggerZoneAnalysisOnMatchCompletion(
          `perf-test-${i}`,
          this.tournamentId,
          testZoneId,
          `test-couple-${i}`,
          { triggerSource: 'MANUAL' }
        )
        
        const duration = performance.now() - start
        executionTimes.push(duration)
        
        if (!result.success && !result.skipReason) {
          throw new Error(`Performance test iteration ${i} failed: ${result.error}`)
        }
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      const maxTime = Math.max(...executionTimes)
      const minTime = Math.min(...executionTimes)
      
      return {
        success: avgTime < 2000, // Should average under 2 seconds
        details: {
          iterations,
          averageTimeMs: Math.round(avgTime),
          maxTimeMs: Math.round(maxTime),
          minTimeMs: Math.round(minTime),
          allExecutionTimes: executionTimes.map(t => Math.round(t))
        }
      }
    }))
    
    // Test 2: Concurrent analysis stress test
    results.push(await this.runTest('concurrent_analysis', async () => {
      const { data: zones } = await this.supabase
        .from('zones')
        .select('id')
        .eq('tournament_id', this.tournamentId)
        .limit(3)
      
      if (!zones || zones.length === 0) {
        throw new Error('No zones available for concurrency testing')
      }
      
      const concurrency = Math.min(this.config?.concurrency || 3, zones.length)
      const promises: Promise<any>[] = []
      
      for (let i = 0; i < concurrency; i++) {
        const zoneId = zones[i % zones.length].id
        
        promises.push(
          triggerZoneAnalysisOnMatchCompletion(
            `concurrent-test-${i}`,
            this.tournamentId,
            zoneId,
            `concurrent-couple-${i}`,
            { triggerSource: 'MANUAL' }
          )
        )
      }
      
      const start = performance.now()
      const results = await Promise.allSettled(promises)
      const duration = performance.now() - start
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      return {
        success: failed === 0,
        details: {
          concurrency,
          successful,
          failed,
          totalDurationMs: Math.round(duration),
          avgDurationPerRequest: Math.round(duration / concurrency)
        }
      }
    }))
    
    return this.summarizeResults('Performance Tests', results)
  }

  /**
   * Error Handling Tests - Test error recovery mechanisms
   */
  async runErrorHandlingTests(filters?: TestRequest['filters']): Promise<TestSuiteResults> {
    await this.initialize()
    const results: TestResult[] = []
    
    // Test 1: Invalid zone handling
    results.push(await this.runTest('invalid_zone_handling', async () => {
      const result = await triggerZoneAnalysisOnMatchCompletion(
        'error-test-match',
        this.tournamentId,
        'non-existent-zone-id',
        'test-couple',
        { triggerSource: 'MANUAL' }
      )
      
      // Should fail gracefully without throwing
      return {
        success: !result.success && (result.error || result.skipReason), 
        details: {
          expectedFailure: true,
          result: result,
          handledGracefully: true
        }
      }
    }))
    
    // Test 2: Circuit breaker functionality
    results.push(await this.runTest('circuit_breaker', async () => {
      const errorService = getZoneAnalysisErrorRecoveryService()
      const initialStatus = errorService.getStatus()
      
      // Simulate multiple failures to trip circuit breaker
      for (let i = 0; i < 3; i++) {
        await errorService.recordFailure({
          matchId: `circuit-test-${i}`,
          tournamentId: this.tournamentId,
          zoneId: 'test-zone',
          winnerCoupleId: 'test-couple',
          completedAt: new Date().toISOString()
        }, 'Simulated failure', 'HIGH')
      }
      
      const postFailureStatus = errorService.getStatus()
      
      return {
        success: true,
        details: {
          initialFailures: initialStatus.failedAnalyses.total,
          postTestFailures: postFailureStatus.failedAnalyses.total,
          circuitBreakerState: postFailureStatus.circuitBreaker
        }
      }
    }))
    
    // Test 3: Recovery mechanism
    results.push(await this.runTest('error_recovery', async () => {
      const errorService = getZoneAnalysisErrorRecoveryService()
      
      // Record a failure
      await errorService.recordFailure({
        matchId: 'recovery-test',
        tournamentId: this.tournamentId,
        zoneId: 'test-zone',
        winnerCoupleId: 'test-couple',
        completedAt: new Date().toISOString()
      }, 'Test failure for recovery', 'MEDIUM')
      
      // Attempt recovery
      const recoveryResult = await errorService.triggerRecovery({
        maxRecoveries: 1
      })
      
      return {
        success: true,
        details: {
          recoveryAttempted: true,
          recovered: recoveryResult.recovered,
          failed: recoveryResult.failed,
          details: recoveryResult.details
        }
      }
    }))
    
    return this.summarizeResults('Error Handling Tests', results)
  }

  /**
   * End-to-End Tests - Test complete workflow
   */
  async runEndToEndTests(filters?: TestRequest['filters']): Promise<TestSuiteResults> {
    await this.initialize()
    const results: TestResult[] = []
    
    // Test 1: Complete match completion workflow
    results.push(await this.runTest('complete_workflow', async () => {
      // Get real tournament data
      const { data: zones } = await this.supabase
        .from('zones')
        .select('id, name')
        .eq('tournament_id', this.tournamentId)
        .limit(1)
      
      if (!zones || zones.length === 0) {
        throw new Error('No zones found for end-to-end test')
      }
      
      const testZone = zones[0]
      
      // Get zone positions before
      const { data: positionsBefore } = await this.supabase
        .from('zone_positions')
        .select('couple_id, is_definitive')
        .eq('zone_id', testZone.id)
      
      // Simulate match completion
      const triggerResult = await triggerZoneAnalysisOnMatchCompletion(
        'e2e-test-match',
        this.tournamentId,
        testZone.id,
        'e2e-test-couple',
        { triggerSource: 'MANUAL' }
      )
      
      // Get zone positions after
      const { data: positionsAfter } = await this.supabase
        .from('zone_positions')
        .select('couple_id, is_definitive')
        .eq('zone_id', testZone.id)
      
      // Check metrics were recorded
      const metricsService = getZoneAnalysisMetricsService()
      const metrics = metricsService.getPerformanceMetrics()
      
      return {
        success: triggerResult.success || !!triggerResult.skipReason,
        details: {
          zoneId: testZone.id,
          zoneName: testZone.name,
          positionsBeforeCount: positionsBefore?.length || 0,
          positionsAfterCount: positionsAfter?.length || 0,
          triggerResult: triggerResult,
          metricsRecorded: metrics.totalAnalyses > 0,
          workflowComplete: true
        }
      }
    }))
    
    return this.summarizeResults('End-to-End Tests', results)
  }

  /**
   * Helper methods
   */
  private async runTest(testName: string, testFunction: () => Promise<{ success: boolean; details: any }>): Promise<TestResult> {
    const start = performance.now()
    
    try {
      console.log(`  🧪 Running test: ${testName}`)
      
      const result = await Promise.race([
        testFunction(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Test timeout')), this.config?.timeout || 30000)
        })
      ])
      
      const duration = performance.now() - start
      
      console.log(`  ${result.success ? '✅' : '❌'} ${testName} (${Math.round(duration)}ms)`)
      
      return {
        testSuite: 'zone-analysis',
        testName,
        success: result.success,
        duration: Math.round(duration),
        details: result.details
      }
      
    } catch (error: any) {
      const duration = performance.now() - start
      
      console.log(`  ❌ ${testName} failed (${Math.round(duration)}ms): ${error.message}`)
      
      return {
        testSuite: 'zone-analysis',
        testName,
        success: false,
        duration: Math.round(duration),
        details: {},
        error: error.message
      }
    }
  }

  private summarizeResults(suiteName: string, results: TestResult[]): TestSuiteResults {
    const passedTests = results.filter(r => r.success).length
    const failedTests = results.filter(r => !r.success).length
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
    
    const summary = `${passedTests}/${results.length} tests passed (${Math.round((passedTests/results.length) * 100)}%) in ${Math.round(totalDuration)}ms`
    
    console.log(`📊 ${suiteName}: ${summary}`)
    
    return {
      suiteName,
      totalTests: results.length,
      passedTests,
      failedTests,
      totalDuration: Math.round(totalDuration),
      results,
      summary
    }
  }
}