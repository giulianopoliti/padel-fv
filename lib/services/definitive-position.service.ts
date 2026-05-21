import { createClientServiceRole } from '@/utils/supabase/server'
import { StandingsCalculatorService, type StandingsSnapshot } from '@/lib/services/standings-calculator.service'
import { TournamentFormatRulesService } from '@/lib/services/tournament-format-rules.service'
import type { RankingPolicyId, RankingScope } from '@/types/tournament-format-v2'

export interface DefinitivePositionAnalysis {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: 'NO_PENDING_MATCHES' | 'BACKTRACKING' | 'CONSERVATIVE_FALLBACK'
  analysisDetails: string
  confidence: 'HIGH' | 'LOW'
  computationTime: number
}

export interface DefinitiveZoneAnalysisResult {
  zoneId: string
  totalCouples: number
  definitivePositions: number
  analysis: DefinitivePositionAnalysis[]
  totalComputationTime: number
  optimizationsApplied: string[]
}

export interface DefinitivePositionResult {
  scope: RankingScope
  zoneResults: DefinitiveZoneAnalysisResult[]
}

type PendingMatch = StandingsSnapshot['matches'][number]

const POSSIBLE_RESULTS = [
  { couple1Games: 6, couple2Games: 0 },
  { couple1Games: 6, couple2Games: 1 },
  { couple1Games: 6, couple2Games: 2 },
  { couple1Games: 6, couple2Games: 3 },
  { couple1Games: 6, couple2Games: 4 },
  { couple1Games: 6, couple2Games: 5 },
  { couple1Games: 7, couple2Games: 5 },
  { couple1Games: 7, couple2Games: 6 },
  { couple1Games: 0, couple2Games: 6 },
  { couple1Games: 1, couple2Games: 6 },
  { couple1Games: 2, couple2Games: 6 },
  { couple1Games: 3, couple2Games: 6 },
  { couple1Games: 4, couple2Games: 6 },
  { couple1Games: 5, couple2Games: 6 },
  { couple1Games: 5, couple2Games: 7 },
  { couple1Games: 6, couple2Games: 7 },
] as const

const isPendingMatch = (match: PendingMatch) => (
  match.status === 'PENDING' || match.status === 'IN_PROGRESS'
)

const getWinnerId = (match: PendingMatch, couple1Games: number, couple2Games: number) => (
  couple1Games > couple2Games ? match.couple1_id : match.couple2_id
)

export class DefinitivePositionService {
  static analyzeFromSnapshot(params: {
    snapshot: StandingsSnapshot
    scope: RankingScope
    rankingPolicyId: RankingPolicyId
    zoneId?: string | null
    maxPendingMatches?: number
  }): DefinitivePositionResult {
    const startedAt = Date.now()
    const maxPendingMatches = params.maxPendingMatches ?? 3
    const zonesToAnalyze = params.zoneId
      ? params.snapshot.zones.filter((zone) => zone.id === params.zoneId)
      : params.snapshot.zones

    if (params.scope === 'GLOBAL') {
      const zoneIds = new Set(zonesToAnalyze.map((zone) => zone.id))
      const analysis = this.analyzeEntries({
        snapshot: params.snapshot,
        scope: 'GLOBAL',
        rankingPolicyId: params.rankingPolicyId,
        pendingMatches: params.snapshot.matches.filter(isPendingMatch),
        maxPendingMatches,
      })

      const byZone = new Map<string, DefinitivePositionAnalysis[]>()
      for (const item of analysis) {
        const couple = params.snapshot.couples.find((entry) => entry.id === item.coupleId)
        if (!couple?.zoneId || !zoneIds.has(couple.zoneId)) continue
        if (!byZone.has(couple.zoneId)) byZone.set(couple.zoneId, [])
        byZone.get(couple.zoneId)!.push(item)
      }

      return {
        scope: 'GLOBAL',
        zoneResults: zonesToAnalyze.map((zone) => {
          const zoneAnalysis = byZone.get(zone.id) || []
          return {
            zoneId: zone.id,
            totalCouples: zoneAnalysis.length,
            definitivePositions: zoneAnalysis.filter((item) => item.isDefinitive).length,
            analysis: zoneAnalysis,
            totalComputationTime: Date.now() - startedAt,
            optimizationsApplied: [],
          }
        }),
      }
    }

    return {
      scope: 'PER_ZONE',
      zoneResults: zonesToAnalyze.map((zone) => {
        const pendingMatches = params.snapshot.matches
          .filter((match) => match.zone_id === zone.id)
          .filter(isPendingMatch)
        const analysis = this.analyzeEntries({
          snapshot: {
            zones: [zone],
            couples: params.snapshot.couples.filter((couple) => couple.zoneId === zone.id),
            matches: params.snapshot.matches.filter((match) => match.zone_id === zone.id),
          },
          scope: 'PER_ZONE',
          rankingPolicyId: params.rankingPolicyId,
          pendingMatches,
          maxPendingMatches,
        })

        return {
          zoneId: zone.id,
          totalCouples: analysis.length,
          definitivePositions: analysis.filter((item) => item.isDefinitive).length,
          analysis,
          totalComputationTime: Date.now() - startedAt,
          optimizationsApplied: pendingMatches.length === 0 ? ['NO_PENDING_MATCHES'] : [],
        }
      }),
    }
  }

