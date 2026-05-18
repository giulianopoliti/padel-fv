import { categorizePlayerForTournament } from "@/lib/services/tournament-category-config"

/**
 * PLAYER CATEGORIZATION UTILITIES
 *
 * Funciones para categorizar jugadores según la configuración del torneo.
 * Centraliza la lógica en tournament-category-config para evitar divergencias.
 */

export async function checkAndCategorizePlayer(
  playerId: string,
  tournament: { category_name?: string | null; category_config?: unknown } | string,
  supabase: any,
) {
  const normalizedTournament =
    typeof tournament === "string"
      ? { category_name: tournament, category_config: null }
      : tournament

  return categorizePlayerForTournament({
    playerId,
    supabase,
    tournament: normalizedTournament,
  })
}
