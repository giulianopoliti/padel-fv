import { createClientServiceRole } from '@/utils/supabase/server'

const LONG_GENERAL_ZONE_NAME = 'Zona General'
const DEFAULT_LONG_ZONE_CAPACITY = 32

type ManagedZone = {
  id: string
  tournament_id: string
  name: string | null
  created_at?: string | null
}

export type EnsureLongTournamentGeneralZoneResult = {
  success: boolean
  zoneId?: string
  zone?: ManagedZone
  created?: boolean
  warning?: string
  error?: string
}

const pickPreferredZone = (zones: ManagedZone[]): ManagedZone | null => {
  if (zones.length === 0) return null
  return zones.find((zone) => zone.name === LONG_GENERAL_ZONE_NAME) ?? zones[0]
}

export async function ensureLongTournamentGeneralZone(
  tournamentId: string
): Promise<EnsureLongTournamentGeneralZoneResult> {
  try {
    const supabase = await createClientServiceRole()

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, type, max_participants')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      console.error('[ensureLongTournamentGeneralZone] Tournament not found:', {
        tournamentId,
        tournamentError,
      })
      return { success: false, error: 'No se encontró el torneo.' }
    }

    if (tournament.type !== 'LONG') {
      return {
        success: false,
        error: 'La zona general solo aplica a torneos LONG.',
      }
    }

    const { data: existingZones, error: zonesError } = await supabase
      .from('zones')
      .select('id, tournament_id, name, created_at')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true })

    if (zonesError) {
      console.error('[ensureLongTournamentGeneralZone] Error fetching zones:', {
        tournamentId,
        zonesError,
      })
      return { success: false, error: 'No se pudieron consultar las zonas del torneo.' }
    }

    const preferredExistingZone = pickPreferredZone((existingZones ?? []) as ManagedZone[])
    if (preferredExistingZone) {
      const warning =
        (existingZones?.length ?? 0) > 1
          ? `Se encontraron ${existingZones?.length} zonas para el torneo LONG ${tournamentId}. Se reutilizará ${preferredExistingZone.id}.`
          : undefined

      if (warning) {
        console.warn('[ensureLongTournamentGeneralZone] Multiple zones detected:', {
          tournamentId,
          zoneIds: existingZones?.map((zone) => zone.id),
          preferredZoneId: preferredExistingZone.id,
        })
      }

      return {
        success: true,
        zoneId: preferredExistingZone.id,
        zone: preferredExistingZone,
        created: false,
        warning,
      }
    }

    const targetCapacity = tournament.max_participants || DEFAULT_LONG_ZONE_CAPACITY
    const { data: createdZone, error: createZoneError } = await supabase
      .from('zones')
      .insert({
        tournament_id: tournamentId,
        name: LONG_GENERAL_ZONE_NAME,
        max_couples: targetCapacity,
        capacity: targetCapacity,
      })
      .select('id, tournament_id, name, created_at')
      .single()

    if (createZoneError || !createdZone) {
      console.error('[ensureLongTournamentGeneralZone] Error creating general zone:', {
        tournamentId,
        createZoneError,
      })

      const { data: fallbackZones, error: fallbackZonesError } = await supabase
        .from('zones')
        .select('id, tournament_id, name, created_at')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true })

      if (!fallbackZonesError) {
        const recoveredZone = pickPreferredZone((fallbackZones ?? []) as ManagedZone[])
        if (recoveredZone) {
          console.warn('[ensureLongTournamentGeneralZone] Recovered existing zone after failed insert:', {
            tournamentId,
            recoveredZoneId: recoveredZone.id,
          })

          return {
            success: true,
            zoneId: recoveredZone.id,
            zone: recoveredZone,
            created: false,
            warning: 'La zona general ya existía y se reutilizó tras reintentar la operación.',
          }
        }
      }

      return {
        success: false,
        error: createZoneError?.message || 'No se pudo crear la zona general del torneo.',
      }
    }

    console.log('[ensureLongTournamentGeneralZone] General zone ensured for LONG tournament:', {
      tournamentId,
      zoneId: createdZone.id,
    })

    return {
      success: true,
      zoneId: createdZone.id,
      zone: createdZone as ManagedZone,
      created: true,
    }
  } catch (error) {
    console.error('[ensureLongTournamentGeneralZone] Unexpected error:', {
      tournamentId,
      error,
    })
    return {
      success: false,
      error: 'Error interno asegurando la zona general del torneo.',
    }
  }
}
