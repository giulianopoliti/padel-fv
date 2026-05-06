import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface ProcessByeResult {
  success: boolean
  processedCount: number
  message: string
  processedMatches?: Array<{
    id: string
    round: string
    order_in_round: number
    winner: string
  }>
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ProcessByeResult>> {
  const tournamentId = params.id
  
  try {
    console.log(`🎯 [PROCESS-ALL-BYES] Starting BYE processing for tournament: ${tournamentId}`)

    const supabase = await createClient()
    
    // Verificar autenticación y permisos
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        processedCount: 0,
        message: 'Unauthorized',
        error: 'Usuario no autenticado'
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
        processedCount: 0,
        message: 'Tournament not found',
        error: 'Torneo no encontrado'
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
        processedCount: 0,
        message: 'Insufficient permissions',
        error: 'Permisos insuficientes'
      }, { status: 403 })
    }

    // 1. BUSCAR MATCHES CANDIDATOS PARA BYE
    // Solo matches PENDING (no WAITING_OPONENT) sin winner
    const { data: candidateMatches, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, round, order_in_round, status,
        tournament_couple_seed1_id,
        tournament_couple_seed2_id,
        seed1:tournament_couple_seeds!tournament_couple_seed1_id(id, couple_id, is_placeholder),
        seed2:tournament_couple_seeds!tournament_couple_seed2_id(id, couple_id, is_placeholder)
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'PENDING')
      .is('winner_id', null)
    
    if (matchError) {
      console.error('❌ [PROCESS-ALL-BYES] Error fetching matches:', matchError)
      throw matchError
    }
    
    if (!candidateMatches || candidateMatches.length === 0) {
      console.log(`📝 [PROCESS-ALL-BYES] No candidate matches found`)
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: 'No hay matches pendientes con BYE para procesar'
      })
    }

    console.log(`🔍 [PROCESS-ALL-BYES] Found ${candidateMatches.length} candidate matches`)

    const processedMatches: Array<{
      id: string
      round: string
      order_in_round: number
      winner: string
    }> = []

    // 2. PROCESAR CADA MATCH CANDIDATO
    for (const match of candidateMatches) {
      const seed1 = Array.isArray(match.seed1) ? match.seed1[0] : match.seed1
      const seed2 = Array.isArray(match.seed2) ? match.seed2[0] : match.seed2
      
      // Verificar que sea verdadero BYE estructural:
      // - Exactamente uno de los seeds existe Y tiene couple_id real
      // - El otro seed es completamente NULL (no es placeholder esperando)
      const hasRealSeed1 = seed1 && !seed1.is_placeholder && seed1.couple_id
      const hasRealSeed2 = seed2 && !seed2.is_placeholder && seed2.couple_id
      const hasNullSeed1 = !match.tournament_couple_seed1_id
      const hasNullSeed2 = !match.tournament_couple_seed2_id
      
      // BYE verdadero: uno real + otro completamente NULL
      const isTrueBye = (hasRealSeed1 && hasNullSeed2) || (hasRealSeed2 && hasNullSeed1)
      
      if (isTrueBye) {
        const winner = hasRealSeed1 ? seed1.couple_id : seed2.couple_id
        
        console.log(`🎯 [PROCESS-ALL-BYES] Processing BYE: ${match.round} ${match.order_in_round} - Winner: ${winner}`)
        
        // 3. MARCAR MATCH COMO FINISHED
        const { error: updateError } = await supabase
          .from('matches')
          .update({ 
            winner_id: winner, 
            status: 'FINISHED' 
          })
          .eq('id', match.id)
        
        if (updateError) {
          console.error(`❌ [PROCESS-ALL-BYES] Failed to finish match ${match.id}:`, updateError)
          continue
        }
        
        // 4. AVANZAR GANADOR USANDO LÓGICA EXISTENTE
        try {
          const { advanceWinnerUsingHierarchy } = await import('@/app/api/tournaments/actions')
          const advanceResult = await advanceWinnerUsingHierarchy(
            supabase,
            tournamentId,
            match.id,
            winner,
            'auto_bye'
          )
          
          if (advanceResult.success) {
            processedMatches.push({
              id: match.id,
              round: match.round,
              order_in_round: match.order_in_round,
              winner
            })
            console.log(`✅ [PROCESS-ALL-BYES] BYE processed and advanced: ${match.round} ${match.order_in_round}`)
          } else {
            console.warn(`⚠️ [PROCESS-ALL-BYES] BYE marked finished but advance failed: ${advanceResult.error}`)
          }
        } catch (advanceError) {
          console.error(`❌ [PROCESS-ALL-BYES] Error advancing winner:`, advanceError)
        }
      } else {
        console.log(`⏭️ [PROCESS-ALL-BYES] Skipping ${match.round} ${match.order_in_round} - Not a true BYE (hasReal1: ${hasRealSeed1}, hasReal2: ${hasRealSeed2}, hasNull1: ${hasNullSeed1}, hasNull2: ${hasNullSeed2})`)
      }
    }
    
    const processedCount = processedMatches.length
    console.log(`📊 [PROCESS-ALL-BYES] Processing complete: ${processedCount} BYEs processed`)
    
    return NextResponse.json({
      success: true,
      processedCount,
      message: `Procesados ${processedCount} BYEs automáticamente`,
      processedMatches
    })
    
  } catch (error) {
    console.error('❌ [PROCESS-ALL-BYES] Critical error:', error)
    return NextResponse.json({
      success: false,
      processedCount: 0,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}