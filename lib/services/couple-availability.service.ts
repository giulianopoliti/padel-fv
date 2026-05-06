import { createClient } from '@/utils/supabase/server';

export interface CoupleAvailability {
  coupleId: string;
  currentMatches: number;
  maxMatches: number;
  canPlayMore: boolean;
  reason?: string;
}

export class CoupleAvailabilityService {
  
  /**
   * Obtiene disponibilidad de parejas en una zona específica
   * Usa la lógica inteligente de partidos por pareja según el número de parejas en la zona
   */
  static async getCouplesAvailabilityInZone(
    tournamentId: string,
    zoneId: string
  ): Promise<{
    success: boolean;
    availability?: CoupleAvailability[];
    unavailableCoupleIds?: string[];
    error?: string;
  }> {
    const supabase = await createClient();

    try {
      // 1. Obtener parejas de la zona
      const { data: zoneCouples, error: couplesError } = await supabase
        .from('zone_positions')  // ✅ Cambio: leer de zone_positions
        .select('couple_id')
        .eq('zone_id', zoneId);

      if (couplesError) {
        return {
          success: false,
          error: 'Error al obtener parejas de la zona'
        };
      }

      if (!zoneCouples || zoneCouples.length === 0) {
        return {
          success: true,
          availability: [],
          unavailableCoupleIds: []
        };
      }

      // 2. Determinar máximo de partidos por pareja según el número de parejas
      const totalCouples = zoneCouples.length;
      let maxMatches = 2; // Default
      
      if (totalCouples === 5) {
        maxMatches = 3; // Caso especial: zona de 5 parejas
      } else if (totalCouples === 4) {
        maxMatches = 2; // Caso normal: zona de 4 parejas
      } else if (totalCouples === 3) {
        maxMatches = 2; // Zona pequeña: 3 parejas
      }

      // 3. Contar partidos actuales de cada pareja
      const availability: CoupleAvailability[] = [];
      const unavailableCoupleIds: string[] = [];

      for (const zoneCouple of zoneCouples) {
        const coupleId = zoneCouple.couple_id;

        // Contar partidos de esta pareja en esta zona
        const { data: matches, error: matchError } = await supabase
          .from('matches')
          .select('id')
          .eq('zone_id', zoneId)
          .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`);

        if (matchError) {
          console.error(`Error counting matches for couple ${coupleId}:`, matchError);
          continue;
        }

        const currentMatches = matches?.length || 0;
        const canPlayMore = currentMatches < maxMatches;

        const coupleAvailability: CoupleAvailability = {
          coupleId,
          currentMatches,
          maxMatches,
          canPlayMore,
          reason: canPlayMore 
            ? undefined 
            : `Ya jugó ${currentMatches}/${maxMatches} partidos permitidos`
        };

        availability.push(coupleAvailability);

        if (!canPlayMore) {
          unavailableCoupleIds.push(coupleId);
        }
      }

      return {
        success: true,
        availability,
        unavailableCoupleIds
      };

    } catch (error) {
      console.error('Error in getCouplesAvailabilityInZone:', error);
      return {
        success: false,
        error: 'Error interno al verificar disponibilidad de parejas'
      };
    }
  }

  /**
   * Verifica si una pareja específica puede jugar más partidos en una zona
   */
  static async canCouplePlayMore(
    zoneId: string,
    coupleId: string
  ): Promise<{
    canPlay: boolean;
    currentMatches: number;
    maxMatches: number;
    reason?: string;
  }> {
    const supabase = await createClient();

    try {
      // 1. Contar parejas en la zona
      const { data: zoneCouples } = await supabase
        .from('zone_positions')  // ✅ Cambio: leer de zone_positions
        .select('couple_id')
        .eq('zone_id', zoneId);

      const totalCouples = zoneCouples?.length || 0;
      
      // 2. Determinar máximo de partidos
      let maxMatches = 2;
      if (totalCouples === 5) {
        maxMatches = 3;
      } else if (totalCouples === 4) {
        maxMatches = 2;
      } else if (totalCouples === 3) {
        maxMatches = 2;
      }

      // 3. Contar partidos actuales
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('zone_id', zoneId)
        .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`);

      const currentMatches = matches?.length || 0;
      const canPlay = currentMatches < maxMatches;

      return {
        canPlay,
        currentMatches,
        maxMatches,
        reason: canPlay 
          ? undefined 
          : `Ya jugó ${currentMatches}/${maxMatches} partidos permitidos`
      };

    } catch (error) {
      console.error('Error in canCouplePlayMore:', error);
      return {
        canPlay: false,
        currentMatches: 0,
        maxMatches: 0,
        reason: 'Error al verificar disponibilidad'
      };
    }
  }

  /**
   * Función de compatibilidad que reemplaza getCouplesWithFinishedMatches
   * pero con lógica inteligente
   */
  static async getUnavailableCouplesInZone(
    tournamentId: string,
    zoneId: string
  ): Promise<{
    success: boolean;
    coupleIds?: string[];
    error?: string;
  }> {
    const result = await this.getCouplesAvailabilityInZone(tournamentId, zoneId);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      coupleIds: result.unavailableCoupleIds || []
    };
  }
}