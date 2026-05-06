/**
 * DEFINITIVE POSITION TRIGGER SERVICE
 * 
 * Maneja los triggers automáticos para recalcular posiciones definitivas
 * cuando se actualiza el estado de partidos o zonas.
 * 
 * EVENTOS QUE DISPARAN RECÁLCULO:
 * 1. Match result updated/created
 * 2. Match status changed to COMPLETED
 * 3. Zone status changed
 * 4. User requests bracket generation
 * 5. Scheduled maintenance (batch processing)
 * 
 * ESTRATEGIAS DE TRIGGER:
 * - Real-time: Para eventos críticos (match completion)
 * - Debounced: Para múltiples updates rápidos
 * - Batch: Para mantenimiento nocturno
 * - On-demand: Para acciones de usuario
 */

import { createClient } from '@/utils/supabase/client'
import { OptimizedDefinitiveAnalyzer } from './optimized-definitive-analyzer'
import type { ZoneAnalysisResult } from './optimized-definitive-analyzer'

export interface TriggerEvent {
  type: TriggerEventType
  tournament_id: string
  zone_id?: string
  match_id?: string
  couple_id?: string
  timestamp: string
  metadata?: Record<string, any>
}

export type TriggerEventType = 
  | 'MATCH_RESULT_UPDATED'
  | 'MATCH_COMPLETED'
  | 'ZONE_STATUS_CHANGED'
  | 'BRACKET_GENERATION_REQUESTED'
  | 'MANUAL_REFRESH'
  | 'SCHEDULED_MAINTENANCE'

export interface TriggerConfig {
  debounce_ms: number           // Tiempo de debounce para eventos múltiples
  max_concurrent_analyses: number  // Máximo análisis concurrentes
  enable_real_time: boolean     // Si activar triggers en tiempo real
  enable_batch_processing: boolean // Si activar procesamiento batch
  batch_interval_minutes: number   // Intervalo para batch processing
  priority_tournaments: string[]   // Torneos de alta prioridad
}

export interface TriggerResult {
  success: boolean
  event: TriggerEvent
  analysis_results?: ZoneAnalysisResult[]
  processing_time_ms: number
  updates_applied: number
  error?: string
  skipped_reason?: string
}

const DEFAULT_CONFIG: TriggerConfig = {
  debounce_ms: 2000,
  max_concurrent_analyses: 3,
  enable_real_time: true,
  enable_batch_processing: true,
  batch_interval_minutes: 30,
  priority_tournaments: []
}

