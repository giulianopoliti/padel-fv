/**
 * 🎾 REGISTRATION STRATEGY INTERFACE
 * 
 * Interface principal para el patrón Strategy de inscripciones.
 * Define el contrato que deben cumplir todas las estrategias de registro.
 */

import type {
  RegisterCoupleRequest,
  RegisterNewPlayersRequest,
  RegisterIndividualRequest,
  RegisterAuthenticatedPlayerRequest,
  RemoveCoupleRequest,
  CoupleRegistrationResult,
  PlayerRegistrationResult,
  RemovalResult,
  RegistrationContext,
  TournamentType
} from './types/registration-types'

export interface IRegistrationStrategy {
  /**
   * Tipo de torneo que maneja esta estrategia
   */
  readonly tournamentType: TournamentType
  
  // ===== MÉTODOS PRINCIPALES =====
  
  /**
   * Registra una pareja existente (ambos jugadores ya están en la BD)
   * 
   * @param request - Datos de la pareja a registrar
   * @param context - Contexto del torneo y usuario
   * @returns Resultado del registro con detalles específicos del tipo de torneo
   */
  registerCouple(
    request: RegisterCoupleRequest,
    context: RegistrationContext
  ): Promise<CoupleRegistrationResult>
  
  /**
   * Registra una pareja creando ambos jugadores nuevos
   * 
   * @param request - Datos de los jugadores a crear y registrar
   * @param context - Contexto del torneo y usuario
   * @returns Resultado del registro con IDs de jugadores creados
   */
  registerNewPlayersAsCouple(
    request: RegisterNewPlayersRequest,
    context: RegistrationContext
  ): Promise<CoupleRegistrationResult>
  
  /**
   * Registra un jugador individual (luego será emparejado)
   * 
   * @param request - Datos del jugador individual
   * @param context - Contexto del torneo y usuario
   * @returns Resultado del registro individual
   */
  registerIndividualPlayer(
    request: RegisterIndividualRequest,
    context: RegistrationContext
  ): Promise<PlayerRegistrationResult>
  
  /**
   * Registra un jugador autenticado (logueado)
   * 
   * @param request - Datos del jugador autenticado
   * @param context - Contexto del torneo y usuario
   * @returns Resultado del registro
   */
  registerAuthenticatedPlayer(
    request: RegisterAuthenticatedPlayerRequest,
    context: RegistrationContext
  ): Promise<PlayerRegistrationResult>
  
  /**
   * Convierte una inscripción individual en pareja
   * 
   * @param request - Datos de la nueva pareja
   * @param context - Contexto del torneo y usuario
   * @returns Resultado de la conversión
   */
  convertIndividualToCouple(
    request: RegisterCoupleRequest,
    context: RegistrationContext
  ): Promise<CoupleRegistrationResult>
  
  /**
   * Elimina una pareja del torneo
   * 
   * @param request - Datos de la pareja a eliminar
   * @param context - Contexto del torneo y usuario
   * @returns Resultado de la eliminación
   */
  removeCouple(
    request: RemoveCoupleRequest,
    context: RegistrationContext
  ): Promise<RemovalResult>
  
  // ===== MÉTODOS DE VALIDACIÓN =====
  
  /**
   * Valida si se puede registrar una pareja en este tipo de torneo
   * 
   * @param request - Datos de la pareja
   * @param context - Contexto del torneo
   * @returns Resultado de la validación
   */
  validateCoupleRegistration(
    request: RegisterCoupleRequest,
    context: RegistrationContext
  ): Promise<{ isValid: boolean; error?: string }>
  
  /**
   * Valida si se puede eliminar una pareja de este tipo de torneo
   * 
   * @param request - Datos de la pareja a eliminar
   * @param context - Contexto del torneo
   * @returns Resultado de la validación
   */
  validateCoupleRemoval(
    request: RemoveCoupleRequest,
    context: RegistrationContext
  ): Promise<{ isValid: boolean; error?: string }>
  
  // ===== MÉTODOS ESPECÍFICOS DEL TIPO DE TORNEO =====
  
