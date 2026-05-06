// get-player-upcoming-tournaments
// 🚀 Edge Function optimizada para obtener próximos torneos disponibles
// Request:
//   - POST { playerId: string, categoryName?: string }
//   - or GET /get-player-upcoming-tournaments?playerId=<uuid>&categoryName=<string>
// Response:
//   { upcomingTournaments: UpcomingTournament[], error?: string }
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

console.info('get-player-upcoming-tournaments function started');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 204);
  }

  try {
    let playerId: string;
    let categoryName: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      playerId = url.searchParams.get('playerId') ?? "";
      categoryName = url.searchParams.get('categoryName');
    } else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        playerId = body.playerId;
        categoryName = body.categoryName || null;
      } else {
        return jsonResponse({
          upcomingTournaments: [],
          error: 'Invalid content-type'
        }, 400);
      }
    } else {
      return jsonResponse({
        upcomingTournaments: [],
        error: 'Method not allowed'
      }, 405);
    }

    if (!isUuid(playerId)) {
      return jsonResponse({
        upcomingTournaments: [],
        error: 'playerId inválido'
      }, 400);
    }

    // Step 1: Get player's couples to check existing inscriptions
    const { data: playerCouples, error: couplesError } = await supabase
      .from('couples')
      .select('id')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    if (couplesError) {
      console.error('Error fetching player couples:', couplesError);
      return jsonResponse({
        upcomingTournaments: [],
        error: 'Error al obtener parejas del jugador'
      }, 500);
    }

    const coupleIds = playerCouples?.map((c: any) => c.id) || [];

    // Step 2: Get already inscribed tournament IDs
    let inscribedTournamentIds: string[] = [];
    if (coupleIds.length > 0) {
      const { data: inscriptions, error: inscriptionsError } = await supabase
        .from('inscriptions')
        .select('tournament_id')
        .in('couple_id', coupleIds);

      if (!inscriptionsError && inscriptions) {
        inscribedTournamentIds = inscriptions.map((i: any) => i.tournament_id);
      }
    }

    // Step 3: Build query for upcoming tournaments
    let query = supabase
      .from('tournaments')
      .select(`
        id,
        name,
        start_date,
        end_date,
        status,
        category_name,
        gender,
        max_participants,
        description,
        price,
        clubes!inner(
          name,
          address
        )
      `)
      .in('status', ['NOT_STARTED' ])
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(10);

    // Filter by category if provided
    if (categoryName) {
      query = query.eq('category_name', categoryName);
    }

    const { data: tournaments, error: tournamentsError } = await query;

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      return jsonResponse({
        upcomingTournaments: [],
        error: 'Error al obtener torneos próximos'
      }, 500);
    }

    if (!tournaments || tournaments.length === 0) {
      return jsonResponse({
        upcomingTournaments: [],
        error: null
      });
    }

    // Step 4: Get inscription counts for each tournament
    const tournamentIds = tournaments.map((t: any) => t.id);
    const { data: inscriptionCounts, error: countsError } = await supabase
      .from('inscriptions')
      .select('tournament_id')
      .in('tournament_id', tournamentIds);

    // Create a map of tournament_id -> count
    const countMap: Record<string, number> = {};
    if (!countsError && inscriptionCounts) {
      inscriptionCounts.forEach((inscription: any) => {
        const tournamentId = inscription.tournament_id;
        countMap[tournamentId] = (countMap[tournamentId] || 0) + 1;
      });
    }

    // Step 5: Process tournament data
    const upcomingTournaments = tournaments.map((tournament: any) => {
      const club = Array.isArray(tournament.clubes)
        ? tournament.clubes[0]
        : tournament.clubes;

      const currentInscriptions = countMap[tournament.id] || 0;
      const isInscribed = inscribedTournamentIds.includes(tournament.id);
      const isFull = tournament.max_participants
        ? currentInscriptions >= tournament.max_participants
        : false;

      return {
        id: tournament.id,
        name: tournament.name,
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        status: tournament.status,
        category_name: tournament.category_name,
        gender: tournament.gender,
        max_participants: tournament.max_participants,
        current_inscriptions: currentInscriptions,
        description: tournament.description,
        price: tournament.price,
        is_inscribed: isInscribed,
        is_full: isFull,
        club: {
          name: club?.name || 'Sin club',
          address: club?.address || null
        }
      };
    });

    return jsonResponse({
      upcomingTournaments,
      error: null
    });

  } catch (err) {
    console.error('Unexpected error in get-player-upcoming-tournaments:', err);
    return jsonResponse({
      upcomingTournaments: [],
      error: 'Error inesperado al obtener torneos próximos'
    }, 500);
  }
});
