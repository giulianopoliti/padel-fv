import { createClient } from '@/utils/supabase/server';
import { TournamentFormat } from '@/types';
import { ZoneMatchRulesService } from './zone-match-rules.service';

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
  static async validateNoDuplicateMatch(
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();

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

  static async validateCoupleMatchLimit(
    zoneId: string,
    coupleId: string,
    _formatType?: TournamentFormat
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();

    let maxMatches = 2;
    try {
      const rules = await ZoneMatchRulesService.getRulesForZone(supabase, zoneId);
      maxMatches = rules.maxMatchesPerCouple;
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'zone',
          message: error instanceof Error ? error.message : 'Error al resolver reglas de zona',
          code: 'ZONE_RULES_ERROR'
        }]
      };
    }

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

    const warnings: string[] = [];
    if (currentMatches === maxMatches - 1) {
      warnings.push(`Esta pareja jugará su último partido en esta zona (${currentMatches + 1}/${maxMatches})`);
    }

    return {
      isValid: true,
      errors: [],
      warnings
    };
  }

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

  static async validateCouplesInZone(
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const supabase = await createClient();

    const { data: zoneAssignments, error } = await supabase
      .from('zone_positions')
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

    const foundCouples = zoneAssignments?.map((z) => z.couple_id) || [];

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

  static async validateMatchCreation(
    zoneId: string,
    couple1Id: string,
    couple2Id: string
  ): Promise<MatchValidationResult> {
    const errors: MatchValidationError[] = [];
    const warnings: string[] = [];

    const differentCouplesResult = this.validateDifferentCouples(couple1Id, couple2Id);
    if (!differentCouplesResult.isValid) {
      errors.push(...differentCouplesResult.errors);
    }

    const couplesInZoneResult = await this.validateCouplesInZone(zoneId, couple1Id, couple2Id);
    if (!couplesInZoneResult.isValid) {
      errors.push(...couplesInZoneResult.errors);
    }

    const noDuplicateResult = await this.validateNoDuplicateMatch(zoneId, couple1Id, couple2Id);
    if (!noDuplicateResult.isValid) {
      errors.push(...noDuplicateResult.errors);
    }

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

    let maxMatches = 2;
    try {
      const rules = await ZoneMatchRulesService.getRulesForZone(supabase, zoneId);
      maxMatches = rules.maxMatchesPerCouple;
    } catch (rulesError) {
      console.warn('[MatchValidationService] Could not resolve zone match rules:', rulesError);
    }

    const total = matches?.length || 0;
    const completed = matches?.filter((m) => m.status === 'FINISHED').length || 0;
    const pending = matches?.filter((m) => m.status === 'PENDING').length || 0;
    const inProgress = matches?.filter((m) => m.status === 'IN_PROGRESS').length || 0;

    return {
      total,
      completed,
      pending,
      inProgress,
      remainingMatches: Math.max(0, maxMatches - total)
    };
  }
}
