// get-player-next-match
// 🚀 VERSIÓN MEJORADA: Maneja múltiples partidos próximos
// Request:
//   - POST { playerId: string }
//   - or GET /get-player-next-match?playerId=<uuid>
// Response:
//   { nextMatches: PlayerNextMatch[], error?: string }
//
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

// Create an admin client (uses RLS-bypassing service role)
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,authorization'
    }
  });
}

function isUuid(v: string) {
  if (!v) return false;
  // Simple UUID v4-ish check
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

console.info('get-player-next-match function started');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 204);
  }

  try {
    let playerId: string;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      playerId = url.searchParams.get('playerId') ?? undefined;
    } else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        playerId = body.playerId;
      } else {
        return jsonResponse({
          nextMatches: [],
          error: 'Invalid content-type'
        }, 400);
      }
    } else {
      return jsonResponse({
        nextMatches: [],
        error: 'Method not allowed'
      }, 405);
    }

    if (!isUuid(playerId)) {
      return jsonResponse({
        nextMatches: [],
        error: 'playerId inválido'
      }, 400);
    }

    // Step 1: Get all couples where this player participates
    const { data: playerCouples, error: couplesError } = await supabase
      .from('couples')
      .select('id, player1_id, player2_id')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    if (couplesError) {
      console.error('Error fetching player couples:', couplesError);
      return jsonResponse({
        nextMatches: [],
        error: 'Error al obtener parejas del jugador'
      }, 500);
    }

    if (!playerCouples || playerCouples.length === 0) {
      return jsonResponse({
        nextMatches: [],
        error: null
      });
    }

    const coupleIds = playerCouples.map((c: any) => c.id);

    // Step 2: Find ALL pending/in-progress matches (removed .limit(1))
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        round,
        couple1_id,
        couple2_id,
        created_at,
        club_id,
        match_club:clubes!club_id(
          name,
          address
        ),
        tournaments!inner(
          id,
          name,
          club_id,
          tournament_club:clubes!club_id(
            name,
            address
          )
        ),
        fecha_matches(
          scheduled_date,
          scheduled_start_time,
          court_assignment
        ),
        couple1:couples!couple1_id(
          id,
          player1:players!player1_id(
            id,
            first_name,
            last_name
          ),
          player2:players!player2_id(
            id,
            first_name,
            last_name
          )
        ),
        couple2:couples!couple2_id(
          id,
          player1:players!player1_id(
            id,
            first_name,
            last_name
          ),
          player2:players!player2_id(
            id,
            first_name,
            last_name
          )
        )
      `)
      .or(`couple1_id.in.(${coupleIds.join(',')}),couple2_id.in.(${coupleIds.join(',')})`)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .neq('tournaments.status', 'CANCELED')
      .neq('tournaments.is_draft', true)
      .order('created_at', { ascending: true });
      // 🚀 REMOVED .limit(1) to get ALL matches

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return jsonResponse({
        nextMatches: [],
        error: 'Error al obtener partidos'
      }, 500);
    }

    if (!matches || matches.length === 0) {
      return jsonResponse({
        nextMatches: [],
        error: null
      });
    }

    // Step 3: Process ALL matches data
    const nextMatches = matches.map((match: any) => {
      const isPlayerInCouple1 = coupleIds.includes(match.couple1_id);
      let opponentNames: string[] = [];
      let partnerName = '';

      if (isPlayerInCouple1) {
        const couple1 = match.couple1;
        const couple2 = match.couple2;
        
        opponentNames = [
          `${couple2.player1.first_name} ${couple2.player1.last_name}`,
          `${couple2.player2.first_name} ${couple2.player2.last_name}`
        ];
        
        const playerCouple = playerCouples.find((c: any) => c.id === match.couple1_id);
        const partnerId = playerCouple?.player1_id === playerId 
          ? playerCouple?.player2_id 
          : playerCouple?.player1_id;
        
        if (couple1.player1.id === partnerId) {
          partnerName = `${couple1.player1.first_name} ${couple1.player1.last_name}`;
        } else {
          partnerName = `${couple1.player2.first_name} ${couple1.player2.last_name}`;
        }
      } else {
        const couple1 = match.couple1;
        const couple2 = match.couple2;
        
        opponentNames = [
          `${couple1.player1.first_name} ${couple1.player1.last_name}`,
          `${couple1.player2.first_name} ${couple1.player2.last_name}`
        ];
        
        const playerCouple = playerCouples.find((c: any) => c.id === match.couple2_id);
        const partnerId = playerCouple?.player1_id === playerId 
          ? playerCouple?.player2_id 
          : playerCouple?.player1_id;
        
        if (couple2.player1.id === partnerId) {
          partnerName = `${couple2.player1.first_name} ${couple2.player1.last_name}`;
        } else {
          partnerName = `${couple2.player2.first_name} ${couple2.player2.last_name}`;
        }
      }

      // Extract scheduling information
      const fechaMatch = Array.isArray(match.fecha_matches) ? match.fecha_matches[0] : match.fecha_matches;
      const tournament = Array.isArray(match.tournaments) ? match.tournaments[0] : match.tournaments;

      // Priority: match club → tournament club
      const matchClub = Array.isArray(match.match_club) ? match.match_club[0] : match.match_club;
      const tournamentClub = tournament?.tournament_club
        ? (Array.isArray(tournament.tournament_club) ? tournament.tournament_club[0] : tournament.tournament_club)
        : null;

      const clubData = matchClub || tournamentClub;

      return {
        match_id: match.id,
        tournament_id: tournament?.id || '',
        tournament_name: tournament?.name || 'Sin nombre',
        club_name: clubData?.name || undefined,
        club_address: clubData?.address || undefined,
        opponent_names: opponentNames,
        partner_name: partnerName,
        round: match.round || undefined,
        scheduled_info: {
          date: fechaMatch?.scheduled_date || undefined,
          time: fechaMatch?.scheduled_start_time || undefined,
          court: fechaMatch?.court_assignment || undefined
        },
        status: match.status
      };
    });

    return jsonResponse({
      nextMatches,
      error: null
    });

  } catch (err) {
    console.error('Unexpected error in get-player-next-match:', err);
    return jsonResponse({
      nextMatches: [],
      error: 'Error inesperado al obtener próximos partidos'
    }, 500);
  }
});