  /**
   * Acciones post-registro específicas del tipo de torneo
   * Por ejemplo: asignar a zonas, calcular seeding, etc.
   * 
   * @param coupleId - ID de la pareja registrada
   * @param context - Contexto del torneo
   * @returns Resultado de las acciones post-registro
   */
  executePostRegistrationActions(
    coupleId: string,
    context: RegistrationContext
  ): Promise<{ success: boolean; details?: any }>
  
  /**
   * Acciones pre-eliminación específicas del tipo de torneo
   * Por ejemplo: remover de zonas, actualizar rankings, etc.
   * 
   * @param coupleId - ID de la pareja a eliminar
   * @param context - Contexto del torneo
   * @returns Resultado de las acciones pre-eliminación
   */
  executePreRemovalActions(
    coupleId: string,
    context: RegistrationContext
  ): Promise<{ success: boolean; details?: any }>
}

/**
 * Clase base abstracta que implementa validaciones comunes
 * Las estrategias específicas pueden extender esta clase
 */
export abstract class BaseRegistrationStrategy implements IRegistrationStrategy {
  abstract readonly tournamentType: TournamentType
  
  // Métodos abstractos que deben implementar las estrategias específicas
  abstract registerCouple(request: RegisterCoupleRequest, context: RegistrationContext): Promise<CoupleRegistrationResult>
  abstract registerNewPlayersAsCouple(request: RegisterNewPlayersRequest, context: RegistrationContext): Promise<CoupleRegistrationResult>
  abstract registerIndividualPlayer(request: RegisterIndividualRequest, context: RegistrationContext): Promise<PlayerRegistrationResult>
  abstract registerAuthenticatedPlayer(request: RegisterAuthenticatedPlayerRequest, context: RegistrationContext): Promise<PlayerRegistrationResult>
  abstract convertIndividualToCouple(request: RegisterCoupleRequest, context: RegistrationContext): Promise<CoupleRegistrationResult>
  abstract removeCouple(request: RemoveCoupleRequest, context: RegistrationContext): Promise<RemovalResult>
  abstract executePostRegistrationActions(coupleId: string, context: RegistrationContext): Promise<{ success: boolean; details?: any }>
  abstract executePreRemovalActions(coupleId: string, context: RegistrationContext): Promise<{ success: boolean; details?: any }>
  
  // Implementaciones por defecto de validaciones (pueden ser sobrescribitas)
  async validateCoupleRegistration(request: RegisterCoupleRequest, context: RegistrationContext): Promise<{ isValid: boolean; error?: string }> {
    // Validaciones básicas comunes a todos los tipos de torneo
    if (!request.player1Id || !request.player2Id) {
      return { isValid: false, error: 'IDs de jugadores son requeridos' }
    }

    if (request.player1Id === request.player2Id) {
      return { isValid: false, error: 'Un jugador no puede formar pareja consigo mismo' }
    }

    // ✅ VALIDACIÓN CRÍTICA: Verificar estado del torneo y registration_locked
    try {
      const { TournamentValidationService } = await import('../tournament-validation.service')
      const tournamentValidation = await TournamentValidationService.validateCoupleRegistration(context.tournament.id)

      if (!tournamentValidation.allowed) {
        return {
          isValid: false,
          error: `${tournamentValidation.reason}${tournamentValidation.details ? ` - ${tournamentValidation.details}` : ''}`
        }
      }

      console.log(`[BaseRegistrationStrategy] Tournament validation passed for ${context.tournament.id} using ${tournamentValidation.system} system`)

    } catch (error) {
      console.error('[BaseRegistrationStrategy] Error in tournament validation:', error)
      return { isValid: false, error: 'Error verificando estado del torneo' }
    }

    return { isValid: true }
  }
  
  async validateCoupleRemoval(request: RemoveCoupleRequest, context: RegistrationContext): Promise<{ isValid: boolean; error?: string }> {
    // Validaciones básicas comunes a todos los tipos de torneo
    if (!request.coupleId) {
      return { isValid: false, error: 'ID de pareja es requerido' }
    }
    
    return { isValid: true }
  }
}