  static async analyzeTournament(tournamentId: string, zoneId?: string | null): Promise<DefinitivePositionResult> {
    const supabase = await createClientServiceRole()
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, type, format_type, format_config')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      throw new Error(`Error loading tournament: ${tournamentError?.message || 'Tournament not found'}`)
    }

    const snapshot = await this.loadSnapshot(tournamentId)
    const rules = TournamentFormatRulesService.resolve({
      tournament,
      coupleCount: snapshot.couples.length,
    })

    return this.analyzeFromSnapshot({
      snapshot,
      scope: rules.rankingScope,
      rankingPolicyId: rules.rankingPolicyId,
      zoneId,
    })
  }

  static async updateZoneDefinitiveFlags(tournamentId: string, zoneId?: string | null): Promise<DefinitivePositionResult> {
    const result = await this.analyzeTournament(tournamentId, zoneId)
    const supabase = await createClientServiceRole()

    for (const zoneResult of result.zoneResults) {
      for (const analysis of zoneResult.analysis) {
        const { error } = await supabase
          .from('zone_positions')
          .update({
            is_definitive: analysis.isDefinitive,
            updated_at: new Date().toISOString(),
          })
          .eq('zone_id', zoneResult.zoneId)
          .eq('couple_id', analysis.coupleId)

        if (error) {
          throw new Error(`Error updating definitive flag: ${error.message}`)
        }
      }
    }

    return result
  }

  private static analyzeEntries(params: {
    snapshot: StandingsSnapshot
    scope: RankingScope
    rankingPolicyId: RankingPolicyId
    pendingMatches: PendingMatch[]
    maxPendingMatches: number
  }): DefinitivePositionAnalysis[] {
    const startedAt = Date.now()
    const currentStandings = StandingsCalculatorService.calculateFromSnapshot(params.snapshot, {
      scope: params.scope,
      rankingPolicyId: params.rankingPolicyId,
    })

    if (params.pendingMatches.length === 0) {
      return currentStandings.entries.map((entry) => ({
        coupleId: entry.coupleId,
        currentPosition: this.getRelevantPosition(entry, params.scope),
        isDefinitive: true,
        possiblePositions: [this.getRelevantPosition(entry, params.scope)],
        analysisMethod: 'NO_PENDING_MATCHES',
        analysisDetails: 'No hay partidos pendientes que afecten este ranking.',
        confidence: 'HIGH',
        computationTime: Date.now() - startedAt,
      }))
    }

    if (params.pendingMatches.length > params.maxPendingMatches) {
      return currentStandings.entries.map((entry) => ({
        coupleId: entry.coupleId,
        currentPosition: this.getRelevantPosition(entry, params.scope),
        isDefinitive: false,
        possiblePositions: [],
        analysisMethod: 'CONSERVATIVE_FALLBACK',
        analysisDetails: `Demasiados partidos pendientes (${params.pendingMatches.length}) para simular con seguridad.`,
        confidence: 'LOW',
        computationTime: Date.now() - startedAt,
      }))
    }

    const possiblePositions = new Map<string, Set<number>>()
    for (const entry of currentStandings.entries) {
      possiblePositions.set(entry.coupleId, new Set<number>())
    }

    for (const outcomes of this.generateOutcomeCombinations(params.pendingMatches)) {
      const simulatedMatches = params.snapshot.matches.map((match) => {
        const outcome = outcomes.get(match.id)
        if (!outcome) return match

        return {
          ...match,
          status: 'FINISHED',
          result_couple1: outcome.couple1Games,
          result_couple2: outcome.couple2Games,
          winner_id: getWinnerId(match, outcome.couple1Games, outcome.couple2Games),
        }
      })
      const simulatedStandings = StandingsCalculatorService.calculateFromSnapshot({
        ...params.snapshot,
        matches: simulatedMatches,
      }, {
        scope: params.scope,
        rankingPolicyId: params.rankingPolicyId,
      })

      for (const entry of simulatedStandings.entries) {
        possiblePositions.get(entry.coupleId)?.add(this.getRelevantPosition(entry, params.scope))
      }
    }

    return currentStandings.entries.map((entry) => {
      const positions = Array.from(possiblePositions.get(entry.coupleId) || [])
        .filter((position) => position > 0)
        .sort((a, b) => a - b)

      return {
        coupleId: entry.coupleId,
        currentPosition: this.getRelevantPosition(entry, params.scope),
        isDefinitive: positions.length === 1,
        possiblePositions: positions,
        analysisMethod: 'BACKTRACKING',
        analysisDetails: `Simulacion completa: posiciones posibles ${positions.join(', ') || 'sin datos'}.`,
        confidence: 'HIGH',
        computationTime: Date.now() - startedAt,
      }
    })
  }

  private static getRelevantPosition(entry: { localPosition: number | null; globalPosition: number | null }, scope: RankingScope): number {
    return scope === 'GLOBAL'
      ? entry.globalPosition || 0
      : entry.localPosition || 0
  }

  private static generateOutcomeCombinations(matches: PendingMatch[]): Array<Map<string, typeof POSSIBLE_RESULTS[number]>> {
    const combinations: Array<Map<string, typeof POSSIBLE_RESULTS[number]>> = []

    const walk = (index: number, current: Map<string, typeof POSSIBLE_RESULTS[number]>) => {
      if (index === matches.length) {
        combinations.push(new Map(current))
        return
      }

      const match = matches[index]
      for (const result of POSSIBLE_RESULTS) {
        current.set(match.id, result)
        walk(index + 1, current)
      }
      current.delete(match.id)
    }

    walk(0, new Map())
    return combinations
  }

  private static async loadSnapshot(tournamentId: string): Promise<StandingsSnapshot> {
    const supabase = await createClientServiceRole()

    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('created_at')

    if (zonesError) {
      throw new Error(`Error loading zones: ${zonesError.message}`)
    }

    const zoneIds = (zones || []).map((zone) => zone.id)
    if (zoneIds.length === 0) {
      return { zones: [], couples: [], matches: [] }
    }

    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select(`
        zone_id,
        couple:couples!zone_positions_couple_id_fkey(
          id,
          player1_id,
          player2_id,
          player1:players!couples_player1_id_fkey(id, first_name, last_name, score),
          player2:players!couples_player2_id_fkey(id, first_name, last_name, score)
        )
      `)
      .in('zone_id', zoneIds)

    if (positionsError) {
      throw new Error(`Error loading zone positions: ${positionsError.message}`)
    }

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, result_couple1, result_couple2, winner_id, status, zone_id')
      .eq('tournament_id', tournamentId)
      .in('zone_id', zoneIds)

    if (matchesError) {
      throw new Error(`Error loading matches: ${matchesError.message}`)
    }

    return {
      zones: zones || [],
      couples: (positions || [])
        .map((position: any) => {
          const couple = Array.isArray(position.couple) ? position.couple[0] : position.couple
          if (!couple) return null

          return {
            id: couple.id,
            zoneId: position.zone_id,
            player1_id: couple.player1_id || '',
            player2_id: couple.player2_id || '',
            player1: {
              id: couple.player1?.id || '',
              first_name: couple.player1?.first_name || '',
              last_name: couple.player1?.last_name || '',
              score: couple.player1?.score || 0,
            },
            player2: {
              id: couple.player2?.id || '',
              first_name: couple.player2?.first_name || '',
              last_name: couple.player2?.last_name || '',
              score: couple.player2?.score || 0,
            },
          }
        })
        .filter(Boolean) as StandingsSnapshot['couples'],
      matches: (matches || []).map((match: any) => ({
        id: match.id,
        couple1_id: match.couple1_id,
        couple2_id: match.couple2_id,
        result_couple1: match.result_couple1 === null || match.result_couple1 === undefined
          ? null
          : Number(match.result_couple1),
        result_couple2: match.result_couple2 === null || match.result_couple2 === undefined
          ? null
          : Number(match.result_couple2),
        winner_id: match.winner_id,
        status: match.status,
        zone_id: match.zone_id,
      })),
    }
  }
}
