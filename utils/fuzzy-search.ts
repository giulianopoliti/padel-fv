/**
 * 🔍 FUZZY SEARCH UTILITY
 *
 * Sistema de búsqueda por aproximación con múltiples estrategias.
 * Diseñado para ser portable a otros lenguajes (Python, etc.)
 *
 * Estrategias implementadas:
 * 1. Normalización de texto (espacios, acentos, case)
 * 2. Búsqueda por palabras individuales
 * 3. Distancia de Levenshtein (similitud de caracteres)
 * 4. Scoring ponderado para rankear resultados
 */

/**
 * Normaliza un string para búsqueda:
 * - Convierte a minúsculas
 * - Elimina espacios extras
 * - Remueve acentos y diacríticos
 * - Trim de espacios al inicio/final
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return ''

  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Múltiples espacios → un espacio
    .normalize('NFD') // Descomponer caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
}

/**
 * Calcula la distancia de Levenshtein entre dos strings.
 * Representa el número mínimo de ediciones (inserción, eliminación, sustitución)
 * necesarias para transformar un string en otro.
 *
 * Ejemplo:
 * - levenshteinDistance("ajuli", "ajulio") = 1 (agregar 'o')
 * - levenshteinDistance("maria", "mario") = 1 (cambiar 'a' por 'o')
 *
 * @param str1 - Primer string
 * @param str2 - Segundo string
 * @returns Número de ediciones necesarias
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length

  // Crear matriz de distancias
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  // Inicializar primera fila y columna
  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  // Calcular distancias
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Eliminación
        matrix[i][j - 1] + 1,      // Inserción
        matrix[i - 1][j - 1] + cost // Sustitución
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Calcula un score de similitud entre dos strings (0-1).
 * 1 = idénticos, 0 = totalmente diferentes
 *
 * @param str1 - Primer string
 * @param str2 - Segundo string
 * @returns Score entre 0 y 1
 */
export function similarityScore(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (!str1 || !str2) return 0.0

  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)

  // Normalizar: 1 - (distancia / longitud máxima)
  return 1 - (distance / maxLength)
}

/**
 * Verifica si un término de búsqueda hace match con un texto objetivo.
 * Usa múltiples estrategias de matching.
 *
 * @param searchTerm - Término buscado (puede tener múltiples palabras)
 * @param targetText - Texto donde buscar
 * @param threshold - Umbral de similitud (0-1). Default: 0.75
 * @returns true si hay match, false si no
 */
export function fuzzyMatch(
  searchTerm: string,
  targetText: string,
  threshold: number = 0.75
): boolean {
  const normalizedSearch = normalizeString(searchTerm)
  const normalizedTarget = normalizeString(targetText)

  // Estrategia 1: Match exacto (caso normalizado)
  if (normalizedTarget.includes(normalizedSearch)) {
    return true
  }

  // Estrategia 2: Match por palabras individuales
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0)
  const targetWords = normalizedTarget.split(' ').filter(w => w.length > 0)

  // Todas las palabras de búsqueda deben estar en el target
  const allWordsMatch = searchWords.every(searchWord => {
    return targetWords.some(targetWord => {
      // Buscar inclusión o similitud
      return targetWord.includes(searchWord) ||
             similarityScore(searchWord, targetWord) >= threshold
    })
  })

  if (allWordsMatch) {
    return true
  }

  // Estrategia 3: Similitud global (para búsquedas cortas con typos)
  if (normalizedSearch.length > 2 && normalizedTarget.length > 2) {
    const globalSimilarity = similarityScore(normalizedSearch, normalizedTarget)
    if (globalSimilarity >= threshold) {
      return true
    }
  }

  return false
}

/**
 * Interfaz genérica para items buscables.
 * Permite buscar en cualquier tipo de objeto con campos configurables.
 */
export interface SearchableItem {
  [key: string]: any
}

/**
 * Configuración de búsqueda fuzzy
 */
export interface FuzzySearchConfig {
  /** Campos donde buscar (ej: ['first_name', 'last_name', 'dni']) */
  searchFields: string[]
  /** Umbral de similitud (0-1). Default: 0.75 */
  threshold?: number
  /** Peso de cada campo en el scoring. Default: todos iguales */
  fieldWeights?: { [key: string]: number }
  /** Límite de resultados. Default: sin límite */
  limit?: number
}

/**
 * Resultado de búsqueda con scoring
 */
export interface FuzzySearchResult<T> {
  item: T
  score: number
  matchedFields: string[]
}

