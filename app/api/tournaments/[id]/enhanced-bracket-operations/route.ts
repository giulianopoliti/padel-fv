import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// ============================================================================
// TYPES
// ============================================================================

interface BracketOperation {
  operationId: string
  operationType: 'swap' | 'move-to-empty' | 'move-to-placeholder'
  sourceItem: {
    sourceMatchId: string
    sourceSlot: 'slot1' | 'slot2'
    sourceRound: string
    coupleId: string
    coupleName: string
  }
  targetSlot: {
    matchId: string
    slot: 'slot1' | 'slot2'
    round: string
  }
  targetCouple?: {
    coupleId: string
    coupleName: string
  } | null
  targetPlaceholder?: {
    originalLabel: string
    sourceMatchId?: string
  } | null
  createdAt: string
}

interface EnhancedBracketOperationsRequest {
  operations: BracketOperation[]
}

interface OperationResult {
  operationId: string
  operationType: string
  success: boolean
  error?: string
  details?: any
}

interface EnhancedBracketOperationsResponse {
  success: boolean
  processedOperations: number
  failedOperations: number
  results: OperationResult[]
  errors: string[]
  duration: number
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<EnhancedBracketOperationsResponse>> {
  const startTime = performance.now()
  
  try {
    const { id: tournamentId } = await params
    const body: EnhancedBracketOperationsRequest = await request.json()
    
    console.log(`🚀 [Enhanced Bracket Operations] Processing ${body.operations?.length || 0} operations for tournament ${tournamentId}`)
    
    // ✅ BASIC INPUT VALIDATION
    if (!body.operations || !Array.isArray(body.operations) || body.operations.length === 0) {
      return NextResponse.json({
        success: false,
        processedOperations: 0,
        failedOperations: 0,
        results: [],
        errors: ['No operations provided or invalid format'],
        duration: performance.now() - startTime
      }, { status: 400 })
    }

    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // ✅ AUTHENTICATION
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        processedOperations: 0,
        failedOperations: 0,
        results: [],
        errors: ['Unauthorized'],
        duration: performance.now() - startTime
      }, { status: 401 })
    }

    // ✅ PROCESS OPERATIONS ONE BY ONE
    const results: OperationResult[] = []
    let processedOperations = 0
    let failedOperations = 0
    const errors: string[] = []

    for (const operation of body.operations) {
      try {
        console.log(`🔄 [Enhanced Bracket Operations] Processing ${operation.operationType} operation: ${operation.operationId}`)
        
        const result = await processOperation(supabase, tournamentId, user.id, operation)
        
        if (result.success) {
          processedOperations++
          console.log(`✅ [Enhanced Bracket Operations] ${operation.operationType} successful: ${operation.operationId}`)
        } else {
          failedOperations++
          errors.push(`${operation.operationId}: ${result.error}`)
          console.log(`❌ [Enhanced Bracket Operations] ${operation.operationType} failed: ${operation.operationId} - ${result.error}`)
        }
        
        results.push(result)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        failedOperations++
        errors.push(`${operation.operationId}: ${errorMessage}`)
        
        results.push({
          operationId: operation.operationId,
          operationType: operation.operationType,
          success: false,
          error: errorMessage
        })
        
        console.error(`🚨 [Enhanced Bracket Operations] Operation ${operation.operationId} crashed:`, error)
      }
    }

    const duration = performance.now() - startTime
    const overallSuccess = failedOperations === 0

    console.log(`🏁 [Enhanced Bracket Operations] Completed: ${processedOperations} success, ${failedOperations} failed (${duration.toFixed(2)}ms)`)

    return NextResponse.json({
      success: overallSuccess,
      processedOperations,
      failedOperations,
      results,
      errors,
      duration
    }, { status: overallSuccess ? 200 : 207 }) // 207 Multi-Status for partial success

  } catch (error) {
    console.error('🚨 [Enhanced Bracket Operations] Critical error:', error)
    return NextResponse.json({
      success: false,
      processedOperations: 0,
      failedOperations: 0,
      results: [],
      errors: ['Internal server error'],
      duration: performance.now() - startTime
    }, { status: 500 })
  }
}

// ============================================================================
// OPERATION PROCESSOR
// ============================================================================