export class DefinitivePositionTriggerService {
  private analyzer: OptimizedDefinitiveAnalyzer
  private config: TriggerConfig
  private pendingEvents = new Map<string, TriggerEvent[]>()
  private processingTournaments = new Set<string>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private batchTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<TriggerConfig> = {}) {
    this.analyzer = new OptimizedDefinitiveAnalyzer()
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enable_batch_processing) {
      this.startBatchProcessing()
    }
    
    console.log(`🔧 [TRIGGER-SERVICE] Initialized with config:`, this.config)
  }
  
  /**
   * MÉTODO PRINCIPAL: Procesar evento de trigger
   */
  async processTriggerEvent(event: TriggerEvent): Promise<TriggerResult> {
    const startTime = performance.now()
    
    console.log(`📡 [TRIGGER] Received event: ${event.type} for tournament ${event.tournament_id}`)
    
    try {
      // 1. Validar evento
      if (!this.isValidEvent(event)) {
        return {
          success: false,
          event,
          processing_time_ms: performance.now() - startTime,
          updates_applied: 0,
          skipped_reason: 'Invalid event format'
        }
      }
      
      // 2. Verificar si debe procesarse inmediatamente
      if (this.shouldProcessImmediately(event)) {
        return await this.processEventImmediately(event)
      }
      
      // 3. Agregar a cola con debounce
      if (this.config.enable_real_time) {
        this.addEventToDebounceQueue(event)
        return {
          success: true,
          event,
          processing_time_ms: performance.now() - startTime,
          updates_applied: 0,
          skipped_reason: `Queued for debounced processing (${this.config.debounce_ms}ms)`
        }
      }
      
      // 4. Procesar en batch
      return {
        success: true,
        event,
        processing_time_ms: performance.now() - startTime,
        updates_applied: 0,
        skipped_reason: 'Queued for batch processing'
      }
      
    } catch (error: any) {
      console.error(`❌ [TRIGGER] Error processing event:`, error)
      return {
        success: false,
        event,
        processing_time_ms: performance.now() - startTime,
        updates_applied: 0,
        error: error.message
      }
    }
  }
  
  /**
   * Procesar evento inmediatamente (alta prioridad)
   */
  private async processEventImmediately(event: TriggerEvent): Promise<TriggerResult> {
    const startTime = performance.now()
    
    // Verificar concurrencia
    if (this.processingTournaments.size >= this.config.max_concurrent_analyses) {
      return {
        success: false,
        event,
        processing_time_ms: performance.now() - startTime,
        updates_applied: 0,
        skipped_reason: `Max concurrent analyses reached (${this.config.max_concurrent_analyses})`
      }
    }
    
    this.processingTournaments.add(event.tournament_id)
    
    try {
      console.log(`⚡ [TRIGGER] Processing immediately: ${event.type}`)
      
      let zonesToAnalyze: string[] = []
      
      // Determinar zonas a analizar basado en el evento
      if (event.zone_id) {
        zonesToAnalyze = [event.zone_id]
      } else if (event.match_id) {
        // Obtener zona del partido
        const zoneId = await this.getZoneFromMatch(event.match_id)
        if (zoneId) {
          zonesToAnalyze = [zoneId]
        }
      } else {
        // Analizar todas las zonas del torneo
        zonesToAnalyze = await this.getAllZonesForTournament(event.tournament_id)
      }
      
      if (zonesToAnalyze.length === 0) {
        return {
          success: false,
          event,
          processing_time_ms: performance.now() - startTime,
          updates_applied: 0,
          skipped_reason: 'No zones found to analyze'
        }
      }
      
      // Ejecutar análisis
      const analysisResults: ZoneAnalysisResult[] = []
      let totalUpdates = 0
      
      for (const zoneId of zonesToAnalyze) {
        const result = await this.analyzer.analyzeZoneOptimized(zoneId)
        analysisResults.push(result)
        
        // Actualizar base de datos
        const updates = await this.updateDatabaseForZone(zoneId, result)
        totalUpdates += updates
      }
      
      console.log(`✅ [TRIGGER] Immediate processing complete: ${totalUpdates} updates`)
      
      return {
        success: true,
        event,
        analysis_results: analysisResults,
        processing_time_ms: performance.now() - startTime,
        updates_applied: totalUpdates
      }
      
    } finally {
      this.processingTournaments.delete(event.tournament_id)
    }
  }
  
  /**
   * Agregar evento a cola de debounce
   */
  private addEventToDebounceQueue(event: TriggerEvent): void {
    const key = `${event.tournament_id}:${event.zone_id || 'ALL'}`
    
    // Cancelar timer existente
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key)!)
    }
    
    // Agregar evento a cola
    if (!this.pendingEvents.has(key)) {
      this.pendingEvents.set(key, [])
    }
    this.pendingEvents.get(key)!.push(event)
    
    // Configurar nuevo timer
    const timer = setTimeout(() => {
      this.processDebounceQueue(key)
    }, this.config.debounce_ms)
    
    this.debounceTimers.set(key, timer)
    
    console.log(`⏱️ [TRIGGER] Added to debounce queue: ${key} (${this.pendingEvents.get(key)!.length} events pending)`)
  }
  
  /**
   * Procesar cola de debounce
   */
  private async processDebounceQueue(key: string): Promise<void> {
    const events = this.pendingEvents.get(key)
    if (!events || events.length === 0) {
      return
    }
    
    console.log(`🔄 [TRIGGER] Processing debounce queue: ${key} (${events.length} events)`)
    
    // Tomar el último evento (más reciente)
    const latestEvent = events[events.length - 1]
    
    try {
      await this.processEventImmediately(latestEvent)
    } catch (error) {
      console.error(`❌ [TRIGGER] Error processing debounce queue:`, error)
    } finally {
      // Limpiar cola
      this.pendingEvents.delete(key)
      this.debounceTimers.delete(key)
    }
  }
  
  /**
   * Iniciar procesamiento batch
   */
  private startBatchProcessing(): void {
    console.log(`📅 [TRIGGER] Starting batch processing (interval: ${this.config.batch_interval_minutes}min)`)
    
    this.batchTimer = setInterval(() => {
      this.runBatchProcessing()
    }, this.config.batch_interval_minutes * 60 * 1000)
  }
  
  /**
   * Ejecutar procesamiento batch
   */
  private async runBatchProcessing(): Promise<void> {
    console.log(`🔄 [TRIGGER] Running batch processing...`)
    
    try {
      const supabase = createClient()
      
      // Obtener torneos activos que necesitan actualización
      const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 7 días
      
      if (error) {
        console.error(`❌ [TRIGGER] Error fetching tournaments for batch:`, error)
        return
      }
      
      if (!tournaments || tournaments.length === 0) {
        console.log(`ℹ️ [TRIGGER] No active tournaments found for batch processing`)
        return
      }
      
      console.log(`📊 [TRIGGER] Batch processing ${tournaments.length} tournaments`)
      
      // Procesar cada torneo
      for (const tournament of tournaments) {
        if (this.processingTournaments.has(tournament.id)) {
          console.log(`⏭️ [TRIGGER] Skipping tournament ${tournament.id} (already processing)`)
          continue
        }
        
        const batchEvent: TriggerEvent = {
          type: 'SCHEDULED_MAINTENANCE',
          tournament_id: tournament.id,
          timestamp: new Date().toISOString(),
          metadata: { batch_processing: true }
        }
        
        await this.processEventImmediately(batchEvent)
        
        // Pequeña pausa entre torneos
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      console.log(`✅ [TRIGGER] Batch processing complete`)
      
    } catch (error) {
      console.error(`❌ [TRIGGER] Error in batch processing:`, error)
    }
  }
  
  /**
   * Determinar si un evento debe procesarse inmediatamente
   */
  private shouldProcessImmediately(event: TriggerEvent): boolean {
    // Eventos de alta prioridad
    const highPriorityEvents: TriggerEventType[] = [
      'BRACKET_GENERATION_REQUESTED',
      'MANUAL_REFRESH'
    ]
    
    if (highPriorityEvents.includes(event.type)) {
      return true
    }
    
    // Torneos de alta prioridad
    if (this.config.priority_tournaments.includes(event.tournament_id)) {
      return true
    }
    
    // Match completado en zona con pocos partidos pendientes
    if (event.type === 'MATCH_COMPLETED' && event.zone_id) {
      // En una implementación real, verificaríamos cuántos partidos quedan
      return true
    }
    
    return false
  }
  
  /**
   * Validar formato del evento
   */
  private isValidEvent(event: TriggerEvent): boolean {
    return !!(
      event.type &&
      event.tournament_id &&
      event.timestamp
    )
  }
  
  /**
   * Helper: Obtener zona de un partido
   */
  private async getZoneFromMatch(matchId: string): Promise<string | null> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('matches')
        .select('zone_id')
        .eq('id', matchId)
        .single()
      
      if (error) {
        console.error(`❌ [TRIGGER] Error fetching zone for match ${matchId}:`, error)
        return null
      }
      
      return data?.zone_id || null
    } catch (error) {
      console.error(`❌ [TRIGGER] Error in getZoneFromMatch:`, error)
      return null
    }
  }
  
  /**
   * Helper: Obtener todas las zonas de un torneo
   */
  private async getAllZonesForTournament(tournamentId: string): Promise<string[]> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('zones')
        .select('id')
        .eq('tournament_id', tournamentId)
      
      if (error) {
        console.error(`❌ [TRIGGER] Error fetching zones for tournament ${tournamentId}:`, error)
        return []
      }
      
      return data?.map(zone => zone.id) || []
    } catch (error) {
      console.error(`❌ [TRIGGER] Error in getAllZonesForTournament:`, error)
      return []
    }
  }
  
  /**
   * Helper: Actualizar base de datos para una zona
   */
  private async updateDatabaseForZone(zoneId: string, result: ZoneAnalysisResult): Promise<number> {
    try {
      const supabase = createClient()
      let updates = 0
      
      for (const analysis of result.positionAnalyses) {
        const { error } = await supabase
          .from('zone_positions')
          .update({ 
            is_definitive: analysis.isDefinitive,
            updated_at: new Date().toISOString()
          })
          .eq('zone_id', zoneId)
          .eq('couple_id', analysis.coupleId)
        
        if (error) {
          console.error(`❌ [TRIGGER] Error updating couple ${analysis.coupleId}:`, error)
        } else {
          updates++
        }
      }
      
      return updates
    } catch (error) {
      console.error(`❌ [TRIGGER] Error in updateDatabaseForZone:`, error)
      return 0
    }
  }
  
  /**
   * MÉTODOS PÚBLICOS PARA INTEGRACIÓN
   */
  
  /**
   * Trigger manual desde la UI
   */
  async triggerManualRefresh(tournamentId: string, zoneId?: string): Promise<TriggerResult> {
    const event: TriggerEvent = {
      type: 'MANUAL_REFRESH',
      tournament_id: tournamentId,
      zone_id: zoneId,
      timestamp: new Date().toISOString(),
      metadata: { manual_trigger: true }
    }
    
    return this.processTriggerEvent(event)
  }
  
  /**
   * Trigger para generación de brackets
   */
  async triggerBracketGeneration(tournamentId: string): Promise<TriggerResult> {
    const event: TriggerEvent = {
      type: 'BRACKET_GENERATION_REQUESTED',
      tournament_id: tournamentId,
      timestamp: new Date().toISOString(),
      metadata: { bracket_generation: true }
    }
    
    return this.processTriggerEvent(event)
  }
  
  /**
   * Trigger cuando se completa un partido
   */
  async triggerMatchCompleted(matchId: string, tournamentId: string, zoneId: string): Promise<TriggerResult> {
    const event: TriggerEvent = {
      type: 'MATCH_COMPLETED',
      tournament_id: tournamentId,
      zone_id: zoneId,
      match_id: matchId,
      timestamp: new Date().toISOString(),
      metadata: { match_completed: true }
    }
    
    return this.processTriggerEvent(event)
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    // Limpiar timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
    }
    
    // Limpiar colas
    this.pendingEvents.clear()
    this.debounceTimers.clear()
    this.processingTournaments.clear()
    
    console.log(`🧹 [TRIGGER-SERVICE] Cleanup complete`)
  }
}