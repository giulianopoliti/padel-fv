import { AdvancementPlanner } from '@/lib/services/advancement-planner.service'
import { getOperationalBracketKeysForFormat } from '@/lib/services/bracket-key-policy'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import type { BracketKey } from '@/types/tournament-format-v2'

type SupabaseLike = {
  from: (table: string) => any
}

type CoupleNameSource = {
  id?: string | null
  players_player1?: PlayerNameSource | PlayerNameSource[] | null
  players_player2?: PlayerNameSource | PlayerNameSource[] | null
  player1?: PlayerNameSource | PlayerNameSource[] | null
  player2?: PlayerNameSource | PlayerNameSource[] | null
}

type PlayerNameSource = {
  first_name?: string | null
  last_name?: string | null
}

export interface BracketReplacementCutLine {
  afterPosition: number
  label: string
}

export interface BracketReplacementStandingRow {
  coupleId: string
  position: number | null
  name: string
  wins: number
  losses: number
  setsDifference: number
  gamesDifference: number
  inCurrentBracket: boolean
  inOtherBracket: boolean
  currentSeed: number | null
  currentBracketPosition: number | null
}

export interface BracketReplacementSeedRow {
  id: string
  seed: number
  bracketPosition: number | null
  coupleId: string
  name: string
}

export interface BracketReplacementOptions {
  tournament: {
    id: string
    type: string | null
    status: string | null
  }
  bracketKey: BracketKey
  bracketLabel: string
  availableBracketKeys: BracketKey[]
  cutLines: BracketReplacementCutLine[]
  standings: BracketReplacementStandingRow[]
  seeds: BracketReplacementSeedRow[]
  incomingCandidates: BracketReplacementStandingRow[]
}

export function getBracketReplacementCutLines(params: {
  bracketKey: BracketKey
  format: ReturnType<typeof TournamentFormatResolver.getResolvedFormat>
  currentSeedCount: number
}): BracketReplacementCutLine[] {
  const config = params.format.effectiveAdvancementConfig

  if (config.kind === 'GOLD_SILVER') {
    return [
      { afterPosition: config.goldCount, label: 'Corte Copa de Oro' },
      { afterPosition: config.goldCount + config.silverCount, label: 'Corte Copa de Plata' },
    ]
  }

  if (config.kind === 'SINGLE') {
    return [{ afterPosition: config.advanceCount, label: 'Corte de clasificacion' }]
  }

  if (params.currentSeedCount > 0) {
    return [{ afterPosition: params.currentSeedCount, label: 'Corte de clasificacion' }]
  }

  return []
}

export function getCoupleDisplayName(couple: CoupleNameSource | null | undefined): string {
  if (!couple) return 'Pareja sin datos'

  const player1 = normalizePlayerNameSource(couple.players_player1 || couple.player1)
  const player2 = normalizePlayerNameSource(couple.players_player2 || couple.player2)
  const player1Name = `${player1?.first_name || ''} ${player1?.last_name || ''}`.trim()
  const player2Name = `${player2?.first_name || ''} ${player2?.last_name || ''}`.trim()
  const displayName = [player1Name, player2Name].filter(Boolean).join(' / ')

  return displayName || 'Pareja sin nombre'
}

function normalizePlayerNameSource(
  player: PlayerNameSource | PlayerNameSource[] | null | undefined
): PlayerNameSource | null {
  if (Array.isArray(player)) return player[0] || null
  return player || null
}

