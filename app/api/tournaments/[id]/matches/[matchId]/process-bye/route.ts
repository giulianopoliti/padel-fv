import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface ProcessByeResponse {
  success: boolean
  message?: string
  error?: string
  processed?: boolean
  winner?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
): Promise<NextResponse<ProcessByeResponse>> {
  try {
    const tournamentId = params.id
    const matchId = params.matchId
    
    console.log(`🎯 [PROCESS-BYE] Processing potential BYE for match ${matchId}`)

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Verificar autenticación y permisos
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Verificar ownership del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('club_id, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found'
      }, { status: 404 })
    }

    const { data: userClub } = await supabase
      .from('user_details_v')
      .select('club_id')
      .eq('id', user.id)
      .single()

    if (!userClub || userClub.club_id !== tournament.club_id) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions'
      }, { status: 403 })
    }

    // Obtener información del match con sus tournament_couple_seeds
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, status, winner_id, round, order_in_round,
        tournament_couple_seed1_id,
        tournament_couple_seed2_id,
        seed1:tournament_couple_seeds!tournament_couple_seed1_id(id, couple_id, is_placeholder, placeholder_label),
        seed2:tournament_couple_seeds!tournament_couple_seed2_id(id, couple_id, is_placeholder, placeholder_label)
      `)
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single()

    if (matchError || !matchData) {
      return NextResponse.json({
        success: false,
        error: 'Match not found'
      }, { status: 404 })
    }

    // Verificar si ya está finalizado
    if (matchData.status === 'FINISHED') {
      return NextResponse.json({
        success: false,
        error: 'Match is already finished'
      }, { status: 400 })
    }

    // Determinar si es un BYE
    const seed1 = Array.isArray(matchData.seed1) ? matchData.seed1[0] : matchData.seed1
    const seed2 = Array.isArray(matchData.seed2) ? matchData.seed2[0] : matchData.seed2
    
    const hasRealSeed1 = seed1 && !seed1.is_placeholder && seed1.couple_id
    const hasRealSeed2 = seed2 && !seed2.is_placeholder && seed2.couple_id
    
    // CASO 1: BYE (exactamente uno de los dos tiene pareja real)
    const isBye = (hasRealSeed1 && !hasRealSeed2) || (!hasRealSeed1 && hasRealSeed2)
    
    if (!isBye) {
      // CASO 2: Ambos tienen pareja real - cambiar a PENDING
      if (hasRealSeed1 && hasRealSeed2) {
        const { error: updateError } = await supabase
          .from('matches')
          .update({ status: 'PENDING' })
          .eq('id', matchId)
        
        if (updateError) {
          return NextResponse.json({
            success: false,
            error: 'Failed to update match status'
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          processed: true,
          message: 'Match set to PENDING - ready to play'
        })
      }
      
      // CASO 3: Aún esperando resolución de placeholders
      return NextResponse.json({
        success: false,
        error: 'Match is not ready - still waiting for opponent resolution'
      }, { status: 400 })
    }

    // PROCESAR BYE
    const winner = hasRealSeed1 ? seed1.couple_id : seed2.couple_id
    
    console.log(`🏆 [PROCESS-BYE] Processing BYE: winner ${winner} in match ${matchId}`)
    
    // Marcar match como finalizado
    const { error: updateError } = await supabase
      .from('matches')
      .update({ 
        winner_id: winner,
        status: 'FINISHED'
      })
      .eq('id', matchId)
    
    if (updateError) {
      console.error('Failed to finish BYE match:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to finish BYE match'
      }, { status: 500 })
    }
    
    // Avanzar ganador usando la lógica existente
    try {
      const { advanceWinnerUsingHierarchy } = await import('@/app/api/tournaments/actions')
      const advanceResult = await advanceWinnerUsingHierarchy(
        supabase,
        tournamentId,
        matchId,
        winner,
        'auto_bye'
      )
      
      if (advanceResult.success) {
        console.log(`✅ [PROCESS-BYE] BYE processed and advanced: ${advanceResult.message}`)
        return NextResponse.json({
          success: true,
          processed: true,
          winner,
          message: `BYE processed successfully: ${advanceResult.message}`
        })
      } else {
        console.warn(`⚠️ [PROCESS-BYE] BYE advance failed: ${advanceResult.error}`)
        return NextResponse.json({
          success: true,
          processed: true,
          winner,
          message: `BYE processed but advance failed: ${advanceResult.error}`
        })
      }
    } catch (advanceError) {
      console.error('Error advancing BYE winner:', advanceError)
      return NextResponse.json({
        success: true,
        processed: true,
        winner,
        message: 'BYE processed but advance failed due to system error'
      })
    }

  } catch (error) {
    console.error('Process BYE error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}