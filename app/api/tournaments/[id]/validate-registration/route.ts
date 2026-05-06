/**
 * API endpoint to validate tournament registration using unified system
 * GET /api/tournaments/[id]/validate-registration
 */

import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await ctx.params;
    
    // Use the unified validation service
    const { TournamentValidationService } = await import('../../../../../lib/services/tournament-validation.service');
    
    const result = await TournamentValidationService.validateCoupleRegistration(tournamentId);
    
    return NextResponse.json({
      success: true,
      tournamentId,
      validation: result,
      timestamp: new Date().toISOString()
    }, { 
      status: 200 
    });
    
  } catch (error: any) {
    console.error('[validate-registration] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Validation error',
      tournamentId: (await ctx.params).id,
      timestamp: new Date().toISOString()
    }, { 
      status: 500 
    });
  }
}