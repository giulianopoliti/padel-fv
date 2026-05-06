/**
 * Tournament Format Hook
 * 
 * Provides tournament format detection and configuration access.
 * Handles format inference from tournament data or explicit format specification.
 */

import { useState, useEffect, useMemo } from 'react'
import { TournamentConfigService } from '@/lib/services/tournament-config.service'
import type { TournamentRules, TournamentFormatConfig } from '@/types/tournament-rules.types'

interface UseTournamentFormatOptions {
  tournamentId?: string
  defaultFormat?: string
  enableCaching?: boolean
}

interface TournamentFormatResult {
  formatId: string
  formatName: string
  rules: TournamentRules
  config: TournamentFormatConfig
  isLoading: boolean
  error: string | null
  
  // Utility methods
  supportsOverflow: boolean
  maxCapacity: number
  defaultCapacity: number
  
  // Actions
  refetch: () => Promise<void>
  setFormat: (formatId: string) => void
}

/**
 * Hook to get tournament format configuration
 */
export function useTournamentFormat({
  tournamentId,
  defaultFormat = 'AMERICAN_2',
  enableCaching = true
}: UseTournamentFormatOptions = {}): TournamentFormatResult {
  
  const [formatId, setFormatId] = useState<string>(defaultFormat)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Get configuration from format ID
  const config = useMemo(() => {
    try {
      return TournamentConfigService.getConfigForFormat(formatId)
    } catch (err) {
      console.error('Error getting tournament format config:', err)
      return TournamentConfigService.getConfigForFormat(defaultFormat)
    }
  }, [formatId, defaultFormat])
  
  const rules = config.rules
  
  // Fetch tournament format if tournament ID is provided
  const fetchTournamentFormat = async () => {
    if (!tournamentId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // In a real implementation, this would fetch from the database
      // For now, we'll use a detection mechanism
      const detectedFormat = await detectTournamentFormat(tournamentId)
      setFormatId(detectedFormat)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament format')
      console.error('Error fetching tournament format:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Load tournament format on mount
  useEffect(() => {
    fetchTournamentFormat()
  }, [tournamentId])
  
  // Derived properties
  const supportsOverflow = rules.zoneCapacity.allowOverflow
  const maxCapacity = rules.zoneCapacity.max
  const defaultCapacity = rules.zoneCapacity.default
  
  return {
    formatId,
    formatName: rules.formatName,
    rules,
    config,
    isLoading,
    error,
    
    // Utility properties
    supportsOverflow,
    maxCapacity,
    defaultCapacity,
    
    // Actions
    refetch: fetchTournamentFormat,
    setFormat: setFormatId
  }
}

/**
 * Simplified hook for format-only access
 */
export function useSimpleTournamentFormat(formatId: string = 'AMERICAN_2') {
  const { rules, config, supportsOverflow, maxCapacity, defaultCapacity } = useTournamentFormat({ 
    defaultFormat: formatId 
  })
  
  return {
    rules,
    config,
    supportsOverflow,
    maxCapacity,
    defaultCapacity
  }
}

/**
 * Hook for tournament format detection from tournament data
 */
export function useTournamentFormatDetection(tournamentId: string) {
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [isDetecting, setIsDetecting] = useState(false)
  
  const detectFormat = async () => {
    if (!tournamentId) return
    
    setIsDetecting(true)
    
    try {
      const result = await detectTournamentFormat(tournamentId)
      setDetectedFormat(result)
      setConfidence(0.95) // High confidence for explicit detection
    } catch (err) {
      console.error('Format detection failed:', err)
      setDetectedFormat('AMERICAN_2') // Fallback
      setConfidence(0.5) // Low confidence for fallback
    } finally {
      setIsDetecting(false)
    }
  }
  
  useEffect(() => {
    detectFormat()
  }, [tournamentId])
  
  return {
    detectedFormat,
    confidence,
    isDetecting,
    redetect: detectFormat
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect tournament format from tournament data
 * This is a placeholder implementation - in a real app, this would query the database
 */
async function detectTournamentFormat(tournamentId: string): Promise<string> {
  // TODO: Implement actual format detection
  // This could look at:
  // 1. Explicit format field in tournament table
  // 2. Zone configuration patterns
  // 3. Match patterns
  // 4. Historical tournament data
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Mock detection logic
    // In real implementation:
    // const tournament = await getTournamentById(tournamentId)
    // return tournament.format_type || inferFormatFromData(tournament)
    
    return 'AMERICAN_2' // Default for now
  } catch (error) {
    console.error('Tournament format detection failed:', error)
    return 'AMERICAN_2'
  }
}

/**
 * Infer format from tournament data patterns
 */
function inferFormatFromTournamentData(tournamentData: any): string {
  // This would analyze tournament structure to infer format
  // Examples:
  // - If zones have 2 matches per couple → AMERICAN_2
  // - If zones have 3 matches per couple → AMERICAN_3
  // - If zones are large (6+ couples) → LONG
  
  return 'AMERICAN_2'
}

/**
 * Validate format compatibility with tournament data
 */
export function validateFormatCompatibility(
  formatId: string, 
  tournamentData: { 
    totalCouples: number
    existingZones?: any[]
    playedMatches?: any[]
  }
): {
  isCompatible: boolean
  warnings: string[]
  blockers: string[]
} {
  const config = TournamentConfigService.getConfigForFormat(formatId)
  const warnings: string[] = []
  const blockers: string[] = []
  
  // Check if format can handle the number of couples
  const distribution = TournamentConfigService.calculateOptimalZoneDistribution(
    tournamentData.totalCouples,
    formatId
  )
  
  if (distribution.eliminatedCouples > 0) {
    warnings.push(`${distribution.eliminatedCouples} parejas serán eliminadas con este formato`)
  }
  
  // Check if there are existing matches that conflict with format
  if (tournamentData.playedMatches && tournamentData.playedMatches.length > 0) {
    warnings.push('El torneo tiene partidos jugados. Cambiar formato puede afectar los resultados.')
  }
  
  // Check zone compatibility
  if (tournamentData.existingZones) {
    const incompatibleZones = tournamentData.existingZones.filter(zone => 
      zone.couples?.length > config.rules.zoneCapacity.max
    )
    
    if (incompatibleZones.length > 0) {
      blockers.push(`${incompatibleZones.length} zona(s) exceden la capacidad máxima del formato`)
    }
  }
  
  return {
    isCompatible: blockers.length === 0,
    warnings,
    blockers
  }
}