/**
 * 🎯 FUNCIÓN PRINCIPAL DE BÚSQUEDA FUZZY
 *
 * Busca items en un array usando múltiples estrategias de matching.
 * Retorna resultados ordenados por relevancia (score).
 *
 * @param searchTerm - Término a buscar
 * @param items - Array de items donde buscar
 * @param config - Configuración de búsqueda
 * @returns Array de resultados ordenados por score
 *
 * @example
 * ```typescript
 * const players = [
 *   { id: '1', first_name: 'Juan', last_name: 'Pérez', dni: '12345678' },
 *   { id: '2', first_name: 'María', last_name: 'García', dni: '87654321' }
 * ]
 *
 * const results = fuzzySearch('juan perez', players, {
 *   searchFields: ['first_name', 'last_name'],
 *   threshold: 0.7,
 *   limit: 10
 * })
 * ```
 */
export function fuzzySearch<T extends SearchableItem>(
  searchTerm: string,
  items: T[],
  config: FuzzySearchConfig
): FuzzySearchResult<T>[] {
  const {
    searchFields,
    threshold = 0.75,
    fieldWeights = {},
    limit
  } = config

  // Validación
  if (!searchTerm || searchTerm.trim().length === 0) {
    return []
  }

  const normalizedSearch = normalizeString(searchTerm)
  const results: FuzzySearchResult<T>[] = []

  // Buscar en cada item
  for (const item of items) {
    let totalScore = 0
    let matchCount = 0
    const matchedFields: string[] = []

    // Buscar en cada campo configurado
    for (const field of searchFields) {
      const fieldValue = item[field]
      if (!fieldValue) continue

      const fieldText = String(fieldValue)
      const normalizedField = normalizeString(fieldText)

      // Calcular score para este campo
      let fieldScore = 0

      // Match exacto (normalizado)
      if (normalizedField.includes(normalizedSearch)) {
        fieldScore = 1.0
      }
      // Match por similitud
      else {
        const similarity = similarityScore(normalizedSearch, normalizedField)
        if (similarity >= threshold) {
          fieldScore = similarity
        }
        // Match por palabras individuales
        else {
          const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0)
          const fieldWords = normalizedField.split(' ').filter(w => w.length > 0)

          let wordMatchScore = 0
          let wordMatchCount = 0

          for (const searchWord of searchWords) {
            let bestWordScore = 0

            for (const fieldWord of fieldWords) {
              if (fieldWord.includes(searchWord)) {
                bestWordScore = 1.0
                break
              }
              const wordSimilarity = similarityScore(searchWord, fieldWord)
              bestWordScore = Math.max(bestWordScore, wordSimilarity)
            }

            if (bestWordScore >= threshold) {
              wordMatchScore += bestWordScore
              wordMatchCount++
            }
          }

          if (wordMatchCount > 0) {
            fieldScore = wordMatchScore / searchWords.length
          }
        }
      }

      // Aplicar peso del campo
      const weight = fieldWeights[field] || 1.0

      if (fieldScore > 0) {
        totalScore += fieldScore * weight
        matchCount++
        matchedFields.push(field)
      }
    }

    // Si hubo algún match, agregar a resultados
    if (matchCount > 0) {
      const avgScore = totalScore / matchCount
      results.push({
        item,
        score: avgScore,
        matchedFields
      })
    }
  }

  // Ordenar por score descendente
  results.sort((a, b) => b.score - a.score)

  // Aplicar límite si está configurado
  if (limit && limit > 0) {
    return results.slice(0, limit)
  }

  return results
}

/**
 * 🎯 HELPER: Búsqueda fuzzy simplificada para players
 *
 * Wrapper especializado para buscar jugadores de padel.
 *
 * @param searchTerm - Término a buscar
 * @param players - Array de jugadores
 * @param threshold - Umbral de similitud (default: 0.7)
 * @returns Array de jugadores que hacen match
 */
export interface Player {
  id: string
  first_name?: string | null
  last_name?: string | null
  dni?: string | null
  [key: string]: any
}

export function searchPlayers(
  searchTerm: string,
  players: Player[],
  threshold: number = 0.7
): Player[] {
  // Detectar si la búsqueda es principalmente un DNI
  const isDniSearch = /^\d/.test(searchTerm.trim())

  const config: FuzzySearchConfig = {
    searchFields: isDniSearch
      ? ['dni', 'first_name', 'last_name'] // Priorizar DNI
      : ['first_name', 'last_name', 'dni'], // Priorizar nombres
    threshold,
    fieldWeights: isDniSearch
      ? { dni: 2.0, first_name: 1.0, last_name: 1.0 } // DNI tiene más peso
      : { first_name: 1.5, last_name: 1.5, dni: 1.0 } // Nombres tienen más peso
  }

  const results = fuzzySearch(searchTerm, players, config)

  // Retornar solo los items (sin el score)
  return results.map(r => r.item)
}
