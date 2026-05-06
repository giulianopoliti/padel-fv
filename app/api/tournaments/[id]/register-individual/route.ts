import { createClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';
import { getUser } from '@/app/api/users';
import { Gender } from '@/types';

/**
 * 🎾 API ROUTE: REGISTRO DE JUGADOR INDIVIDUAL CON STRATEGY PATTERN
 *
 * ✅ BUENAS PRÁCTICAS:
 * - Serialización completa entre Server/Client
 * - Strategy Pattern encapsulado en API route
 * - Categorización automática funcionando
 * - Preparado para migración a Python backend
 *
 * ✅ ARQUITECTURA:
 * CLIENT → API Route → Strategy Pattern → Serialized Response
 */

interface RegisterIndividualRequest {
  playerId: string;
}

interface RegisterNewPlayerRequest {
  firstName: string;
  lastName: string;
  phone?: string; // ✅ OPCIONAL: No es campo requerido
  dni?: string | null;
  gender: 'MALE' | 'FEMALE' | 'MIXED';
  forceCreateNew?: boolean;
}

interface SerializedResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    playerId: string;
    inscriptionId: string;
    wasCategorized: boolean;
    newScore?: number;
    tournamentId: string;
  };
  meta: {
    timestamp: string;
    strategy: string;
    tournamentType: string;
  };
}

/**
 * 📝 POST /api/tournaments/[id]/register-individual
 *
 * Registra un jugador individual usando Strategy Pattern.
 * Soporta tanto jugadores existentes como nuevos.
 *
 * ✅ CASOS DE USO:
 * 1. Jugador existente: { playerId: "uuid" }
 * 2. Jugador nuevo: { firstName, lastName, dni, gender, phone?, forceCreateNew? }
 *
 * @param request - Request con datos del jugador
 * @param params - Route params con tournament ID
 * @returns Resultado serializado del registro
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const startTime = Date.now();
  let tournamentType = 'UNKNOWN';

  try {
    const resolvedParams = await params;
    const tournamentId = resolvedParams.id;
    const requestBody = await request.json();

    console.log(`🎾 [API] Iniciando registro individual - Torneo: ${tournamentId}`);

    // ========================================
    // VALIDACIÓN DE REQUEST
    // ========================================

    const isExistingPlayer = 'playerId' in requestBody;
    const isNewPlayer = 'firstName' in requestBody && 'lastName' in requestBody;

    if (!isExistingPlayer && !isNewPlayer) {
      return Response.json({
        success: false,
          error: 'Debe proporcionar playerId (jugador existente) o firstName/lastName/gender (jugador nuevo)',
        meta: {
          timestamp: new Date().toISOString(),
          strategy: 'validation_failed',
          tournamentType: 'UNKNOWN'
        }
      } as SerializedResponse, { status: 400 });
    }

    // ========================================
    // OBTENER CONTEXTO DEL TORNEO
    // ========================================

    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
      return Response.json({
        success: false,
        error: 'Usuario no autenticado',
        meta: {
          timestamp: new Date().toISOString(),
          strategy: 'auth_failed',
          tournamentType: 'UNKNOWN'
        }
      } as SerializedResponse, { status: 401 });
    }

    // Obtener datos del torneo
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, type, status, gender, category_name')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      console.error('[API] Error obteniendo torneo:', tournamentError);
      return Response.json({
        success: false,
        error: 'Torneo no encontrado',
        meta: {
          timestamp: new Date().toISOString(),
          strategy: 'tournament_not_found',
          tournamentType: 'UNKNOWN'
        }
      } as SerializedResponse, { status: 404 });
    }

    tournamentType = tournament.type;

    // ========================================
    // PROCESAR SEGÚN TIPO DE JUGADOR
    // ========================================

    console.log(`🚀 [API] Procesando ${isExistingPlayer ? 'jugador existente' : 'jugador nuevo'} para torneo tipo: ${tournamentType}`);

    let finalPlayerId: string;
    let wasCategorized = false;
    let newScore: number | undefined;

    if (isExistingPlayer) {
      // ✅ JUGADOR EXISTENTE: Usar Strategy Pattern directamente
      const { registerIndividualPlayer } = await import('@/lib/services/registration');

      const result = await registerIndividualPlayer({
        tournamentId: tournamentId,
        playerId: requestBody.playerId
      });

      if (!result.success) {
        return Response.json({
          success: false,
          error: result.error || 'Error registrando jugador existente',
          meta: {
            timestamp: new Date().toISOString(),
            strategy: `${tournamentType.toLowerCase()}_tournament_strategy`,
            tournamentType: tournamentType
          }
        } as SerializedResponse, { status: 400 });
      }

      finalPlayerId = requestBody.playerId;
      wasCategorized = result.wasCategorized || false;
      newScore = result.newScore;

    } else {
      // ✅ JUGADOR NUEVO: Usar función V2 mejorada (que usa Strategy internamente)
      const { registerNewPlayerForTournamentV2 } = await import('@/app/api/tournaments/actions');

      const newPlayerData = requestBody as RegisterNewPlayerRequest;

      const result = await registerNewPlayerForTournamentV2(
        tournamentId,
        newPlayerData.firstName,
        newPlayerData.lastName,
        newPlayerData.phone || '',
        newPlayerData.dni ?? null,
        newPlayerData.gender as Gender,
        !!newPlayerData.forceCreateNew
      );

      if (!result.success) {
        return Response.json({
          success: false,
          error: result.message || 'Error registrando jugador nuevo',
          meta: {
            timestamp: new Date().toISOString(),
            strategy: `${tournamentType.toLowerCase()}_tournament_strategy`,
            tournamentType: tournamentType
          }
        } as SerializedResponse, { status: 400 });
      }

      finalPlayerId = result.playerId!;
      wasCategorized = true; // Los jugadores nuevos siempre se categorizan
    }

    // ========================================
    // SERIALIZAR RESPUESTA
    // ========================================

    const processingTime = Date.now() - startTime;
    console.log(`✅ [API] Registro individual completado en ${processingTime}ms - Player: ${finalPlayerId}`);

    return Response.json({
      success: true,
      message: `Jugador ${isExistingPlayer ? 'existente' : 'nuevo'} registrado exitosamente${wasCategorized ? ' con categorización automática' : ''}`,
      data: {
        playerId: finalPlayerId,
        inscriptionId: 'N/A', // TODO: Retornar desde Strategy Pattern
        wasCategorized: wasCategorized,
        newScore: newScore,
        tournamentId: tournamentId
      },
      meta: {
        timestamp: new Date().toISOString(),
        strategy: `${tournamentType.toLowerCase()}_tournament_strategy`,
        tournamentType: tournamentType
      }
    } as SerializedResponse, { status: 201 });

  } catch (error) {
    console.error('❌ [API] Error inesperado en registro individual:', error);

    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      meta: {
        timestamp: new Date().toISOString(),
        strategy: 'internal_error',
        tournamentType: tournamentType
      }
    } as SerializedResponse, { status: 500 });
  }
}
