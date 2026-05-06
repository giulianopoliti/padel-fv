import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TournamentRequest {
  clubId: string
  limit?: number
  statusFilter?: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[get-club-tournaments] Request received')
    const authHeader = req.headers.get('Authorization')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader! },
        },
      }
    )

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[get-club-tournaments] User authenticated:', user.id)

    const body: TournamentRequest = await req.json()
    const { clubId, limit, statusFilter } = body

    if (!clubId) {
      return new Response(
        JSON.stringify({ error: 'clubId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar permisos: el usuario debe estar asociado al club
    const { data: clubMember } = await supabaseClient
      .from('club_staff')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .single()

    if (!clubMember) {
      return new Response(
        JSON.stringify({ error: 'Sin permisos para acceder a este club' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[get-club-tournaments] Fetching tournaments...')

    // Query 1: Fetch torneos base
    let query = supabaseClient
      .from('tournaments')
      .select('id, name, status, pre_tournament_image_url, start_date, end_date, category_name, gender, type, is_draft')
      .eq('club_id', clubId)
      .eq('es_prueba', false)
      .order('created_at', { ascending: false })

    // Aplicar filtro de status si existe
    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter)
    }

    // Aplicar limit si existe
    if (limit) {
      query = query.limit(limit)
    }

    const { data: tournaments, error: tournamentsError } = await query

    if (tournamentsError) {
      console.error('[get-club-tournaments] Error fetching tournaments:', tournamentsError)
      throw tournamentsError
    }

    console.log('[get-club-tournaments] Found tournaments:', tournaments?.length || 0)
    console.log('[get-club-tournaments] Tournaments data:', JSON.stringify(tournaments, null, 2))

    // Query 2-5: Para cada torneo, fetch métricas EN PARALELO
    const tournamentsWithMetrics = await Promise.all(
      (tournaments || []).map(async (tournament) => {
        console.log(`[get-club-tournaments] Fetching metrics for: ${tournament.id}`)

        // 4 queries en paralelo por torneo
        const [inscriptionsResult, finishedResult, pendingResult, totalResult] = await Promise.all([
          // Count inscripciones
          supabaseClient
            .from('inscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id)
            .eq('es_prueba', false),

          // Count matches finalizados
          supabaseClient
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id)
            .eq('status', 'FINISHED')
            .eq('es_prueba', false),

          // Count matches pending/in_progress
          supabaseClient
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id)
            .in('status', ['PENDING', 'IN_PROGRESS'])
            .eq('es_prueba', false),

          // Count total matches
          supabaseClient
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id)
            .eq('es_prueba', false)
        ])

        const metrics = {
          inscriptions: inscriptionsResult.count || 0,
          matchesFinished: finishedResult.count || 0,
          matchesPending: pendingResult.count || 0,
          totalMatches: totalResult.count || 0,
        }

        console.log(`[get-club-tournaments] Metrics for ${tournament.id}:`, JSON.stringify(metrics))

        if (inscriptionsResult.error) console.error(`[get-club-tournaments] Error fetching inscriptions for ${tournament.id}:`, inscriptionsResult.error)
        if (finishedResult.error) console.error(`[get-club-tournaments] Error fetching finished matches for ${tournament.id}:`, finishedResult.error)
        if (pendingResult.error) console.error(`[get-club-tournaments] Error fetching pending matches for ${tournament.id}:`, pendingResult.error)
        if (totalResult.error) console.error(`[get-club-tournaments] Error fetching total matches for ${tournament.id}:`, totalResult.error)

        return {
          ...tournament,
          ...metrics
        }
      })
    )

    console.log('[get-club-tournaments] Metrics fetched for all tournaments')
    console.log('[get-club-tournaments] Final response:', JSON.stringify(tournamentsWithMetrics, null, 2))

    return new Response(
      JSON.stringify({
        success: true,
        tournaments: tournamentsWithMetrics,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[get-club-tournaments] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error al obtener torneos'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
