/**
 * 🔍 BÚSQUEDA UNIVERSAL DE JUGADORES
 *
 * Utility compartida para Edge Functions que replica la lógica
 * del RPC search_players_ranking pero en TypeScript.
 *
 * Soporta:
 * - Búsqueda por nombre/apellido (con normalización de acentos)
 * - Búsqueda por nombre completo ("Giuliano Politi")
 * - Búsqueda por nombre inverso ("Politi Giuliano")
 * - Búsqueda por DNI (con normalización de puntos/guiones)
 */

export interface SearchFilters {
  searchTerm?: string
  gender?: 'MALE' | 'FEMALE'
  category?: string | null
  clubId?: string | null
  organizadorId?: string | null
  includeTest?: boolean
  requireScore?: boolean
  searchDni?: boolean  // Activar búsqueda por DNI
}

/**
 * Normaliza un string removiendo acentos
 * Replica la función unaccent de PostgreSQL
 *
 * @example
 * removeAccents("María García") → "maria garcia"
 * removeAccents("Giuliano") → "giuliano"
 */
export function removeAccents(str: string): string {
  if (!str) return ''

  return str
    .normalize('NFD')  // Descomponer caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '')  // Remover diacríticos
    .toLowerCase()
    .trim()
}

/**
 * Normaliza DNI removiendo puntos, guiones y espacios
 *
 * @example
 * normalizeDni("12.345.678") → "12345678"
 * normalizeDni("12-345-678") → "12345678"
 * normalizeDni("12 345 678") → "12345678"
 */
export function normalizeDni(dni: string): string {
  if (!dni) return ''
  return dni.replace(/[\.\-\s]/g, '')
}

/**
 * Construye el query de búsqueda de jugadores
 *
 * Estrategia de 2 pasos:
 * 1. Query inicial con filtros base (gender, category, etc.)
 * 2. Post-procesamiento client-side para nombre completo y DNI normalizado
 *
 * IMPORTANTE: La búsqueda por nombre NO usa filtros SQL para ser insensible a tildes.
 * El filtrado se hace 100% en post-procesamiento con normalización de acentos.
 *
 * Esto es necesario porque Supabase/PostgreSQL no soporta:
 * - Función unaccent nativa sin extensión
 * - LIKE insensible a acentos
 */
