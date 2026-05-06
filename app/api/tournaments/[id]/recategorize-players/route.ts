import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'

interface TournamentPlayer {
  id: string
  first_name: string
  last_name: string
  score: number
  category_name: string
  club_name?: string
}

interface RecategorizePlayersResponse {
  success: boolean
  players?: TournamentPlayer[]
  categories?: { name: string; lower_range: number; upper_range: number | null }[]
  error?: string
}

/**
 * GET: Obtener players del torneo para recategorización
 * Solo accesible por el club owner del torneo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<RecategorizePlayersResponse>> {
  
  const tournamentId = params.id
  
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - Usuario no encontrado'
      }, { status: 401 })
    }

    // Verificar permisos usando la función centralizada
    const permissionCheck = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.reason || 'No autorizado - No tienes permisos para acceder a este torneo'
      }, { status: 403 })
    }

    // CORREGIDO: Obtener TODOS los jugadores del torneo via couples
    // Obtener todas las parejas inscritas primero
    const { data: inscriptions, error: inscriptionsError } = await supabase
      .from('inscriptions')
      .select(`
        couples!inner (
          id,
          player1_id,
          player2_id
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('es_prueba', false)
      .eq('couples.es_prueba', false)
    
    if (inscriptionsError) {
      console.error('Error fetching tournament inscriptions:', inscriptionsError)
      return NextResponse.json({
        success: false,
        error: 'Error al obtener las inscripciones del torneo'
      }, { status: 500 })
    }
    
    // Recopilar todos los IDs de jugadores únicos
    const playerIds = new Set()
    for (const inscription of inscriptions || []) {
      const couple = inscription.couples as any
      if (couple.player1_id) playerIds.add(couple.player1_id)
      if (couple.player2_id) playerIds.add(couple.player2_id)
    }
    
    // Obtener información de todos los jugadores únicos
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select(`
        id,
        first_name,
        last_name,
        score,
        category_name,
        club_id,
        clubes (
          name
        )
      `)
      .in('id', Array.from(playerIds))
      .eq('es_prueba', false)
    
    if (playersError) {
      console.error('Error fetching tournament players:', playersError)
      return NextResponse.json({
        success: false,
        error: 'Error al obtener los jugadores del torneo'
      }, { status: 500 })
    }
    
    // Formatear para mantener compatibilidad con el resto del código
    const players = playersData?.map(player => ({
      player_id: player.id,
      players: player
    })) || []

    // Obtener todas las categorías disponibles
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('name, lower_range, upper_range')
      .order('lower_range', { ascending: true })

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      return NextResponse.json({
        success: false,
        error: 'Error al obtener las categorías'
      }, { status: 500 })
    }

    // Formatear datos de players
    const formattedPlayers: TournamentPlayer[] = players?.map((inscription: any) => ({
      id: inscription.players.id,
      first_name: inscription.players.first_name || '',
      last_name: inscription.players.last_name || '',
      score: Number(inscription.players.score) || 0,
      category_name: inscription.players.category_name || '',
      club_name: inscription.players.clubes?.name || 'Sin Club'
    })) || []

    // Remover duplicados (un player puede estar en múltiples inscriptions si es parte de varias parejas)
    const uniquePlayers = formattedPlayers.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    )

    // Ordenar por apellido y nombre
    uniquePlayers.sort((a, b) => {
      const lastNameComparison = a.last_name.localeCompare(b.last_name)
      if (lastNameComparison !== 0) return lastNameComparison
      return a.first_name.localeCompare(b.first_name)
    })

    return NextResponse.json({
      success: true,
      players: uniquePlayers,
      categories: categories || []
    })

  } catch (error) {
    console.error('Error in recategorize-players endpoint:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

/**
 * POST: Actualizar categorías de players
 * Body: { updates: Array<{playerId: string, newCategory: string}> }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ success: boolean; error?: string; updated?: number }>> {
  
  const tournamentId = params.id
  
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - Usuario no encontrado'
      }, { status: 401 })
    }

    // Verificar permisos usando la función centralizada
    const permissionCheck = await checkTournamentPermissions(user.id, tournamentId)

    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.reason || 'No autorizado - No tienes permisos para acceder a este torneo'
      }, { status: 403 })
    }

    // Obtener datos del request
    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se proporcionaron actualizaciones válidas'
      }, { status: 400 })
    }

    // Validar que todas las categorías existen y obtener sus rangos
    const categoryNames = [...new Set(updates.map(u => u.newCategory))]
    const { data: validCategories, error: categoryError } = await supabase
      .from('categories')
      .select('name, lower_range, upper_range')
      .in('name', categoryNames)

    if (categoryError) {
      return NextResponse.json({
        success: false,
        error: 'Error al validar categorías'
      }, { status: 500 })
    }

    const validCategoryNames = new Set(validCategories?.map(c => c.name) || [])
    const invalidCategories = categoryNames.filter(name => !validCategoryNames.has(name))

    if (invalidCategories.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Categorías inválidas: ${invalidCategories.join(', ')}`
      }, { status: 400 })
    }

    // Crear mapa de categorías con sus rangos para ajuste automático de puntaje
    const categoryRanges = new Map(
      validCategories?.map(cat => [cat.name, { lower_range: cat.lower_range, upper_range: cat.upper_range }]) || []
    )

    // Actualizar players por lotes con ajuste automático de puntaje
    let updatedCount = 0
    const batchSize = 10
    const updateDetails: Array<{playerId: string, oldCategory: string, newCategory: string, oldScore: number, newScore: number}> = []

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      
      for (const update of batch) {
        // Obtener datos actuales del jugador
        const { data: currentPlayer, error: playerError } = await supabase
          .from('players')
          .select('category_name, score')
          .eq('id', update.playerId)
          .single()

        if (playerError) {
          console.error(`Error fetching player ${update.playerId}:`, playerError)
          continue
        }

        // Calcular nuevo puntaje basado en la nueva categoría
        const categoryRange = categoryRanges.get(update.newCategory)
        if (!categoryRange) {
          console.error(`Category range not found for ${update.newCategory}`)
          continue
        }

        const oldScore = Number(currentPlayer?.score) || 0
        const newScore = categoryRange.lower_range // Asignar puntaje mínimo de la nueva categoría

        // Actualizar categoría y puntaje
        const { error } = await supabase
          .from('players')
          .update({ 
            category_name: update.newCategory,
            score: newScore
          })
          .eq('id', update.playerId)

        if (error) {
          console.error(`Error updating player ${update.playerId}:`, error)
        } else {
          updatedCount++
          
          // Registrar la recategorización en la tabla de auditoría
          const recategorizationRecord = {
            player_id: update.playerId,
            tournament_id: tournamentId,
            old_category_name: currentPlayer?.category_name || '',
            new_category_name: update.newCategory,
            old_score: oldScore,
            new_score: newScore,
            recategorized_by: user.id,
            reason: 'Recategorización durante torneo - ajuste automático de puntaje',
            tournament_context: true,
            es_prueba: false
          }

          const { error: recategorizationError } = await supabase
            .from('player_recategorizations')
            .insert(recategorizationRecord)

          if (recategorizationError) {
            console.error(`Error registering recategorization for player ${update.playerId}:`, recategorizationError)
            // No fallar la operación principal por esto, solo logear el error
          } else {
            console.log(`✅ Recategorization registered for player ${update.playerId}: ${currentPlayer?.category_name} → ${update.newCategory}`)
          }

          updateDetails.push({
            playerId: update.playerId,
            oldCategory: currentPlayer?.category_name || '',
            newCategory: update.newCategory,
            oldScore,
            newScore
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      updateDetails // Devolver detalles de los cambios para mostrar en UI
    })

  } catch (error) {
    console.error('Error updating player categories:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

