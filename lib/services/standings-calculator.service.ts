import { createClientServiceRole } from '@/utils/supabase/server'
import { ZoneRankingEngine } from '@/lib/services/zone-position/zone-ranking-engine'
import { ZoneStatsCalculator } from '@/lib/services/zone-position/zone-stats-calculator'
import type { CoupleData, MatchData } from '@/lib/services/zone-position/types'
import type { RankingPolicyId, RankingScope } from '@/types/tournament-format-v2'

export interface StandingStats {
  wins: number
  losses: number
  gamesFor: number
  gamesAgainst: number
  gamesDifference: number
  gamesWon: number
}

export interface StandingEntry {
  coupleId: string
  zoneId: string | null
  localPosition: number | null
  globalPosition: number | null
  stats: StandingStats
  tieInfo: string | null
}

export interface StandingsResult {
  scope: RankingScope
  entries: StandingEntry[]
}

export interface StandingsInput {
  tournamentId: string
  scope: RankingScope
  rankingPolicyId: RankingPolicyId
  includePending?: boolean
}

export interface StandingsZoneInput {
  id: string
  name?: string | null
}

export interface StandingsCoupleInput extends CoupleData {
  zoneId: string | null
}

export interface StandingsMatchInput extends MatchData {}

export interface StandingsSnapshot {
  zones: StandingsZoneInput[]
  couples: StandingsCoupleInput[]
  matches: StandingsMatchInput[]
}

const toMatchData = (match: any): StandingsMatchInput => ({
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
})

const toStandingEntry = (
  rankedCouple: any,
  options: { zoneId: string | null; localPosition: number | null; globalPosition: number | null }
): StandingEntry => ({
  coupleId: rankedCouple.coupleId,
  zoneId: options.zoneId,
  localPosition: options.localPosition,
  globalPosition: options.globalPosition,
  stats: {
    wins: rankedCouple.matchesWon,
    losses: rankedCouple.matchesLost,
    gamesFor: rankedCouple.gamesWon,
    gamesAgainst: rankedCouple.gamesLost,
    gamesDifference: rankedCouple.gamesDifference,
    gamesWon: rankedCouple.gamesWon,
  },
  tieInfo: rankedCouple.positionTieInfo || null,
})

export class StandingsCalculatorService {
  static calculateFromSnapshot(
    snapshot: StandingsSnapshot,
    input: Omit<StandingsInput, 'tournamentId'>
  ): StandingsResult {
    if (input.rankingPolicyId !== 'STANDARD_PADEL') {
      throw new Error(`Ranking policy not supported: ${input.rankingPolicyId}`)
    }

    if (input.scope === 'GLOBAL') {
      return this.calculateGlobal(snapshot)
    }

    return this.calculatePerZone(snapshot)
  }

  static async calculate(input: StandingsInput): Promise<StandingsResult> {
    const snapshot = await this.loadSnapshot(input.tournamentId, Boolean(input.includePending))
    return this.calculateFromSnapshot(snapshot, input)
  }

  private static calculatePerZone(snapshot: StandingsSnapshot): StandingsResult {
    const entries: StandingEntry[] = []

    for (const zone of snapshot.zones) {
      const zoneCouples = snapshot.couples.filter((couple) => couple.zoneId === zone.id)
      const zoneMatches = snapshot.matches.filter((match) => match.zone_id === zone.id)
      const ranked = this.rank(zoneCouples, zoneMatches)

      ranked.forEach((couple) => {
        entries.push(toStandingEntry(couple, {
          zoneId: zone.id,
          localPosition: couple.position,
          globalPosition: null,
        }))
      })
    }

    return { scope: 'PER_ZONE', entries }
  }

  private static calculateGlobal(snapshot: StandingsSnapshot): StandingsResult {
    const couplesById = new Map<string, StandingsCoupleInput>()

    for (const couple of snapshot.couples) {
      if (!couplesById.has(couple.id)) {
        couplesById.set(couple.id, couple)
      }
    }

    const ranked = this.rank(Array.from(couplesById.values()), snapshot.matches)

    return {
      scope: 'GLOBAL',
      entries: ranked.map((couple) => {
        const sourceCouple = couplesById.get(couple.coupleId)
        return toStandingEntry(couple, {
          zoneId: sourceCouple?.zoneId || null,
          localPosition: null,
          globalPosition: couple.position,
        })
      }),
    }
  }

  private static rank(couples: StandingsCoupleInput[], matches: StandingsMatchInput[]) {
    const calculator = new ZoneStatsCalculator()
    const engine = new ZoneRankingEngine()
    const coupleData: CoupleData[] = couples.map(({ zoneId, ...couple }) => couple)
    const finishedMatches = matches.filter((match) => match.status === 'FINISHED')
    const stats = calculator.calculateAllCoupleStats(coupleData, finishedMatches)
    const headToHeadMatrix = calculator.createHeadToHeadMatrix(coupleData, finishedMatches)

    return engine.rankCouplesByAllCriteria(stats, headToHeadMatrix)
  }

  private static async loadSnapshot(tournamentId: string, includePending: boolean): Promise<StandingsSnapshot> {
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

    let matchQuery = supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, result_couple1, result_couple2, winner_id, status, zone_id')
      .eq('tournament_id', tournamentId)
      .in('zone_id', zoneIds)

    if (!includePending) {
      matchQuery = matchQuery.eq('status', 'FINISHED')
    }

    const { data: matches, error: matchesError } = await matchQuery

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
          } satisfies StandingsCoupleInput
        })
        .filter((couple): couple is StandingsCoupleInput => Boolean(couple)),
      matches: (matches || []).map(toMatchData),
    }
  }
}
