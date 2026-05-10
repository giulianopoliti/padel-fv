'use server'

import { createClient } from '@/utils/supabase/server'
import { getTenantUpcomingTournamentSummaries } from '@/lib/services/tenant-home.service'

export type PlayerNextMatch = {
  match_id: string
  tournament_id: string
  tournament_name: string
  club_name?: string
  club_address?: string
  opponent_names: string[]
  partner_name: string
  round?: 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL'
  scheduled_info: {
    date?: string
    time?: string
    court?: string
  }
  status: 'PENDING' | 'IN_PROGRESS'
}

export type PlayerNextMatchResult = {
  nextMatches: PlayerNextMatch[]
  error?: string
}

export type TournamentData = {
  id: string
  name: string
  start_date: string
  status: string
  category_name: string
  max_participants: number
  clubes: {
    name: string
    address: string
  }[]
}

export type InscribedTournament = {
  inscription_id: string
  couple_id: string
  tournament: {
    id: string
    name: string
    start_date: string
    end_date: string
    status: string
    category_name: string
    gender: string
    club: {
      name: string
      address: string | null
    }
  }
  partner: {
    id: string
    first_name: string
    last_name: string
    profile_image_url: string | null
  }
  current_player: {
    id: string
    first_name: string
    last_name: string
    profile_image_url: string | null
  }
}

export type InscribedTournamentsResult = {
  inscribedTournaments: InscribedTournament[]
  error?: string
}

export type UpcomingTournament = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  category_name: string
  gender: string
  max_participants: number | null
  current_inscriptions: number
  description: string
  price: number | string | null
  is_inscribed: boolean
  is_full: boolean
  enable_transfer_proof?: boolean
  transfer_alias?: string | null
  transfer_amount?: number | null
  club: {
    name: string
    address: string | null
  }
}

export type UpcomingTournamentsResult = {
  upcomingTournaments: UpcomingTournament[]
  error?: string
}

export async function getPlayerNextMatch(playerId: string): Promise<PlayerNextMatchResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.functions.invoke('get-player-next-match', {
      body: { playerId },
    })

    if (error) {
      console.error('Edge function error:', error)
      return { nextMatches: [], error: 'Error al obtener proximos partidos' }
    }

    return data as PlayerNextMatchResult
  } catch (error) {
    console.error('Error calling edge function:', error)
    return {
      nextMatches: [],
      error: 'Error inesperado al obtener proximos partidos',
    }
  }
}

export async function getPlayerInscribedTournaments(playerId: string): Promise<InscribedTournamentsResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.functions.invoke('get-player-inscribed-tournaments', {
      body: { playerId },
    })

    if (error) {
      console.error('Edge function error:', error)
      return {
        inscribedTournaments: [],
        error: 'Error al obtener torneos inscriptos',
      }
    }

    return data as InscribedTournamentsResult
  } catch (error) {
    console.error('Error calling edge function:', error)
    return {
      inscribedTournaments: [],
      error: 'Error inesperado al obtener torneos inscriptos',
    }
  }
}

export async function getPlayerUpcomingTournaments(playerId: string): Promise<UpcomingTournamentsResult> {
  try {
    const supabase = await createClient()
    const tournaments = await getTenantUpcomingTournamentSummaries(8)

    if (tournaments.length === 0) {
      return { upcomingTournaments: [] }
    }

    const { data: playerCouples, error: couplesError } = await supabase
      .from('couples')
      .select('id')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)

    if (couplesError) {
      console.error('Error fetching player couples:', couplesError)
      return {
        upcomingTournaments: [],
        error: 'Error al obtener parejas del jugador',
      }
    }

    const coupleIds = (playerCouples || []).map((couple: any) => couple.id)
    const tournamentIds = tournaments.map((tournament) => tournament.id)

    let inscribedTournamentIds = new Set<string>()
    if (coupleIds.length > 0) {
      const { data: inscriptions, error: inscriptionsError } = await supabase
        .from('inscriptions')
        .select('tournament_id')
        .in('couple_id', coupleIds)
        .in('tournament_id', tournamentIds)

      if (inscriptionsError) {
        console.error('Error fetching player inscriptions:', inscriptionsError)
      } else {
        inscribedTournamentIds = new Set((inscriptions || []).map((inscription: any) => inscription.tournament_id))
      }
    }

    const { data: allInscriptions, error: allInscriptionsError } = await supabase
      .from('inscriptions')
      .select('tournament_id')
      .in('tournament_id', tournamentIds)

    if (allInscriptionsError) {
      console.error('Error fetching tournament inscription counts:', allInscriptionsError)
    }

    const countMap: Record<string, number> = {}
    for (const inscription of allInscriptions || []) {
      const tournamentId = (inscription as any).tournament_id
      countMap[tournamentId] = (countMap[tournamentId] || 0) + 1
    }

    const upcomingTournaments: UpcomingTournament[] = tournaments.map((tournament) => {
      const currentInscriptions = countMap[tournament.id] || 0
      const maxParticipants = null

      return {
        id: tournament.id,
        name: tournament.name,
        start_date: tournament.startDate || '',
        end_date: tournament.endDate || '',
        status: tournament.status,
        category_name: tournament.categoryName || '',
        gender: typeof tournament.gender === 'string' ? tournament.gender : '',
        max_participants: maxParticipants,
        current_inscriptions: currentInscriptions,
        description: '',
        price: tournament.price ?? null,
        is_inscribed: inscribedTournamentIds.has(tournament.id),
        is_full: typeof maxParticipants === 'number' ? currentInscriptions >= maxParticipants : false,
        enable_transfer_proof: tournament.enableTransferProof || false,
        transfer_alias: tournament.transferAlias || null,
        transfer_amount: tournament.transferAmount || null,
        club: {
          name: tournament.club?.name || 'Sin club',
          address: tournament.club?.address || null,
        },
      }
    })

    return { upcomingTournaments }
  } catch (error) {
    console.error('Error getting tenant upcoming tournaments for player panel:', error)
    return {
      upcomingTournaments: [],
      error: 'Error inesperado al obtener torneos proximos',
    }
  }
}

export async function getPlayerDashboardData(userId: string) {
  try {
    const supabase = await createClient()

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select(
        `
        id,
        first_name,
        last_name,
        score,
        category_name,
        profile_image_url,
        clubes (
          name
        )
      `,
      )
      .eq('user_id', userId)
      .single()

    if (playerError) {
      throw playerError
    }

    if (!playerData) {
      return {
        playerData: null,
        playerRanking: null,
        nextMatch: null,
        error: 'Jugador no encontrado',
      }
    }

    const nextMatchResult = await getPlayerNextMatch(playerData.id)

    let playerRanking = null
    if (playerData.score) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .gt('score', playerData.score)
        .not('score', 'is', null)

      const { count: totalCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .not('score', 'is', null)

      playerRanking = {
        position: (count || 0) + 1,
        total: totalCount || 0,
      }
    }

    return {
      playerData,
      playerRanking,
      nextMatches: nextMatchResult.nextMatches,
      error: nextMatchResult.error,
    }
  } catch (error) {
    console.error('Error in getPlayerDashboardData:', error)
    return {
      playerData: null,
      playerRanking: null,
      nextMatches: [],
      error: 'Error al cargar datos del jugador',
    }
  }
}
