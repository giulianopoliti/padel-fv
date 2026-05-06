/**
 * Enhanced Zone Positions Hook
 * 
 * Extends the existing zone data with position calculations.
 * Integrates seamlessly with the existing drag&drop system.
 */

import useSWR from 'swr'
import { useCallback, useMemo } from 'react'
import type { 
  CleanZone, 
  AvailableCouple 
} from '../types/zone-types'

// Types for enhanced zone data with positions
export interface EnhancedCouple {
  id: string
  player1_name: string
  player2_name: string
  stats: {
    played: number
    won: number
    lost: number
    scored: number
    conceded: number
    points: number
  }
  // Enhanced position data
  position?: number
  positionData?: {
    gamesDifference: number
    setsDifference: number
    totalPlayerScore: number
    positionTieInfo: string
    calculatedAt: string
  }
}

export interface EnhancedZone extends Omit<CleanZone, 'couples'> {
  couples: EnhancedCouple[]
  metadata?: {
    lastCalculated?: string
    totalMatches: number
    hasAllMatchesPlayed: boolean
    hasCalculatedPositions: boolean
  }
}

export interface ZonePositionsData {
  zones: EnhancedZone[]
  availableCouples: AvailableCouple[]
  globalMetadata: {
    hasAnyCalculatedPositions: boolean
    totalZones: number
    totalCouples: number
    lastGlobalUpdate?: string
  }
}

// Fetcher for zone positions data
async function fetchZonePositionsData(tournamentId: string): Promise<{
  zones: any[]
  positions: any[]
}> {
  try {
    // Fetch zones and positions in parallel
    const [zonesResponse, positionsResponse] = await Promise.all([
      fetch(`/api/tournaments/${tournamentId}/zones`),
      fetch(`/api/tournaments/${tournamentId}/all-zone-positions`)
    ])

    if (!zonesResponse.ok) {
      throw new Error(`Failed to fetch zones: ${zonesResponse.statusText}`)
    }

    const zonesData = await zonesResponse.json()
    if (!zonesData.success) {
      throw new Error(zonesData.error || 'Failed to fetch zones')
    }

    // Positions might not exist yet, so handle gracefully
    let positionsData = { success: true, data: { zones: [], totalPositions: 0 } }
    if (positionsResponse.ok) {
      positionsData = await positionsResponse.json()
    }

    return {
      zones: zonesData.zones || [],
      positions: positionsData.data?.zones || []
    }
  } catch (error) {
    console.error('[fetchZonePositionsData] Error:', error)
    throw error
  }
}

// Transform and merge zones with position data
function transformZonesWithPositions(
  rawZones: any[], 
  positionZones: any[]
): EnhancedZone[] {
  // Create comprehensive position lookup map
  const positionsMap = new Map()
  positionZones.forEach((zonePos: any) => {
    const couplePositions = new Map()
    zonePos.positions?.forEach((pos: any) => {
      couplePositions.set(pos.coupleId, {
        position: pos.position,
        stats: {
          played: pos.matchesPlayed,
          won: pos.matchesWon,
          lost: pos.matchesLost,
          scored: pos.gamesWon,
          conceded: pos.gamesLost,
          points: pos.gamesDifference
        },
        positionData: {
          gamesDifference: pos.gamesDifference,
          setsDifference: pos.setsDifference, 
          totalPlayerScore: pos.totalPlayerScore,
          positionTieInfo: pos.positionTieInfo,
          calculatedAt: pos.calculatedAt
        }
      })
    })
    positionsMap.set(zonePos.zoneId, {
      couples: couplePositions,
      lastCalculated: zonePos.positions?.[0]?.calculatedAt
    })
  })

  // Transform zones using ONLY saved position data
  return rawZones.map((zone: any) => {
    const zonePositions = positionsMap.get(zone.id)
    
    // Build couples list from position data (authoritative source)
    const enhancedCouples: EnhancedCouple[] = []
    
    if (zonePositions?.couples) {
      // Create couples from saved positions (most accurate)
      zonePositions.couples.forEach((positionInfo: any, coupleId: string) => {
        // Find couple details from rawZones
        const rawCouple = zone.couples?.find((c: any) => c.id === coupleId)
        
        if (rawCouple) {
          enhancedCouples.push({
            id: coupleId,
            player1_name: rawCouple.player1_name,
            player2_name: rawCouple.player2_name,
            stats: positionInfo.stats, // Use saved stats instead of calculated
            position: positionInfo.position,
            positionData: positionInfo.positionData
          })
        }
      })
    } else {
      // Fallback to legacy data if no positions saved yet
      enhancedCouples.push(...(zone.couples || []).map((couple: any, index: number) => ({
        id: couple.id,
        player1_name: couple.player1_name,
        player2_name: couple.player2_name,
        stats: couple.stats, // Legacy calculated stats as fallback
        position: undefined,
        positionData: undefined
      })))
    }
    
    // Sort by position
    enhancedCouples.sort((a: EnhancedCouple, b: EnhancedCouple) => {
      if (a.position && b.position) return a.position - b.position
      if (a.position && !b.position) return -1
      if (!a.position && b.position) return 1
      return 0
    })

    // Calculate metadata
    const totalMatches = enhancedCouples.reduce((sum, couple) => sum + couple.stats.played, 0)
    const hasCalculatedPositions = enhancedCouples.some(couple => couple.position !== undefined)
    const maxPossibleMatches = enhancedCouples.length > 1 
      ? enhancedCouples.length * (enhancedCouples.length - 1) 
      : 0
    const hasAllMatchesPlayed = totalMatches >= maxPossibleMatches

    return {
      ...zone,
      couples: enhancedCouples,
      metadata: {
        lastCalculated: zonePositions?.lastCalculated,
        totalMatches,
        hasAllMatchesPlayed,
        hasCalculatedPositions
      }
    }
  })
}