export async function getBracketReplacementOptions(
  supabase: SupabaseLike,
  tournamentId: string,
  bracketKey: BracketKey
): Promise<BracketReplacementOptions> {
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, type, status, format_type, format_config')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error(tournamentError?.message || 'No se encontro el torneo')
  }

  if (tournament.type !== 'LONG') {
    throw new Error('Solo se permite reemplazar parejas en torneos LONG')
  }

  const resolvedFormat = TournamentFormatResolver.getResolvedFormat(tournament)
  const availableBracketKeys = getOperationalBracketKeysForFormat(resolvedFormat)

  if (!availableBracketKeys.includes(bracketKey)) {
    throw new Error('La llave solicitada no corresponde al formato del torneo')
  }

  const [seedsResult, allSeedsResult, standingsResult, inscriptionsResult] = await Promise.all([
    supabase
      .from('tournament_couple_seeds')
      .select(`
        id,
        seed,
        bracket_position,
        couple_id,
        couples:couple_id (
          id,
          players_player1:players!couples_player1_id_fkey (
            first_name,
            last_name
          ),
          players_player2:players!couples_player2_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('bracket_key', bracketKey)
      .not('couple_id', 'is', null)
      .order('seed', { ascending: true }),
    supabase
      .from('tournament_couple_seeds')
      .select('bracket_key, couple_id')
      .eq('tournament_id', tournamentId)
      .not('couple_id', 'is', null),
    supabase
      .from('zone_positions')
      .select(`
        position,
        wins,
        losses,
        sets_difference,
        games_difference,
        couple_id,
        couples:couple_id (
          id,
          players_player1:players!couples_player1_id_fkey (
            first_name,
            last_name
          ),
          players_player2:players!couples_player2_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('position', { ascending: true }),
    supabase
      .from('inscriptions')
      .select(`
        couple_id,
        couples:couple_id (
          id,
          players_player1:players!couples_player1_id_fkey (
            first_name,
            last_name
          ),
          players_player2:players!couples_player2_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('es_prueba', false),
  ])

  if (seedsResult.error) throw new Error(`Error cargando seeds: ${seedsResult.error.message}`)
  if (allSeedsResult.error) throw new Error(`Error cargando llaves: ${allSeedsResult.error.message}`)
  if (standingsResult.error) throw new Error(`Error cargando posiciones: ${standingsResult.error.message}`)
  if (inscriptionsResult.error) throw new Error(`Error cargando parejas: ${inscriptionsResult.error.message}`)

  const seeds: BracketReplacementSeedRow[] = (seedsResult.data || [])
    .filter((seed: any) => seed.couple_id)
    .map((seed: any) => ({
      id: seed.id,
      seed: seed.seed,
      bracketPosition: seed.bracket_position,
      coupleId: seed.couple_id,
      name: getCoupleDisplayName(seed.couples),
    }))

  const seedByCouple = new Map<string, BracketReplacementSeedRow>(
    seeds.map((seed: BracketReplacementSeedRow) => [seed.coupleId, seed])
  )
  const currentBracketCoupleIds = new Set<string>(
    seeds.map((seed: BracketReplacementSeedRow) => seed.coupleId)
  )
  const otherBracketCoupleIds = new Set(
    (allSeedsResult.data || [])
      .filter((seed: any) => seed.bracket_key !== bracketKey && seed.couple_id)
      .map((seed: any) => seed.couple_id as string)
  )
  const rowsByCouple = new Map<string, BracketReplacementStandingRow>()

  for (const row of standingsResult.data || []) {
    if (!row.couple_id) continue
    const seed = seedByCouple.get(row.couple_id)
    rowsByCouple.set(row.couple_id, {
      coupleId: row.couple_id,
      position: row.position,
      name: getCoupleDisplayName(row.couples),
      wins: row.wins || 0,
      losses: row.losses || 0,
      setsDifference: row.sets_difference || 0,
      gamesDifference: row.games_difference || 0,
      inCurrentBracket: currentBracketCoupleIds.has(row.couple_id),
      inOtherBracket: otherBracketCoupleIds.has(row.couple_id),
      currentSeed: seed?.seed || null,
      currentBracketPosition: seed?.bracketPosition || null,
    })
  }

  for (const inscription of inscriptionsResult.data || []) {
    const coupleId = inscription.couple_id
    if (!coupleId || rowsByCouple.has(coupleId)) continue

    const seed = seedByCouple.get(coupleId)
    rowsByCouple.set(coupleId, {
      coupleId,
      position: null,
      name: getCoupleDisplayName(inscription.couples),
      wins: 0,
      losses: 0,
      setsDifference: 0,
      gamesDifference: 0,
      inCurrentBracket: currentBracketCoupleIds.has(coupleId),
      inOtherBracket: otherBracketCoupleIds.has(coupleId),
      currentSeed: seed?.seed || null,
      currentBracketPosition: seed?.bracketPosition || null,
    })
  }

  const standings = Array.from(rowsByCouple.values()).sort((left, right) => {
    if (left.position === null && right.position === null) return left.name.localeCompare(right.name)
    if (left.position === null) return 1
    if (right.position === null) return -1
    return left.position - right.position
  })

  return {
    tournament: {
      id: tournament.id,
      type: tournament.type,
      status: tournament.status,
    },
    bracketKey,
    bracketLabel: AdvancementPlanner.getBracketLabel(bracketKey),
    availableBracketKeys,
    cutLines: getBracketReplacementCutLines({
      bracketKey,
      format: resolvedFormat,
      currentSeedCount: seeds.length,
    }),
    standings,
    seeds,
    incomingCandidates: standings.filter((row) => !row.inCurrentBracket),
  }
}
