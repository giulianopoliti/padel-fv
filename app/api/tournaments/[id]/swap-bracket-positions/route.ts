import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface SwapBracketPositionsRequest {
  sourceMatchId: string
  targetMatchId: string
  sourceSlot: 'couple1_id' | 'couple2_id'
  targetSlot: 'couple1_id' | 'couple2_id'
  operationId: string
}

interface SwapOperationResult {
  success: boolean
  operationId: string
  error?: string
  details?: {
    sourceMatch?: any
    targetMatch?: any
    swappedCouples?: {
      source: string | null
      target: string | null
    }
  } | string | any
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SwapOperationResult>> {
  try {
    const { id: tournamentId } = await params
    const body: SwapBracketPositionsRequest = await request.json()
    
    const { sourceMatchId, targetMatchId, sourceSlot, targetSlot, operationId } = body

    // 🔍 BASIC INPUT VALIDATION ONLY
    // All business logic validation is now handled in the atomic RPC function
    if (!sourceMatchId || !targetMatchId || !sourceSlot || !targetSlot || !operationId) {
      return NextResponse.json({
        success: false,
        operationId,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Validate slot format
    if (!['couple1_id', 'couple2_id'].includes(sourceSlot) || 
        !['couple1_id', 'couple2_id'].includes(targetSlot)) {
      return NextResponse.json({
        success: false,
        operationId,
        error: 'Invalid slot format - must be couple1_id or couple2_id'
      }, { status: 400 })
    }

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // 🔐 AUTHENTICATION ONLY - Authorization handled in RPC
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        operationId,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // 🚀 ATOMIC OPERATION - All validation and swap in single transaction
    const { data: result, error: rpcError } = await supabase.rpc('swap_bracket_positions_atomic', {
      p_tournament_id: tournamentId,
      p_user_id: user.id,
      p_source_match_id: sourceMatchId,
      p_target_match_id: targetMatchId,
      p_source_slot: sourceSlot,
      p_target_slot: targetSlot,
      p_operation_id: operationId
    })

    if (rpcError) {
      console.error('🚨 RPC Error:', rpcError)
      return NextResponse.json({
        success: false,
        operationId,
        error: 'Database operation failed',
        details: rpcError.message
      }, { status: 500 })
    }

    if (!result || !result.success) {
      // Business logic validation failed - return specific error
      const statusCode = result?.error?.includes('permissions') ? 403 : 
                        result?.error?.includes('not found') ? 404 : 400
      
      return NextResponse.json({
        success: false,
        operationId,
        error: result?.error || 'Operation failed',
        details: result?.details || null
      }, { status: statusCode })
    }

    // ✅ SUCCESS - Operation completed atomically
    console.log(`✅ Swap successful: ${operationId}`, result.details)
    
    return NextResponse.json({
      success: true,
      operationId,
      details: result.details
    })

  } catch (error) {
    console.error('🚨 Swap bracket positions error:', error)
    return NextResponse.json({
      success: false,
      operationId: 'unknown',
      error: 'Internal server error'
    }, { status: 500 })
  }
}