async function processOperation(
  supabase: any,
  tournamentId: string,
  userId: string,
  operation: BracketOperation
): Promise<OperationResult> {
  
  // Convert slot format for RPC calls (slot1 -> couple1_id, slot2 -> couple2_id)
  const sourceSlot = operation.sourceItem.sourceSlot === 'slot1' ? 'couple1_id' : 'couple2_id'
  const targetSlot = operation.targetSlot.slot === 'slot1' ? 'couple1_id' : 'couple2_id'
  
  switch (operation.operationType) {
    case 'swap':
      return await processSwapOperation(
        supabase,
        tournamentId,
        userId,
        operation,
        sourceSlot,
        targetSlot
      )
      
    case 'move-to-empty':
      return await processMoveToEmptyOperation(
        supabase,
        tournamentId,
        userId,
        operation,
        sourceSlot,
        targetSlot
      )
      
    case 'move-to-placeholder':
      return await processMoveToPlaceholderOperation(
        supabase,
        tournamentId,
        userId,
        operation,
        sourceSlot,
        targetSlot
      )
      
    default:
      return {
        operationId: operation.operationId,
        operationType: operation.operationType,
        success: false,
        error: `Unknown operation type: ${operation.operationType}`
      }
  }
}

// ============================================================================
// RPC HANDLERS
// ============================================================================

/**
 * Handle swap operations (couple to couple)
 * Uses existing swap_bracket_positions_atomic RPC
 */
async function processSwapOperation(
  supabase: any,
  tournamentId: string,
  userId: string,
  operation: BracketOperation,
  sourceSlot: string,
  targetSlot: string
): Promise<OperationResult> {
  
  const { data: result, error: rpcError } = await supabase.rpc('swap_bracket_positions_atomic', {
    p_tournament_id: tournamentId,
    p_user_id: userId,
    p_source_match_id: operation.sourceItem.sourceMatchId,
    p_target_match_id: operation.targetSlot.matchId,
    p_source_slot: sourceSlot,
    p_target_slot: targetSlot,
    p_operation_id: operation.operationId
  })

  if (rpcError) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: `RPC Error: ${rpcError.message}`,
      details: rpcError
    }
  }

  if (!result || !result.success) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: result?.error || 'Swap operation failed',
      details: result?.details
    }
  }

  return {
    operationId: operation.operationId,
    operationType: operation.operationType,
    success: true,
    details: result.details
  }
}

/**
 * Handle move to empty slot operations
 * Uses couple_to_empty_swap RPC
 */
async function processMoveToEmptyOperation(
  supabase: any,
  tournamentId: string,
  userId: string,
  operation: BracketOperation,
  sourceSlot: string,
  targetSlot: string
): Promise<OperationResult> {
  
  const { data: result, error: rpcError } = await supabase.rpc('couple_to_empty_swap', {
    p_tournament_id: tournamentId,
    p_user_id: userId,
    p_source_match_id: operation.sourceItem.sourceMatchId,
    p_target_match_id: operation.targetSlot.matchId,
    p_source_slot: sourceSlot,
    p_target_slot: targetSlot,
    p_operation_id: operation.operationId
  })

  if (rpcError) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: `RPC Error: ${rpcError.message}`,
      details: rpcError
    }
  }

  if (!result || !result.success) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: result?.error || 'Move to empty operation failed',
      details: result?.details
    }
  }

  return {
    operationId: operation.operationId,
    operationType: operation.operationType,
    success: true,
    details: result.details
  }
}

/**
 * Handle move to placeholder operations
 * Uses couple_to_placeholder_swap RPC
 */
async function processMoveToPlaceholderOperation(
  supabase: any,
  tournamentId: string,
  userId: string,
  operation: BracketOperation,
  sourceSlot: string,
  targetSlot: string
): Promise<OperationResult> {
  
  const { data: result, error: rpcError } = await supabase.rpc('couple_to_placeholder_swap', {
    p_tournament_id: tournamentId,
    p_user_id: userId,
    p_source_match_id: operation.sourceItem.sourceMatchId,
    p_source_slot: sourceSlot,
    p_source_couple_id: operation.sourceItem.coupleId, // ✅ FIXED: Add required coupleId parameter
    p_target_match_id: operation.targetSlot.matchId,
    p_target_slot: targetSlot,
    p_operation_id: operation.operationId
    // ✅ FIXED: Remove placeholder parameters - RPC gets them internally
  })

  if (rpcError) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: `RPC Error: ${rpcError.message}`,
      details: rpcError
    }
  }

  if (!result || !result.success) {
    return {
      operationId: operation.operationId,
      operationType: operation.operationType,
      success: false,
      error: result?.error || 'Move to placeholder operation failed',
      details: result?.details
    }
  }

  return {
    operationId: operation.operationId,
    operationType: operation.operationType,
    success: true,
    details: result.details
  }
}