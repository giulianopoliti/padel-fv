/**
 * Data Serialization Utilities
 * 
 * Transform raw Supabase data into clean, serializable objects
 * for use in Client Components.
 */

import { serialize } from "@/utils/serialization"
import type { 
  CleanZone, 
  SerializableCouple, 
  AvailableCouple, 
  CoupleStats 
} from "../types/zone-types"

// Transform raw zone data from server to clean zone
export function transformZoneData(rawZone: any): CleanZone {
  const cleanZone: CleanZone = {
    id: rawZone.id || '',
    name: rawZone.name || '',
    capacity: rawZone.capacity || 4,
    createdAt: rawZone.created_at || new Date().toISOString(),
    couples: []
  }

  // Transform couples if they exist
  if (rawZone.couples && Array.isArray(rawZone.couples)) {
    cleanZone.couples = rawZone.couples.map(transformCoupleData)
  }

  return serialize(cleanZone)
}

// Transform raw couple data to serializable couple
export function transformCoupleData(rawCouple: any): SerializableCouple {
  // Default stats
  const defaultStats: CoupleStats = {
    played: 0,
    won: 0,
    lost: 0,
    scored: 0,
    conceded: 0,
    points: 0
  }

  const couple: SerializableCouple = {
    id: rawCouple.id || '',
    player1Name: extractPlayerName(rawCouple, 'player1'),
    player2Name: extractPlayerName(rawCouple, 'player2'),
    stats: rawCouple.stats || defaultStats,
    metadata: {
      player1Id: extractPlayerId(rawCouple, 'player1'),
      player2Id: extractPlayerId(rawCouple, 'player2'),
      registrationDate: rawCouple.created_at || new Date().toISOString(),
      // Preserve original player data for optimistic updates
      originalPlayerData: {
        player1: extractOriginalPlayerData(rawCouple, 'player1'),
        player2: extractOriginalPlayerData(rawCouple, 'player2')
      }
    }
  }

  return serialize(couple)
}

// Transform available couple data
export function transformAvailableCoupleData(rawCouple: any): AvailableCouple {
  const couple: AvailableCouple = {
    id: rawCouple.couple_id || rawCouple.id || '',
    player1Name: extractAvailablePlayerName(rawCouple, 'player1'),
    player2Name: extractAvailablePlayerName(rawCouple, 'player2'),
    metadata: {
      player1Id: rawCouple.player1?.id,
      player2Id: rawCouple.player2?.id,
      player1Score: rawCouple.player1?.score,
      player2Score: rawCouple.player2?.score
    }
  }

  return serialize(couple)
}

// Helper: Extract player name safely from various data structures
function extractPlayerName(rawCouple: any, playerKey: 'player1' | 'player2'): string {
  const player = rawCouple[playerKey]

  // 1) Nested relations (array format coming from Supabase foreign-key joins)
  if (Array.isArray(player) && player.length > 0) {
    const p = player[0]
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim()
    if (name) return name
  }

  // 2) Direct object format (already de-referenced FK)
  if (player && typeof player === 'object') {
    const name = `${player.first_name || ''} ${player.last_name || ''}`.trim()
    if (name) return name
  }

  // 3) String format (pre-combined name)
  if (typeof player === 'string' && player.trim()) {
    return player.trim()
  }

  // 4) Flattened columns that come from the zones API (player1_name / player2_name)
  if (playerKey === 'player1' && rawCouple.player1_name) return rawCouple.player1_name
  if (playerKey === 'player2' && rawCouple.player2_name) return rawCouple.player2_name

  // 5) Deep fallback: inspect originalData recursively
  if (rawCouple.originalData) {
    const recursiveName = extractPlayerName(rawCouple.originalData, playerKey)
    if (recursiveName && recursiveName !== 'Jugador desconocido') return recursiveName
  }

  // 6) Ultimate default
  return 'Jugador desconocido'
}

// Helper: Extract player ID safely
function extractPlayerId(rawCouple: any, playerKey: 'player1' | 'player2'): string | undefined {
  const player = rawCouple[playerKey]
  
  if (!player) return undefined
  
  // Handle array format
  if (Array.isArray(player) && player.length > 0) {
    return player[0].id
  }
  
  // Handle object format
  if (typeof player === 'object' && player.id) {
    return player.id
  }
  
  return undefined
}

// Helper: Extract available player name (different structure)
function extractAvailablePlayerName(rawCouple: any, playerKey: 'player1' | 'player2'): string {
  const player = rawCouple[playerKey]
  
  if (!player) return 'Jugador desconocido'
  
  return `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador desconocido'
}

// Helper: Extract original player data for preservation
function extractOriginalPlayerData(rawCouple: any, playerKey: 'player1' | 'player2') {
  const player = rawCouple[playerKey]
  
  if (!player) return undefined
  
  // Handle array format (from foreign key relations)
  if (Array.isArray(player) && player.length > 0) {
    const p = player[0]
    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      score: p.score
    }
  }
  
  // Handle direct object format
  if (typeof player === 'object' && player.first_name !== undefined) {
    return {
      id: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      score: player.score
    }
  }
  
  // Try to get from originalData if available
  if (rawCouple.originalData) {
    return extractOriginalPlayerData(rawCouple.originalData, playerKey)
  }
  
  return undefined
}

// Batch transform zones
export function transformZonesData(rawZones: any[]): CleanZone[] {
  if (!Array.isArray(rawZones)) return []
  
  return rawZones.map(transformZoneData)
}

// Batch transform available couples
export function transformAvailableCouplesData(rawCouples: any[]): AvailableCouple[] {
  if (!Array.isArray(rawCouples)) return []
  
  return rawCouples.map(transformAvailableCoupleData)
}