import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { serialize } from '@/utils/serialization';

/**
 * GET /api/tournaments/[id]/all-zone-positions
 * 
 * Returns saved zone positions for all zones in a tournament
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  
  try {
    const { id: tournamentId } = await params;

    // Fetch all saved zone positions with couple and player details
    const { data: positions, error } = await supabase
      .from('zone_positions')
      .select(`
        *,
        couple:couples!zone_positions_couple_id_fkey(
          id,
          player1_id,
          player2_id,
          player1:players!couples_player1_id_fkey(id, first_name, last_name, score),
          player2:players!couples_player2_id_fkey(id, first_name, last_name, score)
        ),
        zone:zones!zone_positions_zone_id_fkey(id, name)
      `)
      .eq('tournament_id', tournamentId)
      .order('zone_id')
      .order('position');

    if (error) {
      return NextResponse.json(
        { success: false, error: `Error fetching positions: ${error.message}` },
        { status: 500 }
      );
    }

    // Group positions by zone
    const positionsByZone = (positions || []).reduce((acc, position) => {
      const zoneId = position.zone_id;
      const zoneName = position.zone?.name || `Zona ${zoneId}`;
      
      if (!acc[zoneId]) {
        acc[zoneId] = {
          zoneId,
          zoneName,
          positions: []
        };
      }

      // Extract player details safely
      const couple = position.couple;
      const player1 = Array.isArray(couple?.player1) ? couple.player1[0] : couple?.player1;
      const player2 = Array.isArray(couple?.player2) ? couple.player2[0] : couple?.player2;

      acc[zoneId].positions.push({
        coupleId: position.couple_id,
        position: position.position,
        player1Name: `${player1?.first_name || ''} ${player1?.last_name || ''}`.trim(),
        player2Name: `${player2?.first_name || ''} ${player2?.last_name || ''}`.trim(),
        player1Score: player1?.score || 0,
        player2Score: player2?.score || 0,
        totalPlayerScore: position.player_score_total,
        matchesWon: position.wins,
        matchesLost: position.losses,
        matchesPlayed: position.wins + position.losses,
        setsWon: 0, // Not stored separately
        setsLost: 0, // Not stored separately
        setsDifference: 0, // Not stored separately
        gamesWon: position.games_for,
        gamesLost: position.games_against,
        gamesDifference: position.games_difference,
        positionTieInfo: position.tie_info,
        calculatedAt: position.calculated_at
      });

      return acc;
    }, {} as Record<string, any>);

    // Convert to array format
    const zonesWithPositions = Object.values(positionsByZone);

    return NextResponse.json(serialize({
      success: true,
      data: {
        tournamentId,
        totalZones: zonesWithPositions.length,
        totalPositions: positions?.length || 0,
        zones: zonesWithPositions,
        lastUpdated: positions?.[0]?.calculated_at || null
      }
    }));

  } catch (error: any) {
    console.error('[ALL-ZONE-POSITIONS] Error fetching positions:', error);
    return NextResponse.json(
      serialize({ 
        success: false, 
        error: error.message || 'Error fetching all zone positions' 
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/[id]/all-zone-positions
 * 
 * Recalculates and saves positions for all zones in a tournament
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { forceRecalculate = true } = body as {
      forceRecalculate?: boolean;
    };

    // Get all zones for this tournament
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId);

    if (zonesError) {
      return NextResponse.json(
        { success: false, error: `Error fetching zones: ${zonesError.message}` },
        { status: 500 }
      );
    }

    if (!zones || zones.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No zones found for this tournament'
      });
    }

    const results = [];
    const errors = [];

    // Process each zone
    for (const zone of zones) {
      try {
        // Create a new request for each zone
        const zoneRequest = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({
            zoneId: zone.id,
            forceRecalculate
          })
        });

        // Import the zone-positions route handler
        const { POST: ZonePositionsPOST } = await import('../zone-positions/route');
        const zoneResponse = await ZonePositionsPOST(zoneRequest, { params });
        const zoneResult = await zoneResponse.json();

        if (zoneResult.success) {
          results.push({
            zoneId: zone.id,
            zoneName: zone.name,
            success: true,
            savedPositions: zoneResult.data?.savedPositions || 0
          });
        } else {
          errors.push({
            zoneId: zone.id,
            zoneName: zone.name,
            error: zoneResult.error
          });
        }
      } catch (error: any) {
        errors.push({
          zoneId: zone.id,
          zoneName: zone.name,
          error: error.message
        });
      }
    }

    const hasErrors = errors.length > 0;

    return NextResponse.json(serialize({
      success: !hasErrors || results.length > 0, // Success if at least some zones processed
      data: {
        tournamentId,
        processedZones: results.length,
        totalZones: zones.length,
        results,
        errors: hasErrors ? errors : undefined
      }
    }), { 
      status: hasErrors && results.length === 0 ? 500 : 200 
    });

  } catch (error: any) {
    console.error('[ALL-ZONE-POSITIONS] Error recalculating all positions:', error);
    return NextResponse.json(
      serialize({ 
        success: false, 
        error: error.message || 'Error recalculating all zone positions' 
      }),
      { status: 500 }
    );
  }
}