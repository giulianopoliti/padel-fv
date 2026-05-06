import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { buildPlayerSearchQuery } from '../_shared/search-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  searchTerm?: string
  tournamentId: string
  page?: number
  pageSize?: number
}

/**
 * 🎯 EDGE FUNCTION: BÚSQUEDA DE JUGADORES PARA INSCRIPCIONES
 *
 * Endpoint público/autenticado (según torneo) para buscar jugadores
 * disponibles para inscribir en un torneo.
 *
 * Características:
 * - ✅ Búsqueda por nombre completo ("Giuliano Politi")
 * - ✅ Búsqueda por DNI normalizado ("12345678" → "12.345.678")
 * - ✅ Normalización de acentos ("María" = "maria")
 * - ✅ Filtrado por género del torneo
 * - ✅ Incluye jugadores SIN score (nuevos jugadores)
 * - ✅ Excluye jugadores de prueba
 *
 * Uso:
 * - Inscripciones modo jugador
 * - Inscripciones modo club
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[search-tournament-players] 📥 Request received')

    // Crear cliente de Supabase (público)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parse request body
    const body: SearchRequest = await req.json()
    const {
      searchTerm = '',
      tournamentId,
      page = 1,
      pageSize = 50
    } = body

    console.log('[search-tournament-players] 🔍 Search params:', {
      searchTerm,
      tournamentId,
      page,
      pageSize
    })

    // Validar parámetros
    if (!tournamentId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'tournamentId es requerido'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Obtener género del torneo para filtrar jugadores
    const { data: tournament, error: tournamentError } = await supabaseClient
      .from('tournaments')
      .select('gender, type')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      console.error('[search-tournament-players] ❌ Tournament error:', tournamentError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Torneo no encontrado'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    console.log('[search-tournament-players] 🏆 Tournament:', {
      gender: tournament.gender,
      type: tournament.type
    })

    const offset = (page - 1) * pageSize

    // Determinar filtro de género según tipo de torneo:
    // - MIXED: todos los géneros permitidos
    // - MALE: permite MALE y FEMALE (mujeres pueden jugar torneos masculinos)
    // - FEMALE: solo jugadoras femeninas
    let genderFilter: typeof tournament.gender | undefined;

    if (tournament.gender === 'MIXED' || tournament.gender === 'MALE') {
      genderFilter = undefined; // Permite todos los géneros
    } else {
      genderFilter = tournament.gender; // Solo FEMALE para torneos femeninos
    }

    console.log('[search-tournament-players] 🎯 Gender filter:', genderFilter || 'NONE (allows all genders)')

    // ✅ Usar utility compartida con búsqueda por DNI activada
    const { players, total } = await buildPlayerSearchQuery(
      supabaseClient,
      {
        searchTerm,
        gender: genderFilter,
        includeTest: false,    // Inscripciones NO incluyen jugadores de prueba
        requireScore: false,   // Inscripciones permiten jugadores SIN score (nuevos)
        searchDni: true        // ✅ ACTIVAR búsqueda por DNI
      },
      pageSize,
      offset
    )

    console.log('[search-tournament-players] ✅ Found:', players.length, 'players (total:', total, ')')

    // Transformar datos al formato esperado por frontend
    const formattedPlayers = players.map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      dni: p.dni,
      score: p.score,
      category_name: p.category_name,
      profile_image_url: p.profile_image_url,
      club_name: p.clubes?.name || null,
      organizador_name: p.organizaciones?.name || null,
      gender: p.gender
    }))

    return new Response(
      JSON.stringify({
        success: true,
        players: formattedPlayers,
        total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        pageSize
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[search-tournament-players] ❌ Error:', error)
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
