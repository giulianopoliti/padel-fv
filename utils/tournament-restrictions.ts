import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/database.types'

type TournamentStatus = Database['public']['Enums']['status_tournament']

export interface RestrictionResult {
  allowed: boolean
  reason?: string
  details?: string
}

/**
 * Verificar si una pareja puede ser movida de una zona
 */
export async function validateCoupleMovement(
  tournamentId: string,
  coupleId: string,
  fromZoneId?: string
): Promise<RestrictionResult> {
  const supabase = await createClient()

  // 1. Verificar estado del torneo
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status, bracket_generated_at')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    return { allowed: false, reason: 'Tournament not found' }
  }

  // 2. Solo permitir movimiento en ZONE_PHASE y NOT_STARTED
  if (!['ZONE_PHASE', 'NOT_STARTED'].includes(tournament.status as string)) {
    return { 
      allowed: false, 
      reason: 'Cannot move couples outside zone phase',
      details: `Tournament is in ${tournament.status} phase`
    }
  }

  // 3. Si estamos en ZONE_PHASE, verificar si jugó partidos
  if (tournament.status === 'ZONE_PHASE') {
    const { data: hasPlayedMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('round', 'ZONE')
      .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`)
      .neq('status', 'PENDING')
      .limit(1)

    if (hasPlayedMatches && hasPlayedMatches.length > 0) {
      return {
        allowed: false,
        reason: 'Couple has played matches in zone',
        details: 'Cannot move couples that have already played zone matches'
      }
    }
  }

  return { allowed: true }
}

/**
 * Verificar si se pueden registrar parejas nuevas
 * UPDATED: Now uses unified validation system
 */
export async function validateLateRegistration(tournamentId: string): Promise<RestrictionResult> {
  try {
    // Use the new unified validation service
    const { TournamentValidationService } = await import('../lib/services/tournament-validation.service');
    const result = await TournamentValidationService.validateCoupleRegistration(tournamentId);
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      details: result.details
    };
    
  } catch (error: any) {
    console.error('[validateLateRegistration] Error importing unified service, using fallback:', error);
    
    // Fallback to direct validation
    const supabase = await createClient()

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, bracket_generated_at, registration_locked')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return { allowed: false, reason: 'Tournament not found' }
    }
    
    // NEW SYSTEM LOGIC: Check simplified states first
    if (tournament.status === 'ZONE_PHASE') {
      return { 
        allowed: true, 
        reason: 'Late registration allowed during zone phase',
        details: 'Couples will be added to unassigned pool'
      }
    }
    
    if (tournament.status === 'BRACKET_PHASE') {
      return { 
        allowed: false, 
        reason: 'Registration closed - tournament in bracket phase' 
      }
    }
    
    // LEGACY SYSTEM COMPATIBILITY
    if (tournament.registration_locked) {
      return { 
        allowed: false, 
        reason: 'Registration locked by organizer' 
      }
    }

    // Permitir registro solo en NOT_STARTED y ZONE_PHASE
    const allowedStates = ['NOT_STARTED', 'ZONE_PHASE']
    if (!allowedStates.includes(tournament.status as string)) {
      return {
        allowed: false,
        reason: 'Registration closed',
        details: `Cannot register new couples in ${tournament.status} phase`
      }
    }

    // Si hay bracket generado, no permitir más inscripciones
    if (tournament.bracket_generated_at) {
      return {
        allowed: false,
        reason: 'Bracket already generated',
        details: 'Cannot add new couples after bracket generation'
      }
    }

    return { allowed: true, reason: 'Registration allowed' }
  }
}

/**
 * Verificar qué acciones están disponibles según el estado del torneo
 */
export async function getTournamentCapabilities(tournamentId: string) {
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status, bracket_generated_at')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    return null
  }

  const status = tournament.status as TournamentStatus
  
  return {
    canRegisterCouples: ['NOT_STARTED', 'ZONE_PHASE'].includes(status) && !tournament.bracket_generated_at,
    canMoveCouples: ['NOT_STARTED', 'ZONE_PHASE'].includes(status),
    canDeleteCouples: status === 'NOT_STARTED',
    canGenerateBracket: status === 'ZONE_PHASE',
    canModifyZones: ['NOT_STARTED', 'ZONE_PHASE'].includes(status),
    canStartTournament: status === 'NOT_STARTED',
    phase: status
  }
}