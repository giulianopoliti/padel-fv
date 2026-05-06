import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { buildPlayerSearchQuery } from '../_shared/search-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  searchTerm?: string
  page?: number
  pageSize?: number
  categoryFilter?: string
  organizationId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[Edge Function] Request received')
    const authHeader = req.headers.get('Authorization')
    console.log('[Edge Function] Auth header:', authHeader ? `Present (${authHeader.substring(0, 30)}...)` : 'MISSING')

    // Crear cliente de Supabase
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
      console.error('[Edge Function] No auth header - returning 401')
      return new Response(
        JSON.stringify({ error: 'No autenticado - falta header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Edge Function] Getting user from JWT...')
    // Verificar autenticación usando el JWT directamente
    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

    console.log('[Edge Function] User result:', { hasUser: !!user, userId: user?.id, error: authError?.message })

    if (!user) {
      console.error('[Edge Function] No user found - returning 401')
      return new Response(
        JSON.stringify({ error: 'No autenticado', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Edge Function] User authenticated successfully:', user.id)

    // Parse request body
    const body: SearchRequest = await req.json()
    const {
      searchTerm = '',
      page = 1,
      pageSize = 20,
      categoryFilter = 'all',
      organizationId
    } = body

    // Verificar que el usuario pertenece a la organización
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organizacion_id')
      .eq('user_id', user.id)
      .eq('organizacion_id', organizationId)
      .single()

    if (!orgMember) {
      return new Response(
        JSON.stringify({ error: 'Sin permisos para acceder a esta organización' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[search-players-organization] 🔍 Searching:', { searchTerm, organizationId, categoryFilter })

    // Paginación
    const from = (page - 1) * pageSize

    // ✅ Usar utility compartida con búsqueda por DNI ACTIVADA
    const { players: searchResults, total: totalCount } = await buildPlayerSearchQuery(
      supabaseClient,
      {
        searchTerm: searchTerm || undefined,
        organizadorId: organizationId,
        category: categoryFilter !== 'all' ? categoryFilter : null,
        includeTest: false,    // Panel CPA NO incluye jugadores de prueba
        requireScore: false,   // Panel CPA incluye jugadores SIN score
        searchDni: true        // ✅ Panel CPA SÍ busca por DNI
      },
      pageSize,
      from
    )

    console.log('[search-players-organization] ✅ Found:', searchResults.length, 'players (total:', totalCount, ')')

    // Obtener emails de usuarios (JOIN manual porque buildPlayerSearchQuery no lo incluye)
    const playerIds = searchResults.map((p: any) => p.id)
    let playersWithEmails = searchResults

    if (playerIds.length > 0) {
      const { data: usersData } = await supabaseClient
        .from('players')
        .select('id, users!players_user_id_fkey(email)')
        .in('id', playerIds)

      if (usersData) {
        playersWithEmails = searchResults.map((player: any) => {
          const userData = usersData.find((u: any) => u.id === player.id)
          return {
            ...player,
            users: userData?.users || null
          }
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        players: playersWithEmails,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in search-players-organization:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error al buscar jugadores'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
