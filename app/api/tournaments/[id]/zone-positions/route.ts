import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { ZoneStatsCalculator, ZoneRankingEngine } from '@/lib/services/zone-position';
import { serialize } from '@/utils/serialization';
import type { CoupleData, MatchData } from '@/lib/services/zone-position/types';

/**
 * GET /api/tournaments/[id]/zone-positions?zoneId=<zoneId>
 * 
 * Calculates and returns current positions for couples in a specific zone
 * using the new ranking algorithm.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  
  try {
    const { id: tournamentId } = await params;
    const url = new URL(request.url);
    const zoneId = url.searchParams.get('zoneId');
    
    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'zoneId parameter is required' },
        { status: 400 }
      );
    }

    // 1. Fetch couples in the zone with player details and scores
    const { data: couples, error: couplesError } = await supabase
      .from('zone_couples')
      .select(`
        couple_id,
        couples!zone_couples_couple_id_fkey(
          id,
          player1_id,
          player2_id,
          player1:players!couples_player1_id_fkey(id, first_name, last_name, score),
          player2:players!couples_player2_id_fkey(id, first_name, last_name, score)
        )
      `)
      .eq('zone_id', zoneId);

    if (couplesError) {
      return NextResponse.json(
        { success: false, error: `Error fetching couples: ${couplesError.message}` },
        { status: 500 }
      );
    }

    if (!couples || couples.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          zoneId,
          positions: [],
          message: 'No couples found in this zone'
        }
      });
    }

    // 2. Fetch finished matches for this zone
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        couple1_id,
        couple2_id,
        result_couple1,
        result_couple2,
        winner_id,
        status,
        zone_id
      `)
      .eq('zone_id', zoneId)
      .eq('tournament_id', tournamentId)
      .eq('status', 'FINISHED')
      .not('result_couple1', 'is', null)
      .not('result_couple2', 'is', null);

    if (matchesError) {
      return NextResponse.json(
        { success: false, error: `Error fetching matches: ${matchesError.message}` },
        { status: 500 }
      );
    }

    // 3. Transform data to match our types
    const coupleData: CoupleData[] = couples.map(zoneCouple => {
      const couple = Array.isArray(zoneCouple.couples) ? zoneCouple.couples[0] : zoneCouple.couples;
      return {
        id: couple.id,
        player1_id: couple.player1_id,
        player2_id: couple.player2_id,
        player1: Array.isArray(couple.player1) ? couple.player1[0] : couple.player1,
        player2: Array.isArray(couple.player2) ? couple.player2[0] : couple.player2
      };
    });

    const matchData: MatchData[] = (matches || []).map(match => ({
      id: match.id,
      couple1_id: match.couple1_id,
      couple2_id: match.couple2_id,
      result_couple1: match.result_couple1,
      result_couple2: match.result_couple2,
      winner_id: match.winner_id,
      status: match.status as 'FINISHED',
      zone_id: match.zone_id
    }));

    // 4. Calculate positions using our ranking system
    const calculator = new ZoneStatsCalculator();
    const engine = new ZoneRankingEngine();

    const coupleStats = calculator.calculateAllCoupleStats(coupleData, matchData);
    const headToHeadMatrix = calculator.createHeadToHeadMatrix(coupleData, matchData);
    const rankedCouples = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix);

    // 5. Validate ranking
    const isValidRanking = engine.validateRanking(rankedCouples);
    
    if (!isValidRanking) {
      console.error(`[ZONE-POSITIONS] Invalid ranking generated for zone ${zoneId}`);
    }

    return NextResponse.json(serialize({
      success: true,
      data: {
        zoneId,
        tournamentId,
        positions: rankedCouples,
        metadata: {
          totalCouples: coupleData.length,
          totalMatches: matchData.length,
          isValidRanking,
          calculatedAt: new Date().toISOString()
        }
      }
    }));

  } catch (error: any) {
    console.error('[ZONE-POSITIONS] Error calculating positions:', error);
    return NextResponse.json(
      serialize({ 
        success: false, 
        error: error.message || 'Error calculating zone positions' 
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/[id]/zone-positions
 * 
 * Saves calculated positions to the zone_positions table
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { zoneId, forceRecalculate = false } = body as {
      zoneId: string;
      forceRecalculate?: boolean;
    };

    if (!zoneId) {
      return NextResponse.json(
        { success: false, error: 'zoneId is required' },
        { status: 400 }
      );
    }

    // Create a new request with zoneId as query parameter for GET endpoint
    const getUrl = new URL(request.url);
    getUrl.searchParams.set('zoneId', zoneId);
    
    const getRequest = new Request(getUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
    
    const getResponse = await GET(getRequest, { params });
    const getResult = await getResponse.json();
    
    if (!getResult.success) {
      return NextResponse.json(getResult, { status: 500 });
    }

    const { positions } = getResult.data;

    if (!positions || positions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No positions to save - zone has no couples'
      });
    }

    // Prepare data for insertion/update
    const positionRecords = positions.map((position: any) => ({
      tournament_id: tournamentId,
      zone_id: zoneId,
      couple_id: position.coupleId,
      position: position.position,
      is_definitive: true,
      points: position.points || 0,
      wins: position.matchesWon,
      losses: position.matchesLost,
      games_for: position.gamesWon,
      games_against: position.gamesLost,
      games_difference: position.gamesDifference,
      player_score_total: position.totalPlayerScore,
      tie_info: position.positionTieInfo,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Delete existing records for this zone if force recalculate
    if (forceRecalculate) {
      const { error: deleteError } = await supabase
        .from('zone_positions')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('zone_id', zoneId);

      if (deleteError) {
        return NextResponse.json(
          { success: false, error: `Error clearing existing positions: ${deleteError.message}` },
          { status: 500 }
        );
      }
    }

    // Insert new positions using upsert
    const { data: savedPositions, error: saveError } = await supabase
      .from('zone_positions')
      .upsert(positionRecords, {
        onConflict: 'tournament_id,zone_id,couple_id'
      })
      .select();

    if (saveError) {
      return NextResponse.json(
        { success: false, error: `Error saving positions: ${saveError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(serialize({
      success: true,
      data: {
        zoneId,
        tournamentId,
        savedPositions: savedPositions?.length || 0,
        positions: savedPositions
      }
    }));

  } catch (error: any) {
    console.error('[ZONE-POSITIONS] Error saving positions:', error);
    return NextResponse.json(
      serialize({ 
        success: false, 
        error: error.message || 'Error saving zone positions' 
      }),
      { status: 500 }
    );
  }
}