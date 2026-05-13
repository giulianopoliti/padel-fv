import { normalizePlayerDni } from "@/lib/utils/player-dni";
import { findExistingPlayerByIdentity } from "@/lib/utils/player-identity";

const ALLOWED_CREATE_PLAYER_ROLES = new Set([
  "CLUB",
  "PLAYER",
  "COACH",
  "ADMIN",
  "ORGANIZADOR",
]);

interface CreatePlayerForCoupleInput {
  tournamentId: string;
  playerData: {
    first_name: string;
    last_name: string;
    gender: string;
    dni?: string | null;
    phone?: string | null;
    forceCreateNew?: boolean;
  };
}

export async function createPlayerForCoupleService(
  supabase: any,
  { tournamentId, playerData }: CreatePlayerForCoupleInput,
): Promise<{
  success: boolean;
  playerId?: string;
  message: string;
}> {
  console.log(`[createPlayerForCouple] Creando jugador para pareja en torneo ${tournamentId}`, {
    playerData,
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuario no autenticado");
  }

  const { data: userRecord, error: roleError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (roleError) {
    console.error("[createPlayerForCouple] Error fetching user role:", roleError);
    throw new Error("No se pudo validar el rol del usuario");
  }

  const role = userRecord?.role ?? null;

  if (!role || !ALLOWED_CREATE_PLAYER_ROLES.has(role)) {
    throw new Error("No tienes permisos para crear jugadores para torneos");
  }

  console.log(`[createPlayerForCouple] Usuario autenticado: ${user.email}, Rol: ${role}`);

  const { data: genderData, error: genderError } = await supabase
    .from("tournaments")
    .select("gender")
    .eq("id", tournamentId)
    .single();

  if (genderError) {
    console.error("[createPlayerForCouple] Error fetching tournament gender:", genderError);
    throw new Error("No se pudo obtener información del torneo");
  }

  const tournamentGenderUpper = (genderData?.gender ?? "").toUpperCase();
  const playerGenderUpper = (playerData?.gender ?? "").toUpperCase();

  if (tournamentGenderUpper === "FEMALE" && playerGenderUpper !== "FEMALE") {
    return {
      success: false,
      message: "Es un torneo femenino, pero el jugador es de género masculino",
    };
  }

  const normalizedDni = normalizePlayerDni(playerData.dni);

  if (!playerData.forceCreateNew) {
    const existingPlayerResult = await findExistingPlayerByIdentity({
      supabase,
      firstName: playerData.first_name,
      lastName: playerData.last_name,
      dni: playerData.dni,
      gender: playerData.gender,
    });

    if (existingPlayerResult.error) {
      console.error("[createPlayerForCouple] Error al buscar jugador existente:", existingPlayerResult.error);
      throw new Error("Error al verificar jugador existente");
    }

    if (existingPlayerResult.player) {
      console.log(
        `[createPlayerForCouple] Reutilizando jugador existente por ${existingPlayerResult.matchedBy}:`,
        existingPlayerResult.player,
      );
      return {
        success: true,
        playerId: existingPlayerResult.player.id,
        message: "Jugador existente encontrado",
      };
    }
  }

  const { data: tournamentData, error: tournamentError } = await supabase
    .from("tournaments")
    .select(`
      category_name,
      club:club_id (
        id,
        name
      )
    `)
    .eq("id", tournamentId)
    .single();

  if (tournamentError) {
    console.error("[createPlayerForCouple] Error fetching tournament:", tournamentError);
    throw new Error("No se pudo obtener información del torneo");
  }

  console.log("[createPlayerForCouple] Datos del torneo:", tournamentData);

  const categoryName = tournamentData.category_name || "";
  console.log("[createPlayerForCouple] Nombre de categoría determinado:", categoryName);

  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select("lower_range")
    .eq("name", categoryName)
    .single();

  if (categoryError) {
    console.error("[createPlayerForCouple] Error fetching category:", categoryError);
    throw new Error("No se pudo obtener información de la categoría");
  }

  console.log("[createPlayerForCouple] Datos de la categoría:", categoryData);

  const newPlayerData = {
    first_name: playerData.first_name,
    last_name: playerData.last_name,
    gender: playerData.gender,
    dni: normalizedDni.dni,
    dni_is_temporary: normalizedDni.dniIsTemporary,
    phone: playerData.phone?.trim() || null,
    score: categoryData.lower_range ?? 0,
    category_name: categoryName,
    is_categorized: true,
    created_at: new Date().toISOString(),
  };

  console.log("[createPlayerForCouple] Datos para crear jugador:", newPlayerData);

  const { data: newPlayer, error: newPlayerError } = await supabase
    .from("players")
    .insert(newPlayerData)
    .select("id")
    .single();

  if (newPlayerError) {
    console.error("[createPlayerForCouple] Error creating new player:", newPlayerError);
    throw new Error("No se pudo crear el nuevo jugador");
  }

  console.log("[createPlayerForCouple] Nuevo jugador creado con ID:", newPlayer.id);

  return {
    success: true,
    playerId: newPlayer.id,
    message: "Jugador creado exitosamente",
  };
}
