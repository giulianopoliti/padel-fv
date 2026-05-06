// get-player-inscribed-tournaments
// 🚀 Edge Function optimizada para obtener torneos inscritos del jugador
// Request:
//   - POST { playerId: string }
//   - or GET /get-player-inscribed-tournaments?playerId=<uuid>
// Response:
//   { inscribedTournaments: InscribedTournament[], error?: string }
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
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

console.info('get-player-inscribed-tournaments function started');

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
          inscribedTournaments: [],
          error: 'Invalid content-type'
        }, 400);
      }
    } else {
      return jsonResponse({
        inscribedTournaments: [],
        error: 'Method not allowed'
      }, 405);
    }

    if (!isUuid(playerId)) {
      return jsonResponse({
        inscribedTournaments: [],
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
        inscribedTournaments: [],
        error: 'Error al obtener parejas del jugador'
      }, 500);
    }

    if (!playerCouples || playerCouples.length === 0) {
      return jsonResponse({
        inscribedTournaments: [],
        error: null
      });
    }

    const coupleIds = playerCouples.map((c: any) => c.id);

    // Step 2: Get inscriptions with full tournament and partner data
    const { data: inscriptions, error: inscriptionsError } = await supabase
      .from('inscriptions')
      .select(`
        id,
        couple_id,
        tournament_id,
        created_at,
        is_eliminated,
        tournaments!inner(
          id,
          name,
          start_date,
          end_date,
          status,
          category_name,
          gender,
          clubes!inner(
            name,
            address
          )
        ),
        couples!inner(
          id,
          player1:players!player1_id(
            id,
            first_name,
            last_name,
            profile_image_url
          ),
          player2:players!player2_id(
            id,
            first_name,
            last_name,
            profile_image_url
          )
        )
      `)
      .in('couple_id', coupleIds)
      .eq('is_eliminated', false)
      .in('tournaments.status', ['NOT_STARTED', 'ZONE_PHASE', 'BRACKET_PHASE'])
      .neq('tournaments.is_draft', true)
      .order('tournaments(start_date)', { ascending: false });

    if (inscriptionsError) {
      console.error('Error fetching inscriptions:', inscriptionsError);
      return jsonResponse({
        inscribedTournaments: [],
        error: 'Error al obtener inscripciones'
      }, 500);
    }

    if (!inscriptions || inscriptions.length === 0) {
      return jsonResponse({
        inscribedTournaments: [],
        error: null
      });
    }

    // Step 3: Process inscriptions data
    const inscribedTournaments = inscriptions.map((inscription: any) => {
      const tournament = Array.isArray(inscription.tournaments)
        ? inscription.tournaments[0]
        : inscription.tournaments;

      const couple = Array.isArray(inscription.couples)
        ? inscription.couples[0]
        : inscription.couples;

      // Determine partner (the other player in the couple)
      const isPlayer1 = couple.player1.id === playerId;
      const partner = isPlayer1 ? couple.player2 : couple.player1;
      const currentPlayer = isPlayer1 ? couple.player1 : couple.player2;

      const club = Array.isArray(tournament.clubes)
        ? tournament.clubes[0]
        : tournament.clubes;

      return {
        inscription_id: inscription.id,
        couple_id: inscription.couple_id,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          status: tournament.status,
          category_name: tournament.category_name,
          gender: tournament.gender,
          club: {
            name: club?.name || 'Sin club',
            address: club?.address || null
          }
        },
        partner: {
          id: partner.id,
          first_name: partner.first_name,
          last_name: partner.last_name,
          profile_image_url: partner.profile_image_url
        },
        current_player: {
          id: currentPlayer.id,
          first_name: currentPlayer.first_name,
          last_name: currentPlayer.last_name,
          profile_image_url: currentPlayer.profile_image_url
        }
      };
    });

    return jsonResponse({
      inscribedTournaments,
      error: null
    });

  } catch (err) {
    console.error('Unexpected error in get-player-inscribed-tournaments:', err);
    return jsonResponse({
      inscribedTournaments: [],
      error: 'Error inesperado al obtener torneos inscritos'
    }, 500);
  }
});
