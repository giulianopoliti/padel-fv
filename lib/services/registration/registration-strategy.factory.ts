/**
 * 🎾 REGISTRATION STRATEGY FACTORY
 * 
 * Factory que selecciona la estrategia de registro apropiada
 * según el tipo de torneo.
 * 
 * Patrón Factory Method que permite:
 * - Extensibilidad: Fácil agregar nuevos tipos de torneo
 * - Centralización: Una sola función de selección
 * - Type Safety: Validación de tipos en tiempo de compilación
 */

import type { IRegistrationStrategy } from './registration-strategy.interface'
import type { TournamentType } from './types/registration-types'
import { AmericanTournamentStrategy } from './american-tournament-strategy'
import { LongTournamentStrategy } from './long-tournament-strategy'

/**
 * Cache de instancias de estrategias para evitar crear múltiples instancias
 * Patrón Singleton ligero por tipo de estrategia
 */
const strategyCache = new Map<TournamentType, IRegistrationStrategy>()

/**
 * Factory principal que retorna la estrategia apropiada
 * 
 * @param tournamentType - Tipo de torneo ('AMERICAN' | 'LONG')
 * @returns Instancia de la estrategia correspondiente
 * @throws Error si el tipo de torneo no es soportado
 */
export function createRegistrationStrategy(tournamentType: TournamentType): IRegistrationStrategy {
  console.log(`[StrategyFactory] Creando estrategia para torneo tipo: ${tournamentType}`)

  // Verificar cache primero (evitar crear múltiples instancias)
  const cachedStrategy = strategyCache.get(tournamentType)
  if (cachedStrategy) {
    console.log(`[StrategyFactory] Usando estrategia desde cache: ${tournamentType}`)
    return cachedStrategy
  }

  // Crear nueva instancia según el tipo
  let strategy: IRegistrationStrategy

  switch (tournamentType) {
    case 'AMERICAN':
      strategy = new AmericanTournamentStrategy()
      console.log(`[StrategyFactory] ✅ Estrategia American creada`)
      break

    case 'LONG':
      strategy = new LongTournamentStrategy()
      console.log(`[StrategyFactory] ✅ Estrategia Long creada`)
      break

    default:
      // Manejo exhaustivo de tipos para futuras extensiones
      const exhaustiveCheck: never = tournamentType
      throw new RegistrationStrategyError(
        `UNSUPPORTED_TOURNAMENT_TYPE`,
        `Tipo de torneo no soportado: ${exhaustiveCheck}. Tipos válidos: AMERICAN, LONG`,
        { tournamentType }
      )
  }

  // Guardar en cache para reutilización
  strategyCache.set(tournamentType, strategy)
  console.log(`[StrategyFactory] Estrategia guardada en cache: ${tournamentType}`)

  return strategy
}

/**
 * Función auxiliar para validar tipos de torneo
 * 
 * @param tournamentType - String a validar
 * @returns True si es un tipo válido
 */
export function isValidTournamentType(tournamentType: string): tournamentType is TournamentType {
  return tournamentType === 'AMERICAN' || tournamentType === 'LONG'
}

/**
 * Función para limpiar cache (útil para testing)
 * 
 * @param tournamentType - Tipo específico a limpiar, o undefined para limpiar todo
 */
export function clearStrategyCache(tournamentType?: TournamentType): void {
  if (tournamentType) {
    strategyCache.delete(tournamentType)
    console.log(`[StrategyFactory] Cache limpiado para: ${tournamentType}`)
  } else {
    strategyCache.clear()
    console.log(`[StrategyFactory] Cache completamente limpiado`)
  }
}

/**
 * Función para obtener estadísticas del cache
 * 
 * @returns Información del estado actual del cache
 */
export function getStrategyCacheStats(): {
  size: number
  types: TournamentType[]
  isEmpty: boolean
} {
  return {
    size: strategyCache.size,
    types: Array.from(strategyCache.keys()),
    isEmpty: strategyCache.size === 0
  }
}

/**
 * Error customizado para problemas de estrategia
 * Proporciona información detallada para debugging
 */
export class RegistrationStrategyError extends Error {
  public readonly code: string
  public readonly details: Record<string, unknown>
  public readonly timestamp: string

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'RegistrationStrategyError'
    this.code = code
    this.details = details
    this.timestamp = new Date().toISOString()

    // Mantener stack trace correcto
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RegistrationStrategyError)
    }
  }

  /**
   * Serializa el error para logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * Función helper para crear estrategias con validación
 * 
 * @param tournamentTypeString - String del tipo de torneo (puede venir de API/DB)
 * @returns Estrategia válida o lanza error descriptivo
 */
export function createRegistrationStrategyFromString(
  tournamentTypeString: string
): IRegistrationStrategy {
  console.log(`[StrategyFactory] Validando y creando estrategia para: "${tournamentTypeString}"`)

  if (!tournamentTypeString) {
    throw new RegistrationStrategyError(
      'MISSING_TOURNAMENT_TYPE',
      'El tipo de torneo es requerido',
      { providedType: tournamentTypeString }
    )
  }

  const normalizedType = tournamentTypeString.toUpperCase().trim()

  if (!isValidTournamentType(normalizedType)) {
    throw new RegistrationStrategyError(
      'INVALID_TOURNAMENT_TYPE',
      `Tipo de torneo inválido: "${tournamentTypeString}". Tipos válidos: AMERICAN, LONG`,
      { 
        providedType: tournamentTypeString,
        normalizedType,
        validTypes: ['AMERICAN', 'LONG']
      }
    )
  }

  return createRegistrationStrategy(normalizedType)
}

/**
 * Función para obtener información de todas las estrategias disponibles
 * Útil para documentación o interfaces de usuario
 */
export function getAvailableStrategies(): Array<{
  type: TournamentType
  description: string
  features: string[]
}> {
  return [
    {
      type: 'AMERICAN',
      description: 'Torneos tipo Americano con asignación manual de zonas',
      features: [
        'Registro en tabla inscriptions únicamente',
        'Asignación manual de zonas por organizador',
        'Soporte para inscripciones individuales y por parejas',
        'Ideal para torneos con múltiples zonas balanceadas'
      ]
    },
    {
      type: 'LONG',
      description: 'Torneos largos con zona general automática',
      features: [
        'Registro en inscriptions + zone_couples automático',
        'Asignación automática a zona general única',
        'Todas las parejas juegan en la misma zona inicialmente',
        'Ideal para torneos con fase de grupos seguida de eliminación directa'
      ]
    }
  ]
}

/**
 * Type guard para verificar si un objeto es una estrategia válida
 */
export function isValidStrategy(obj: unknown): obj is IRegistrationStrategy {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'tournamentType' in obj &&
    'registerCouple' in obj &&
    'registerIndividualPlayer' in obj &&
    'removeCouple' in obj &&
    typeof (obj as any).registerCouple === 'function' &&
    typeof (obj as any).registerIndividualPlayer === 'function' &&
    typeof (obj as any).removeCouple === 'function'
  )
}