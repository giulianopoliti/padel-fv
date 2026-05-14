/**
 * Utilidades para obtener partidos de jugadores en torneos LONG
 * Sin edge functions - lógica en frontend
 */

import { createClient } from '@/utils/supabase/client'

export interface PlayerMatch {
  id: string
  status: string
  round: 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL'
  couple1_id: string | null
  couple2_id: string | null
  winner_id: string | null
  result_couple1: string | null
  result_couple2: string | null
  created_at: string
  zone_id?: string | null
  tournament_id: string
  couple1?: {
    id: string
    player1_id: string
    player2_id: string
    player1: {
      id: string
      first_name: string
      last_name: string
    }
    player2: {
      id: string
      first_name: string
      last_name: string
    }
  }
  couple2?: {
    id: string
    player1_id: string
    player2_id: string
    player1: {
      id: string
      first_name: string
      last_name: string
    }
    player2: {
      id: string
      first_name: string
      last_name: string
    }
  }
  set_matches?: {
    id: string
    set_number: number
    couple1_games: number
    couple2_games: number
    winner_couple_id: string
  }[]
  fecha_matches?: {
    scheduled_date: string | null
    scheduled_start_time: string | null
    court_assignment: string | null
  }[]
}

export interface PlayerTournamentData {
  isRegistered: boolean
  isIndividualRegistration: boolean
  isEliminated: boolean
  eliminatedAt: string | null
  eliminatedInRound: string | null
  nextMatch: PlayerMatch | null
  zoneMatches: PlayerMatch[]
  eliminationMatches: PlayerMatch[]
  playerCoupleId: string | null
}

/**
 * Obtiene todos los datos de partidos de un jugador en un torneo específico
 */
