/**
 * 🎾 VALIDACIÓN DE RESULTADOS DE PÁDEL
 * 
 * Utilidad para validar que los resultados ingresados cumplan con las reglas del pádel.
 * Solo permite resultados válidos según las reglas oficiales del deporte.
 */

// Todos los resultados válidos de pádel (siempre debe haber un ganador)
const VALID_PADEL_SCORES: [number, number][] = [
  // Ganador saca 6 games (en torneos americanos se permite 6-5)
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Sets ajustados y tie-break (ganador saca 7)
  [7, 5], [7, 6],
  // Mismos resultados pero ganador es la pareja 2
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [5, 7], [6, 7]
]

/**
 * Valida si un resultado es válido según las reglas del pádel
 */
export const isValidPadelScore = (score1: number, score2: number): boolean => {
  // Verificar valores básicos
  if (score1 < 0 || score2 < 0) return false
  if (score1 === score2) return false // No puede haber empate
  
  // Verificar si el resultado está en la lista de válidos
  return VALID_PADEL_SCORES.some(([s1, s2]) => s1 === score1 && s2 === score2)
}

/**
 * Obtiene el ganador del partido según el resultado
 */
export const getPadelWinner = (score1: number, score2: number): 'couple1' | 'couple2' | null => {
  if (!isValidPadelScore(score1, score2)) return null
  return score1 > score2 ? 'couple1' : 'couple2'
}

/**
 * Obtiene un mensaje de error explicativo para resultados inválidos
 */
export const getPadelScoreErrorMessage = (score1: number, score2: number): string => {
  if (score1 < 0 || score2 < 0) {
    return "Los puntajes deben ser números positivos"
  }
  
  if (score1 === score2) {
    return "No puede haber empate en pádel"
  }
  
  return "Resultado inválido. Los resultados válidos son: 6-0, 6-1, 6-2, 6-3, 6-4, 6-5, 7-5, 7-6 (y sus inversos)"
}

/**
 * Valida el input del usuario en tiempo real
 */
export const validatePadelScoreInput = (
  score1Str: string, 
  score2Str: string
): {
  isValid: boolean
  winner: 'couple1' | 'couple2' | null
  errorMessage: string | null
  canSubmit: boolean
} => {
  // Si alguno está vacío, no es válido pero tampoco es error
  if (score1Str === "" || score2Str === "") {
    return {
      isValid: false,
      winner: null,
      errorMessage: null,
      canSubmit: false
    }
  }
  
  const score1 = parseInt(score1Str)
  const score2 = parseInt(score2Str)
  
  // Verificar que son números válidos
  if (isNaN(score1) || isNaN(score2)) {
    return {
      isValid: false,
      winner: null,
      errorMessage: "Ingresa números válidos",
      canSubmit: false
    }
  }
  
  const isValid = isValidPadelScore(score1, score2)
  const winner = getPadelWinner(score1, score2)
  const errorMessage = isValid ? null : getPadelScoreErrorMessage(score1, score2)
  
  return {
    isValid,
    winner,
    errorMessage,
    canSubmit: isValid
  }
}

/**
 * Lista de todos los resultados válidos como strings para mostrar al usuario
 */
export const getValidPadelScoresDisplay = (): string[] => {
  return VALID_PADEL_SCORES.map(([s1, s2]) => `${s1}-${s2}`)
}

/**
 * Verifica si al menos uno de los dos scores indica una intención válida
 * (útil para feedback en tiempo real mientras el usuario escribe)
 */
export const hasValidScoreIntent = (score1: number, score2: number): boolean => {
  // Si alguno está en rango válido (0-7), consideramos que hay intención válida
  return (score1 >= 0 && score1 <= 7) && (score2 >= 0 && score2 <= 7)
}
