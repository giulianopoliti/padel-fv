'use client'

import React, { useState, useEffect } from 'react'
import { Trophy, Loader2 } from 'lucide-react'

// ============================================================================
// TIPOS
// ============================================================================

interface SetData {
  id: string
  set_number: number
  couple1_games: number
  couple2_games: number
  winner_couple_id: string
  status: string
}

interface MatchSummary {
  id: string
  status: string
  result_couple1: string  // Sets ganados por couple1
  result_couple2: string  // Sets ganados por couple2
  winner_id: string
}

interface ThreeSetResultDisplayProps {
  matchId: string
  className?: string
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ThreeSetResultDisplay({ matchId, className }: ThreeSetResultDisplayProps) {
  const [sets, setSets] = useState<SetData[]>([])
  const [match, setMatch] = useState<MatchSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!matchId) return
    fetchMatchData()
  }, [matchId])

  const fetchMatchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // ✅ OBTENER DATOS DE matches Y set_matches EN PARALELO
      const [matchResponse, setsResponse] = await Promise.all([
        fetch(`/api/matches/${matchId}/summary`),
        fetch(`/api/matches/${matchId}/sets`)
      ])

      if (!matchResponse.ok || !setsResponse.ok) {
        throw new Error('Error fetching match data')
      }

      const [matchData, setsData] = await Promise.all([
        matchResponse.json(),
        setsResponse.json()
      ])

      if (matchData.success) {
        setMatch(matchData.match)
      } else {
        throw new Error(matchData.error || 'Error fetching match summary')
      }

      if (setsData.success) {
        setSets(setsData.sets || [])
      } else {
        throw new Error(setsData.error || 'Error fetching sets data')
      }

    } catch (err) {
      console.error('Error fetching match data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando resultado...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`text-sm text-red-500 ${className}`}>
        Error: {error}
      </div>
    )
  }

  // No match data
  if (!match) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Sin datos del match
      </div>
    )
  }

  // No sets data (shouldn't happen for completed matches)
  if (sets.length === 0) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        Sin datos de sets
      </div>
    )
  }

  // Sort sets by set_number
  const sortedSets = sets.sort((a, b) => a.set_number - b.set_number)

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ✅ RESUMEN DE SETS GANADOS */}
      <div className="flex items-center gap-2 text-sm">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="font-medium text-gray-900">
          Sets: {match.result_couple1}-{match.result_couple2}
        </span>
      </div>

      {/* ✅ DETALLES DE CADA SET */}
      <div className="flex gap-2 text-xs">
        {sortedSets.map((set) => (
          <div
            key={set.id}
            className="bg-gray-100 px-2 py-1 rounded text-center min-w-[40px]"
          >
            <div className="font-medium text-gray-600 mb-1">S{set.set_number}</div>
            <div className="font-mono font-semibold text-gray-900">
              {set.couple1_games}-{set.couple2_games}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ SCORE FINAL FORMATEADO */}
      <div className="text-xs text-gray-600">
        {sortedSets.map(set => `${set.couple1_games}-${set.couple2_games}`).join(', ')}
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTAR COMO DEFAULT
// ============================================================================

export default ThreeSetResultDisplay