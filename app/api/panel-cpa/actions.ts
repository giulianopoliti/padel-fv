'use server'

import { createClient } from '@/utils/supabase/server'

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
  max_participants: number
  current_inscriptions: number
  description: string
  price: number
  is_inscribed: boolean
  is_full: boolean
  club: {
    name: string
    address: string | null
  }
}

export type UpcomingTournamentsResult = {
  upcomingTournaments: UpcomingTournament[]
  error?: string
}

// 🚀 NUEVA: Llama a Edge Function optimizada
export async function getPlayerNextMatch(playerId: string): Promise<PlayerNextMatchResult> {
  try {
    const supabase = await createClient()
    
    // Método nativo de Supabase para Edge Functions
    const { data, error } = await supabase.functions.invoke('get-player-next-match', {
      body: { playerId }
    })

    if (error) {
      console.error('Edge function error:', error)
      return { nextMatches: [], error: 'Error al obtener próximos partidos' }
    }

    return data as PlayerNextMatchResult

  } catch (error) {
    console.error('Error calling edge function:', error)
    return { 
      nextMatches: [], 
      error: 'Error inesperado al obtener próximos partidos' 
    }
  }
}

// 🚀 NUEVA: Edge Function para torneos inscritos del jugador
export async function getPlayerInscribedTournaments(playerId: string): Promise<InscribedTournamentsResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.functions.invoke('get-player-inscribed-tournaments', {
      body: { playerId }
    })

    if (error) {
      console.error('Edge function error:', error)
      return {
        inscribedTournaments: [],
        error: 'Error al obtener torneos inscritos'
      }
    }

    return data as InscribedTournamentsResult

  } catch (error) {
    console.error('Error calling edge function:', error)
    return {
      inscribedTournaments: [],
      error: 'Error inesperado al obtener torneos inscritos'
    }
  }
}

// 🚀 NUEVA: Edge Function para próximos torneos disponibles
export async function getPlayerUpcomingTournaments(
  playerId: string,
  categoryName?: string
): Promise<UpcomingTournamentsResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.functions.invoke('get-player-upcoming-tournaments', {
      body: { playerId, categoryName }
    })

    if (error) {
      console.error('Edge function error:', error)
      return {
        upcomingTournaments: [],
        error: 'Error al obtener torneos próximos'
      }
    }

    return data as UpcomingTournamentsResult

  } catch (error) {
    console.error('Error calling edge function:', error)
    return {
      upcomingTournaments: [],
      error: 'Error inesperado al obtener torneos próximos'
    }
  }
}

export async function getPlayerDashboardData(userId: string) {
  try {
    const supabase = await createClient()

    // Get player data with club information
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select(`
        id,
        first_name,
        last_name,
        score,
        category_name,
        profile_image_url,
        clubes (
          name
        )
      `)
      .eq("user_id", userId)
      .single()

    if (playerError) {
      throw playerError
    }

    if (!playerData) {
      return { 
        playerData: null, 
        playerRanking: null, 
        nextMatch: null,
        error: 'Jugador no encontrado'
      }
    }

    // Get next matches using the optimized function
    const nextMatchResult = await getPlayerNextMatch(playerData.id)

    // Get player ranking position (if has score)
    let playerRanking = null
    if (playerData.score) {
      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .gt("score", playerData.score)
        .not("score", "is", null)
      
      const { count: totalCount } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .not("score", "is", null)
      
      playerRanking = {
        position: (count || 0) + 1,
        total: totalCount || 0
      }
    }

    return {
      playerData,
      playerRanking,
      nextMatches: nextMatchResult.nextMatches,
      error: nextMatchResult.error
    }

  } catch (error) {
    console.error('Error in getPlayerDashboardData:', error)
    return { 
      playerData: null, 
      playerRanking: null, 
      nextMatches: [],
      error: 'Error al cargar datos del jugador' 
    }
  }
}