export async function getPlayerTournamentMatches(
  playerId: string,
  tournamentId: string
): Promise<PlayerTournamentData> {
  const supabase = createClient()

  try {
    // 1. Verificar si el jugador está registrado en el torneo
    // Buscar inscripciones donde el player esté como player1_id o player2_id en la pareja
    const { data: inscriptions } = await supabase
      .from('inscriptions')
      .select(`
        id,
        player_id,
        couple_id,
        is_eliminated,
        eliminated_at,
        eliminated_in_round,
        couples (
          id,
          player1_id,
          player2_id
        )
      `)
      .eq('tournament_id', tournamentId)

    if (!inscriptions || inscriptions.length === 0) {
      return {
        isRegistered: false,
        isIndividualRegistration: false,
        isEliminated: false,
        eliminatedAt: null,
        eliminatedInRound: null,
        nextMatch: null,
        zoneMatches: [],
        eliminationMatches: [],
        playerCoupleId: null
      }
    }

    // Encontrar la inscripción donde el player está en la pareja
    const playerInscription = inscriptions.find((inscription: any) => {
      if (inscription.player_id === playerId && !inscription.couple_id) {
        return true
      }

      const couple = Array.isArray(inscription.couples) ? inscription.couples[0] : inscription.couples
      if (!couple) {
        return false
      }

      return couple.player1_id === playerId || couple.player2_id === playerId
    })

    if (!playerInscription) {
      return {
        isRegistered: false,
        isIndividualRegistration: false,
        isEliminated: false,
        eliminatedAt: null,
        eliminatedInRound: null,
        nextMatch: null,
        zoneMatches: [],
        eliminationMatches: [],
        playerCoupleId: null
      }
    }

    const playerCoupleId = playerInscription.couple_id
    const isIndividualRegistration = !playerCoupleId

    // 2. Obtener todos los partidos donde participa la pareja del jugador
    if (isIndividualRegistration) {
      return {
        isRegistered: true,
        isIndividualRegistration: true,
        isEliminated: playerInscription.is_eliminated || false,
        eliminatedAt: playerInscription.eliminated_at,
        eliminatedInRound: playerInscription.eliminated_in_round,
        nextMatch: null,
        zoneMatches: [],
        eliminationMatches: [],
        playerCoupleId: null
      }
    }

    // 🔒 EXCLUDE DRAFT matches - players should never see unpublished matches
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        round,
        couple1_id,
        couple2_id,
        winner_id,
        result_couple1,
        result_couple2,
        created_at,
        zone_id,
        tournament_id,
        couple1:couples!couple1_id(
          id,
          player1_id,
          player2_id,
          player1:players!player1_id(
            id,
            first_name,
            last_name
          ),
          player2:players!player2_id(
            id,
            first_name,
            last_name
          )
        ),
        couple2:couples!couple2_id(
          id,
          player1_id,
          player2_id,
          player1:players!player1_id(
            id,
            first_name,
            last_name
          ),
          player2:players!player2_id(
            id,
            first_name,
            last_name
          )
        ),
        set_matches(
          id,
          set_number,
          couple1_games,
          couple2_games,
          winner_couple_id
        ),
        fecha_matches(
          scheduled_date,
          scheduled_start_time,
          court_assignment
        )
      `)
      .eq('tournament_id', tournamentId)
      .neq('status', 'DRAFT')  // 🆕 Exclude DRAFT matches from player view
      .or(`couple1_id.eq.${playerCoupleId},couple2_id.eq.${playerCoupleId}`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching player matches:', error)
      throw error
    }

    const playerMatches = matches || []

    // 3. Separar partidos por tipo
    const zoneMatches = playerMatches.filter(m => m.round === 'ZONE')
    const eliminationMatches = playerMatches.filter(m => m.round !== 'ZONE')

    // 4. Encontrar próximo partido (primer PENDING o IN_PROGRESS)
    const nextMatch = playerMatches.find(m =>
      m.status === 'PENDING' || m.status === 'IN_PROGRESS'
    ) || null

    return {
      isRegistered: true,
      isIndividualRegistration: false,
      isEliminated: playerInscription.is_eliminated || false,
      eliminatedAt: playerInscription.eliminated_at,
      eliminatedInRound: playerInscription.eliminated_in_round,
      nextMatch,
      zoneMatches,
      eliminationMatches,
      playerCoupleId
    }

  } catch (error) {
    console.error('Error in getPlayerTournamentMatches:', error)
    return {
      isRegistered: false,
      isIndividualRegistration: false,
      isEliminated: false,
      eliminatedAt: null,
      eliminatedInRound: null,
      nextMatch: null,
      zoneMatches: [],
      eliminationMatches: [],
      playerCoupleId: null
    }
  }
}

/**
 * Formatea el nombre de una pareja para mostrar
 */
export function formatCoupleName(couple: PlayerMatch['couple1']): string {
  if (!couple?.player1 || !couple?.player2) {
    return 'Pareja no definida'
  }

  const player1Name = `${couple.player1.first_name} ${couple.player1.last_name}`
  const player2Name = `${couple.player2.first_name} ${couple.player2.last_name}`

  return `${player1Name} / ${player2Name}`
}

/**
 * Obtiene el nombre de la pareja oponente para un match específico
 */
export function getOpponentCoupleName(match: PlayerMatch, playerCoupleId: string): string {
  const isPlayerInCouple1 = match.couple1_id === playerCoupleId
  const opponentCouple = isPlayerInCouple1 ? match.couple2 : match.couple1

  return formatCoupleName(opponentCouple)
}

/**
 * Determina si el jugador ganó un partido
 */
export function didPlayerWin(match: PlayerMatch, playerCoupleId: string): boolean | null {
  if (!match.winner_id || match.status !== 'FINISHED') {
    return null
  }

  return match.winner_id === playerCoupleId
}

/**
 * Formatea información de horario del partido
 */
export function formatMatchSchedule(match: PlayerMatch): string {
  // Normalizar fecha_matches: Supabase puede retornarlo como objeto o array
  const fechaMatchesArray = Array.isArray(match.fecha_matches)
    ? match.fecha_matches
    : match.fecha_matches
      ? [match.fecha_matches as any]
      : []

  const fechaMatch = fechaMatchesArray[0]

  if (!fechaMatch?.scheduled_date) {
    return 'Horario no definido'
  }

  // Add T12:00:00 to avoid timezone issues (YYYY-MM-DD is interpreted as UTC 00:00)
  let schedule = new Date(fechaMatch.scheduled_date + 'T12:00:00').toLocaleDateString('es-ES')

  if (fechaMatch.scheduled_start_time) {
    // Format time to HH:MM (remove seconds)
    const timeFormatted = fechaMatch.scheduled_start_time.slice(0, 5)
    schedule += ` a las ${timeFormatted}`
  }

  if (fechaMatch.court_assignment) {
    schedule += ` - Cancha ${fechaMatch.court_assignment}`
  }

  return schedule
}

/**
 * Obtiene el nombre traducido de la ronda
 */
export function getRoundDisplayName(round: string): string {
  const roundNames: Record<string, string> = {
    'ZONE': 'Zona Clasificatoria',
    '32VOS': '32vos de Final',
    '16VOS': '16vos de Final',
    '8VOS': 'Octavos de Final',
    '4TOS': 'Cuartos de Final',
    'SEMIFINAL': 'Semifinal',
    'FINAL': 'Final'
  }

  return roundNames[round] || round
}
