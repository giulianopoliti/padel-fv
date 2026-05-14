import { createClient } from '@/utils/supabase/client'

export async function getTournamentOrganizadorInfo(tournamentId: string) {
  try {
    const supabase = createClient()

    const { data: tournamentData, error } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        organization_id,
        organizaciones:organization_id (
          id,
          name,
          description
        )
      `)
      .eq('id', tournamentId)
      .single()

    if (error) {
      console.error('[getTournamentOrganizadorInfo] Error:', error)
      return null
    }

    return tournamentData
  } catch (error) {
    console.error('[getTournamentOrganizadorInfo] Error inesperado:', error)
    return null
  }
}
