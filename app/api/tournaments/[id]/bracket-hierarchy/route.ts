import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface BracketHierarchyNode {
  matchId: string
  round: string
  order: number
  status: string
  couple1_id: string | null
  couple2_id: string | null
  winner_id: string | null
  // Información de placeholders
  couple1_placeholder_label?: string | null
  couple1_is_placeholder?: boolean
  couple1_placeholder_zone_id?: string | null
  couple1_placeholder_position?: number | null
  couple1_placeholder_zone_name?: string | null
  couple2_placeholder_label?: string | null
  couple2_is_placeholder?: boolean
  couple2_placeholder_zone_id?: string | null
  couple2_placeholder_position?: number | null
  couple2_placeholder_zone_name?: string | null
  children?: BracketHierarchyNode[]
}

interface BracketHierarchyResponse {
  success: boolean
  tournamentId: string
  hierarchy: BracketHierarchyNode[]
  totalMatches: number
  error?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<BracketHierarchyResponse>> {
  try {
    const tournamentId = params.id

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Verificar que el torneo existe
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, club_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        tournamentId,
        hierarchy: [],
        totalMatches: 0,
        error: 'Tournament not found'
      }, { status: 404 })
    }

    // Obtener todos los matches de eliminación con relaciones jerárquicas
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('match_hierarchy')
      .select(`
        parent_match_id,
        child_match_id,
        parent_slot,
        parent_round,
        child_round,
        parent_match:parent_match_id (
          id,
          round,
          order_in_round,
          status,
          couple1_id,
          couple2_id,
          winner_id
        ),
        child_match:child_match_id (
          id,
          round,
          order_in_round,
          status,
          couple1_id,
          couple2_id,
          winner_id
        )
      `)
      .eq('tournament_id', tournamentId)

    if (hierarchyError) {
      return NextResponse.json({
        success: false,
        tournamentId,
        hierarchy: [],
        totalMatches: 0,
        error: 'Failed to fetch bracket hierarchy'
      }, { status: 500 })
    }

    // Obtener todos los matches de eliminación del torneo con información de seeds
    const { data: allMatches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id, 
        round, 
        order_in_round, 
        status, 
        couple1_id, 
        couple2_id, 
        winner_id,
        tournament_couple_seed1_id,
        tournament_couple_seed2_id,
        seed1:tournament_couple_seed1_id (
          id,
          couple_id,
          seed,
          bracket_position,
          placeholder_label,
          placeholder_zone_id,
          placeholder_position,
          is_placeholder,
          created_as_placeholder,
          placeholder_zone:placeholder_zone_id (
            id,
            name
          )
        ),
        seed2:tournament_couple_seed2_id (
          id,
          couple_id,
          seed,
          bracket_position,
          placeholder_label,
          placeholder_zone_id,
          placeholder_position,
          is_placeholder,
          created_as_placeholder,
          placeholder_zone:placeholder_zone_id (
            id,
            name
          )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('type', 'ELIMINATION')
      .order('round')
      .order('order_in_round')

    if (matchesError) {
      return NextResponse.json({
        success: false,
        tournamentId,
        hierarchy: [],
        totalMatches: 0,
        error: 'Failed to fetch matches'
      }, { status: 500 })
    }

    // Construir jerarquía completa
    const hierarchy = buildHierarchyTree(allMatches, hierarchyData)

    return NextResponse.json({
      success: true,
      tournamentId,
      hierarchy,
      totalMatches: allMatches?.length || 0
    })

  } catch (error) {
    console.error('Bracket hierarchy error:', error)
    return NextResponse.json({
      success: false,
      tournamentId: params.id,
      hierarchy: [],
      totalMatches: 0,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Construye el árbol jerárquico del bracket
 */
function buildHierarchyTree(matches: any[], hierarchyData: any[]): BracketHierarchyNode[] {
  // Crear mapa de matches por ID
  const matchMap = new Map<string, any>()
  matches.forEach(match => {
    matchMap.set(match.id, {
      matchId: match.id,
      round: match.round,
      order: match.order_in_round,
      status: match.status,
      couple1_id: match.couple1_id,
      couple2_id: match.couple2_id,
      winner_id: match.winner_id,
      // Información de placeholders para pareja 1
      couple1_placeholder_label: match.seed1?.placeholder_label || null,
      couple1_is_placeholder: match.seed1?.is_placeholder || false,
      couple1_placeholder_zone_id: match.seed1?.placeholder_zone_id || null,
      couple1_placeholder_position: match.seed1?.placeholder_position || null,
      couple1_placeholder_zone_name: Array.isArray(match.seed1?.placeholder_zone)
        ? match.seed1?.placeholder_zone[0]?.name || null
        : match.seed1?.placeholder_zone?.name || null,
      // Información de placeholders para pareja 2
      couple2_placeholder_label: match.seed2?.placeholder_label || null,
      couple2_is_placeholder: match.seed2?.is_placeholder || false,
      couple2_placeholder_zone_id: match.seed2?.placeholder_zone_id || null,
      couple2_placeholder_position: match.seed2?.placeholder_position || null,
      couple2_placeholder_zone_name: Array.isArray(match.seed2?.placeholder_zone)
        ? match.seed2?.placeholder_zone[0]?.name || null
        : match.seed2?.placeholder_zone?.name || null,
      children: []
    })
  })

  // Construir relaciones padre-hijo
  hierarchyData.forEach(relation => {
    const parentNode = matchMap.get(relation.parent_match_id)
    const childNode = matchMap.get(relation.child_match_id)
    
    if (parentNode && childNode) {
      parentNode.children.push(childNode)
    }
  })

  // Encontrar nodos raíz (matches sin padres - generalmente FINAL)
  const rootNodes: BracketHierarchyNode[] = []
  const childIds = new Set(hierarchyData.map(h => h.child_match_id))
  
  matches.forEach(match => {
    if (!childIds.has(match.id)) {
      const node = matchMap.get(match.id)
      if (node) {
        rootNodes.push(node)
      }
    }
  })

  // Si no hay nodos raíz claros, agrupar por round
  if (rootNodes.length === 0) {
    const roundGroups = new Map<string, BracketHierarchyNode[]>()
    matchMap.forEach(node => {
      if (!roundGroups.has(node.round)) {
        roundGroups.set(node.round, [])
      }
      roundGroups.get(node.round)!.push(node)
    })
    
    // Retornar por rounds ordenados
    const roundOrder = ['FINAL', 'SEMIFINAL', '4TOS', '8VOS', '16VOS', '32VOS']
    const sortedNodes: BracketHierarchyNode[] = []
    
    roundOrder.forEach(round => {
      const roundMatches = roundGroups.get(round)
      if (roundMatches) {
        roundMatches.sort((a, b) => (a.order || 0) - (b.order || 0))
        sortedNodes.push(...roundMatches)
      }
    })
    
    return sortedNodes
  }

  return rootNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
}
