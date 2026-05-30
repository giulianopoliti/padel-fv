import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'
import { createClient } from '@/utils/supabase/server'

export interface CoupleAvailability {
  coupleId: string
  currentMatches: number
  maxMatches: number
  canPlayMore: boolean
  reason?: string
}

export class CoupleAvailabilityService {
  static async getCouplesAvailabilityInZone(
    tournamentId: string,
    zoneId: string
  ): Promise<{
    success: boolean
    availability?: CoupleAvailability[]
    unavailableCoupleIds?: string[]
    error?: string
  }> {
    const supabase = await createClient()

    try {
      const { data: zoneCouples, error: couplesError } = await supabase
        .from('zone_positions')
        .select('couple_id')
        .eq('zone_id', zoneId)

      if (couplesError) {
        return {
          success: false,
          error: 'Error al obtener parejas de la zona',
        }
      }

      if (!zoneCouples || zoneCouples.length === 0) {
        return {
          success: true,
          availability: [],
          unavailableCoupleIds: [],
        }
      }

      const rules = await ZoneMatchRulesService.getRulesForZone(supabase, zoneId)
      const maxMatches = rules.maxMatchesPerCouple
      const availability: CoupleAvailability[] = []
      const unavailableCoupleIds: string[] = []

      for (const zoneCouple of zoneCouples) {
        const coupleId = zoneCouple.couple_id
        const { data: matches, error: matchError } = await supabase
          .from('matches')
          .select('id')
          .eq('zone_id', zoneId)
          .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)

        if (matchError) {
          console.error(`Error counting matches for couple ${coupleId}:`, matchError)
          continue
        }

        const currentMatches = matches?.length || 0
        const canPlayMore = currentMatches < maxMatches

        availability.push({
          coupleId,
          currentMatches,
          maxMatches,
          canPlayMore,
          reason: canPlayMore
            ? undefined
            : `Ya jugo ${currentMatches}/${maxMatches} partidos permitidos`,
        })

        if (!canPlayMore) {
          unavailableCoupleIds.push(coupleId)
        }
      }

      return {
        success: true,
        availability,
        unavailableCoupleIds,
      }
    } catch (error) {
      console.error('Error in getCouplesAvailabilityInZone:', error)
      return {
        success: false,
        error: 'Error interno al verificar disponibilidad de parejas',
      }
    }
  }

  static async canCouplePlayMore(
    zoneId: string,
    coupleId: string
  ): Promise<{
    canPlay: boolean
    currentMatches: number
    maxMatches: number
    reason?: string
  }> {
    const supabase = await createClient()

    try {
      const rules = await ZoneMatchRulesService.getRulesForZone(supabase, zoneId)
      const maxMatches = rules.maxMatchesPerCouple

      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('zone_id', zoneId)
        .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)

      const currentMatches = matches?.length || 0
      const canPlay = currentMatches < maxMatches

      return {
        canPlay,
        currentMatches,
        maxMatches,
        reason: canPlay
          ? undefined
          : `Ya jugo ${currentMatches}/${maxMatches} partidos permitidos`,
      }
    } catch (error) {
      console.error('Error in canCouplePlayMore:', error)
      return {
        canPlay: false,
        currentMatches: 0,
        maxMatches: 0,
        reason: 'Error al verificar disponibilidad',
      }
    }
  }

  static async getUnavailableCouplesInZone(
    tournamentId: string,
    zoneId: string
  ): Promise<{
    success: boolean
    coupleIds?: string[]
    error?: string
  }> {
    const result = await this.getCouplesAvailabilityInZone(tournamentId, zoneId)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      coupleIds: result.unavailableCoupleIds || [],
    }
  }
}
