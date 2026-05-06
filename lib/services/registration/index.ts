/**
 * 🎾 REGISTRATION SERVICE - INDEX
 * 
 * Punto de entrada principal para el sistema de inscripciones.
 * Exporta todas las interfaces y servicios necesarios para el uso externo.
 */

// ===== SERVICIO PRINCIPAL =====
export { getRegistrationService, resetRegistrationService } from './registration.service'

// ===== IMPORTACIÓN INTERNA PARA FUNCIONES HELPER =====
import { getRegistrationService } from './registration.service'

// ===== TIPOS E INTERFACES =====
export type {
  // Tipos base
  TournamentType,
  Gender,
  RegistrationType,
  
  // Interfaces de entidades
  Player,
  Couple,
  Inscription,
  Zone,
  ZoneCouple,
  Tournament,
  
  // Request types
  RegisterCoupleRequest,
  RegisterNewPlayersRequest,
  RegisterIndividualRequest,
  RegisterAuthenticatedPlayerRequest,
  RemoveCoupleRequest,
  
  // Result types
  RegistrationResult,
  PlayerRegistrationResult,
  CoupleRegistrationResult,
  RemovalResult,
  
  // Context types
  RegistrationContext,
  ValidationResult,
  PlayerValidationResult,
  TournamentValidationResult
} from './types/registration-types'

// ===== INTERFACES DE ESTRATEGIA (para extensibilidad) =====
export type { IRegistrationStrategy } from './registration-strategy.interface'
export { BaseRegistrationStrategy } from './registration-strategy.interface'

// ===== FACTORY Y UTILIDADES =====
export {
  createRegistrationStrategy,
  createRegistrationStrategyFromString,
  isValidTournamentType,
  clearStrategyCache,
  getStrategyCacheStats,
  getAvailableStrategies,
  isValidStrategy,
  RegistrationStrategyError
} from './registration-strategy.factory'

// ===== ESTRATEGIAS ESPECÍFICAS (para casos avanzados) =====
export { AmericanTournamentStrategy } from './american-tournament-strategy'
export { LongTournamentStrategy } from './long-tournament-strategy'

// ===== RE-EXPORTACIONES PARA CONVENIENCIA =====

/**
 * Función helper para uso rápido del servicio
 * 
 * @example
 * ```typescript
 * import { registerCouple } from '@/lib/services/registration'
 * 
 * const result = await registerCouple({
 *   tournamentId: 'abc123',
 *   player1Id: 'player1',
 *   player2Id: 'player2'
 * })
 * ```
 */
export async function registerCouple(request: import('./types/registration-types').RegisterCoupleRequest) {
  const service = getRegistrationService()
  return await service.registerCouple(request)
}

/**
 * Función helper para registrar jugadores nuevos como pareja
 */
export async function registerNewPlayersAsCouple(request: import('./types/registration-types').RegisterNewPlayersRequest) {
  const service = getRegistrationService()
  return await service.registerNewPlayersAsCouple(request)
}

/**
 * Función helper para registrar jugador individual
 */
export async function registerIndividualPlayer(request: import('./types/registration-types').RegisterIndividualRequest) {
  const service = getRegistrationService()
  return await service.registerIndividualPlayer(request)
}

/**
 * Función helper para registrar jugador autenticado
 */
export async function registerAuthenticatedPlayer(request: import('./types/registration-types').RegisterAuthenticatedPlayerRequest) {
  const service = getRegistrationService()
  return await service.registerAuthenticatedPlayer(request)
}

/**
 * Función helper para convertir individual a pareja
 */
export async function convertIndividualToCouple(request: import('./types/registration-types').RegisterCoupleRequest) {
  const service = getRegistrationService()
  return await service.convertIndividualToCouple(request)
}

/**
 * Función helper para eliminar pareja
 */
export async function removeCouple(request: import('./types/registration-types').RemoveCoupleRequest) {
  const service = getRegistrationService()
  return await service.removeCouple(request)
}

// ===== CONSTANTES ÚTILES =====

/**
 * Tipos de torneo soportados
 */
export const TOURNAMENT_TYPES = ['AMERICAN', 'LONG'] as const

/**
 * Géneros soportados
 */
export const GENDERS = ['MALE', 'FEMALE', 'MIXED'] as const

/**
 * Tipos de registro soportados
 */
export const REGISTRATION_TYPES = ['individual', 'couple'] as const