export async function buildPlayerSearchQuery(
  supabaseClient: any,
  filters: SearchFilters,
  limit: number,
  offset: number
) {
  const {
    searchTerm = '',
    gender,
    category,
    clubId,
    organizadorId,
    includeTest = false,
    requireScore = false,
    searchDni = true
  } = filters

  // Detectar tipo de búsqueda
  const isDniSearch = searchTerm && /^\d/.test(searchTerm.trim())

  console.log('[buildPlayerSearchQuery] Filters:', {
    searchTerm,
    gender,
    category,
    clubId,
    organizadorId,
    includeTest,
    requireScore,
    searchDni,
    isDniSearch
  })

  // ========================================
  // PASO 1: QUERY BASE CON FILTROS
  // ========================================

  const buildBaseQuery = () => {
    let baseQuery = supabaseClient
      .from('players')
      .select(`
        id,
        first_name,
        last_name,
        dni,
        score,
        category_name,
        profile_image_url,
        gender,
        clubes:club_id (
          name
        ),
        organizaciones:organizador_id (
          name
        )
      `, { count: 'exact' })

    if (gender) {
      baseQuery = baseQuery.eq('gender', gender)
    }
    if (category) {
      baseQuery = baseQuery.eq('category_name', category)
    }
    if (clubId) {
      baseQuery = baseQuery.eq('club_id', clubId)
    }
    if (organizadorId) {
      baseQuery = baseQuery.eq('organizador_id', organizadorId)
    }
    if (!includeTest) {
      baseQuery = baseQuery.eq('es_prueba', false)
    }
    if (requireScore) {
      baseQuery = baseQuery.not('score', 'is', null)
    }

    baseQuery = baseQuery.order('score', { ascending: false, nullsFirst: false })
    return baseQuery
  }

  let query = buildBaseQuery()

  // Filtros de búsqueda en SQL para reducir el conjunto de resultados inicial
  const trimmedSearchTerm = searchTerm.trim()
  const searchWords = removeAccents(trimmedSearchTerm).split(/\s+/).filter((word) => word.length > 0)

  if (trimmedSearchTerm.length > 0) {
    if (isDniSearch && searchDni) {
      const normalizedDni = normalizeDni(trimmedSearchTerm)
      query = query.ilike('dni', `${normalizedDni}%`)
      console.log('[buildPlayerSearchQuery] Applying DNI filter in SQL:', normalizedDni)
    } else {
      // AND flexible por términos: cada palabra debe matchear en nombre o apellido
      for (const rawWord of searchWords) {
        const safeWord = rawWord.replace(/[,()]/g, '').replace(/'/g, '').replace(/%/g, '')
        if (!safeWord) continue
        query = query.or(`first_name.ilike.%${safeWord}%,last_name.ilike.%${safeWord}%`)
      }
      console.log('[buildPlayerSearchQuery] Applying name terms filter in SQL:', searchWords)
    }
  }

  // Limitar resultados para rendimiento
  query = query.limit(200)

  // Ejecutar query
  let { data: initialData, error } = await query

  if (error) {
    console.error('[buildPlayerSearchQuery] Query error:', error)
    throw error
  }

  // Fallback para mejorar matching por nombre completo y casos con acentos
  if (!isDniSearch && trimmedSearchTerm.length > 0 && ((initialData?.length || 0) === 0 || searchWords.length > 1)) {
    const fallbackQuery = buildBaseQuery().limit(500)
    const { data: fallbackData, error: fallbackError } = await fallbackQuery

    if (fallbackError) {
      console.error('[buildPlayerSearchQuery] Fallback query error:', fallbackError)
      throw fallbackError
    }

    initialData = fallbackData || []
    console.log('[buildPlayerSearchQuery] Fallback query used. Rows:', initialData.length)
  }

  console.log('[buildPlayerSearchQuery] Initial results:', initialData?.length || 0)

  // ========================================
  // PASO 2: POST-PROCESAMIENTO CLIENT-SIDE
  // (Insensible a tildes/acentos)
  // ========================================

  let filteredData = initialData || []

  if (trimmedSearchTerm.length > 0) {
    const normalizedSearch = removeAccents(trimmedSearchTerm)

    console.log('[buildPlayerSearchQuery] Post-processing:', {
      normalizedSearch,
      isDniSearch,
      searchDni
    })

    filteredData = filteredData.filter((player: any) => {
      // ✅ BÚSQUEDA POR DNI (si está activada Y parece DNI)
      if (searchDni && isDniSearch) {
        const playerDniNormalized = normalizeDni(player.dni || '')
        const searchDniNormalized = normalizeDni(trimmedSearchTerm)

        if (playerDniNormalized.startsWith(searchDniNormalized)) {
          return true
        }
      }

      // ✅ BÚSQUEDA POR NOMBRE/APELLIDO (con normalización de acentos)
      // Esto permite buscar "tomas" y encontrar "Tomás"
      const firstName = removeAccents(player.first_name || '')
      const lastName = removeAccents(player.last_name || '')
      const fullName = `${firstName} ${lastName}`
      const fullNameReverse = `${lastName} ${firstName}`

      // Buscar en múltiples variantes:
      // 1. first_name solo
      // 2. last_name solo
      // 3. first_name + " " + last_name (nombre completo)
      // 4. last_name + " " + first_name (nombre inverso)
      // 5. Cada palabra del término de búsqueda por separado
      
      // Búsqueda simple
      if (firstName.includes(normalizedSearch) ||
          lastName.includes(normalizedSearch) ||
          fullName.includes(normalizedSearch) ||
          fullNameReverse.includes(normalizedSearch)) {
        return true
      }

      // Búsqueda por palabras individuales (ej: "tomas garcia" busca "tomas" AND "garcia")
      if (normalizedSearch.includes(' ')) {
        const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0)
        const allWordsMatch = searchWords.every(word =>
          firstName.includes(word) ||
          lastName.includes(word)
        )
        if (allWordsMatch) {
          return true
        }
      }

      return false
    })
  }

  console.log('[buildPlayerSearchQuery] Final results after post-processing:', filteredData.length)

  // Aplicar paginación client-side (después del filtrado)
  const paginatedData = filteredData.slice(offset, offset + limit)

  return {
    players: paginatedData,
    total: filteredData.length  // Total después del filtrado
  }
}
