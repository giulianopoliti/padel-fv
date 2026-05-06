import { createClient } from '@/utils/supabase/server';
import { TournamentFormat } from '@/types';
import { TournamentFormatDetector } from './tournament-format-detector.service';

export interface MatchValidationError {
  field: string;
  message: string;
  code: string;
}

export interface MatchValidationResult {
  isValid: boolean;
  errors: MatchValidationError[];
  warnings?: string[];
}

export class MatchValidationService {
  
  /**
   * Valida que no exista un partido duplicado entre las mismas parejas en la zona
   */
  static async validateNoDuplicateMatch(
    zoneId: string, 
    couple1Id: string, 
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();
    
    // Buscar partidos existentes entre estas parejas (en cualquier orden)
    const { data: existingMatches, error } = await supabase
      .from('matches')
      .select('id')
      .eq('zone_id', zoneId)
      .or(`and(couple1_id.eq.${couple1Id},couple2_id.eq.${couple2Id}),and(couple1_id.eq.${couple2Id},couple2_id.eq.${couple1Id})`);

    if (error) {
      return {
        isValid: false,
        errors: [{
          field: 'database',
          message: 'Error al verificar partidos existentes',
          code: 'DATABASE_ERROR'
        }]
      };
    }

    if (existingMatches && existingMatches.length > 0) {
      return {
        isValid: false,
        errors: [{
          field: 'couples',
          message: 'Estas parejas ya tienen un partido creado en esta zona',
          code: 'DUPLICATE_MATCH'
        }]
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Valida que una pareja no exceda el límite de partidos permitidos según el formato
   */
  static async validateCoupleMatchLimit(
    zoneId: string, 
    coupleId: string, 
    formatType?: TournamentFormat
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();

    // 1. Obtener información de la zona y contar parejas para determinar formato
    const { data: zoneData, error: zoneError } = await supabase
      .from('zones')
      .select(`
        id,
        tournament_id,
        name
      `)
      .eq('id', zoneId)
      .single();

    if (zoneError || !zoneData) {
      return {
        isValid: false,
        errors: [{
          field: 'zone',
          message: 'Zona no encontrada',
          code: 'ZONE_NOT_FOUND'
        }]
      };
    }

    // 2. Contar parejas en la zona para determinar el formato
    const { data: zoneCouples, error: couplesError } = await supabase
      .from('zone_positions')  // ✅ Cambio: leer de zone_positions
      .select('couple_id')
      .eq('zone_id', zoneId);

    if (couplesError) {
      return {
        isValid: false,
        errors: [{
          field: 'zone',
          message: 'Error al obtener parejas de la zona',
          code: 'ZONE_COUPLES_ERROR'
        }]
      };
    }

    // 3. Determinar límite de partidos basado en número de parejas
    const coupleCount = zoneCouples?.length || 0;
    let maxMatches = 2; // Default para AMERICAN_2
    
    // Lógica: 
    // - 4 parejas → 2 partidos por pareja (AMERICAN_2)
    // - 5 parejas → 3 partidos por pareja (caso especial)
    if (coupleCount === 5) {
      maxMatches = 3;
    } else if (coupleCount === 4) {
      maxMatches = 2;
    } else if (coupleCount === 3) {
      maxMatches = 2; // Con 3 parejas, cada una juega 2 partidos
    }

    // 4. Contar partidos existentes de la pareja en esta zona
    const { data: existingMatches, error: matchError } = await supabase
      .from('matches')
      .select('id')
      .eq('zone_id', zoneId)
      .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`);

    if (matchError) {
      return {
        isValid: false,
        errors: [{
          field: 'database',
          message: 'Error al verificar partidos de la pareja',
          code: 'DATABASE_ERROR'
        }]
      };
    }

    const currentMatches = existingMatches?.length || 0;

    if (currentMatches >= maxMatches) {
      return {
        isValid: false,
        errors: [{
          field: 'couple_limit',
          message: `Esta pareja ya jugó ${currentMatches}/${maxMatches} partidos permitidos en esta zona`,
          code: 'COUPLE_MATCH_LIMIT_EXCEEDED'
        }]
      };
    }

    // Advertencia si está cerca del límite
    const warnings = [];
    if (currentMatches === maxMatches - 1) {
      warnings.push(`Esta pareja jugará su último partido en esta zona (${currentMatches + 1}/${maxMatches})`);
    }

    return { 
      isValid: true, 
      errors: [],
      warnings 
    };
  }

  /**
   * Valida que las parejas sean diferentes (no puede jugar contra sí misma)
   */
  static validateDifferentCouples(couple1Id: string, couple2Id: string): MatchValidationResult {
    if (couple1Id === couple2Id) {
      return {
        isValid: false,
        errors: [{
          field: 'couples',
          message: 'Una pareja no puede jugar contra sí misma',
          code: 'SAME_COUPLE'
        }]
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Valida que ambas parejas pertenezcan a la zona
   */
  static async validateCouplesInZone(
    zoneId: string, 
    couple1Id: string, 
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();

    const { data: zoneAssignments, error } = await supabase
      .from('zone_positions')  // ✅ Cambio: leer de zone_positions
      .select('couple_id')
      .eq('zone_id', zoneId)
      .in('couple_id', [couple1Id, couple2Id]);

    if (error) {
      return {
        isValid: false,
        errors: [{
          field: 'database',
          message: 'Error al verificar parejas en zona',
          code: 'DATABASE_ERROR'
        }]
      };
    }

    const foundCouples = zoneAssignments?.map(z => z.couple_id) || [];
    
    if (!foundCouples.includes(couple1Id)) {
      return {
        isValid: false,
        errors: [{
          field: 'couple1',
          message: 'La primera pareja no pertenece a esta zona',
          code: 'COUPLE_NOT_IN_ZONE'
        }]
      };
    }

    if (!foundCouples.includes(couple2Id)) {
      return {
        isValid: false,
        errors: [{
          field: 'couple2',
          message: 'La segunda pareja no pertenece a esta zona',
          code: 'COUPLE_NOT_IN_ZONE'
        }]
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validación completa antes de crear un partido
   */
  static async validateMatchCreation(
    zoneId: string, 
    couple1Id: string, 
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const errors: MatchValidationError[] = [];
    const warnings: string[] = [];

    // 1. Validar que las parejas sean diferentes
    const differentCouplesResult = this.validateDifferentCouples(couple1Id, couple2Id);
    if (!differentCouplesResult.isValid) {
      errors.push(...differentCouplesResult.errors);
    }

    // 2. Validar que las parejas pertenezcan a la zona
    const couplesInZoneResult = await this.validateCouplesInZone(zoneId, couple1Id, couple2Id);
    if (!couplesInZoneResult.isValid) {
      errors.push(...couplesInZoneResult.errors);
    }

    // 3. Validar que no sea un partido duplicado
    const noDuplicateResult = await this.validateNoDuplicateMatch(zoneId, couple1Id, couple2Id);
    if (!noDuplicateResult.isValid) {
      errors.push(...noDuplicateResult.errors);
    }

    // 4. Validar límites de partidos por pareja
    const couple1LimitResult = await this.validateCoupleMatchLimit(zoneId, couple1Id);
    if (!couple1LimitResult.isValid) {
      errors.push(...couple1LimitResult.errors);
    } else if (couple1LimitResult.warnings) {
      warnings.push(...couple1LimitResult.warnings);
    }

    const couple2LimitResult = await this.validateCoupleMatchLimit(zoneId, couple2Id);
    if (!couple2LimitResult.isValid) {
      errors.push(...couple2LimitResult.errors);
    } else if (couple2LimitResult.warnings) {
      warnings.push(...couple2LimitResult.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Obtiene estadísticas de partidos para una pareja en una zona
   */
  static async getCoupleMatchStats(zoneId: string, coupleId: string) {
    const supabase = await createClient();

    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, status')
      .eq('zone_id', zoneId)
      .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`);

    if (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }

    const total = matches?.length || 0;
    const completed = matches?.filter(m => m.status === 'FINISHED').length || 0;
    const pending = matches?.filter(m => m.status === 'PENDING').length || 0;
    const inProgress = matches?.filter(m => m.status === 'IN_PROGRESS').length || 0;

    return {
      total,
      completed,
      pending,
      inProgress,
      remainingMatches: Math.max(0, 2 - total) // Default 2, will be updated based on format
    };
  }
}