/**
 * Hook that extends the existing system with position calculations
 */
export function useZonePositionsEnhanced(tournamentId: string) {
  // SWR key for positions data
  const swrKey = tournamentId ? `/zone-positions-enhanced/${tournamentId}` : null
  
  // Fetch enhanced data
  const {
    data,
    error,
    isLoading,
    mutate
  } = useSWR(
    swrKey,
    () => fetchZonePositionsData(tournamentId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 0,
      dedupingInterval: 5000,
      errorRetryCount: 3
    }
  )

  // Transform data
  const transformedData: ZonePositionsData | null = useMemo(() => {
    if (!data) return null

    const enhancedZones = transformZonesWithPositions(data.zones, data.positions)
    
    // Also fetch available couples (simplified for now)
    const availableCouples: AvailableCouple[] = [] // TODO: Integrate with existing available couples hook

    const globalMetadata = {
      hasAnyCalculatedPositions: enhancedZones.some(zone => zone.metadata?.hasCalculatedPositions),
      totalZones: enhancedZones.length,
      totalCouples: enhancedZones.reduce((sum, zone) => sum + zone.couples.length, 0),
      lastGlobalUpdate: data.positions[0]?.positions?.[0]?.calculatedAt
    }

    return {
      zones: enhancedZones,
      availableCouples,
      globalMetadata
    }
  }, [data])

  // Position calculation functions
  const calculatePositions = useCallback(async (zoneId?: string) => {
    if (!tournamentId) {
      throw new Error('No tournament ID available')
    }

    const endpoint = zoneId 
      ? `/api/tournaments/${tournamentId}/zone-positions`
      : `/api/tournaments/${tournamentId}/all-zone-positions`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneId ? { zoneId, forceRecalculate: true } : { forceRecalculate: true })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to calculate positions')
    }

    // Revalidate data after calculation
    await mutate()

    return result
  }, [tournamentId, mutate])

  // Refresh function
  const refresh = useCallback(async () => {
    try {
      await mutate()
    } catch (error) {
      console.error('[useZonePositionsEnhanced] Refresh error:', error)
      throw error
    }
  }, [mutate])

  return {
    // Data
    zones: transformedData?.zones || [],
    availableCouples: transformedData?.availableCouples || [],
    globalMetadata: transformedData?.globalMetadata || {
      hasAnyCalculatedPositions: false,
      totalZones: 0,
      totalCouples: 0
    },
    
    // State
    isLoading,
    error: error?.message || null,
    
    // Actions
    calculatePositions,
    refresh,
    mutate
  }
}

/**
 * Hook specifically for position actions (lighter)
 */
export function useZonePositionActions(tournamentId: string) {
  const calculatePositions = useCallback(async (zoneId?: string) => {
    if (!tournamentId) {
      throw new Error('No tournament ID available')
    }

    const endpoint = zoneId 
      ? `/api/tournaments/${tournamentId}/zone-positions`
      : `/api/tournaments/${tournamentId}/all-zone-positions`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneId ? { zoneId, forceRecalculate: true } : { forceRecalculate: true })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to calculate positions')
    }

    return result
  }, [tournamentId])

  return {
    calculatePositions
  }
}