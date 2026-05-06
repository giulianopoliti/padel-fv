/**
 * 🎯 PLAYER CATEGORIZATION UTILITIES
 *
 * Funciones para categorizar jugadores según categorías de torneo.
 * Extraído de actions.ts para evitar dependencias circulares.
 *
 * ✅ UNIFICADO CON STRATEGY PATTERN - Reutiliza lógica de createPlayerForCouple
 */

export async function checkAndCategorizePlayer(playerId: string, categoryName: string, supabase: any) {
  console.log(`[checkAndCategorizePlayer] 🎾 Checking categorization for player ${playerId} in category ${categoryName}`);

  try {
    // Get player information
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, first_name, last_name, score, is_categorized, category_name')
      .eq('id', playerId)
      .single();

    if (playerError) {
      console.error(`[checkAndCategorizePlayer] Error fetching player ${playerId}:`, playerError);
      return { success: false, message: 'Error al obtener información del jugador' };
    }

    if (!playerData) {
      console.error(`[checkAndCategorizePlayer] Player ${playerId} not found`);
      return { success: false, message: 'Jugador no encontrado' };
    }

    // If player already has a score, they're already categorized
    if (playerData.score !== null && playerData.score !== undefined) {
      console.log(`[checkAndCategorizePlayer] ✅ Player ${playerId} is already categorized with score ${playerData.score}`);
      return { success: true, message: 'Jugador ya categorizado' };
    }

    // If no category specified, skip categorization
    if (!categoryName) {
      console.log(`[checkAndCategorizePlayer] No category specified for tournament, skipping categorization`);
      return { success: true, message: 'Sin categoría específica' };
    }

    // ✅ REAL CATEGORIZATION LOGIC - Reutiliza lógica de createPlayerForCouple
    console.log(`[checkAndCategorizePlayer] 🎯 Categorizando jugador ${playerId} en categoría ${categoryName}`);

    // Obtener el score más bajo para la categoría desde la tabla categories
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('lower_range')
      .eq('name', categoryName)
      .single();

    if (categoryError) {
      console.error(`[checkAndCategorizePlayer] Error fetching category ${categoryName}:`, categoryError);
      // Si no existe la categoría, asignar score base de 0
      const defaultScore = 0;
      console.log(`[checkAndCategorizePlayer] ⚠️ Categoría no encontrada, asignando score default: ${defaultScore}`);

      const { error: updateError } = await supabase
        .from('players')
        .update({
          score: defaultScore,
          category_name: categoryName,
          is_categorized: true
        })
        .eq('id', playerId);

      if (updateError) {
        console.error(`[checkAndCategorizePlayer] Error updating player with default score:`, updateError);
        return { success: false, message: 'Error al categorizar jugador con score default' };
      }

      console.log(`✅ [checkAndCategorizePlayer] Jugador ${playerId} categorizado con score default: ${defaultScore}`);
      return { success: true, message: 'Jugador categorizado con score default', newScore: defaultScore };
    }

    console.log(`[checkAndCategorizePlayer] Datos de la categoría:`, categoryData);

    // Actualizar jugador con el score mínimo de la categoría
    const newScore = categoryData.lower_range ?? 0;
    const { error: updateError } = await supabase
      .from('players')
      .update({
        score: newScore,
        category_name: categoryName,
        is_categorized: true
      })
      .eq('id', playerId);

    if (updateError) {
      console.error(`[checkAndCategorizePlayer] Error updating player score:`, updateError);
      return { success: false, message: 'Error al actualizar score del jugador' };
    }

    console.log(`✅ [checkAndCategorizePlayer] Jugador ${playerId} categorizado exitosamente - Score: ${newScore}, Categoría: ${categoryName}`);
    return {
      success: true,
      message: 'Categorización completada exitosamente',
      newScore: newScore,
      wasCategorized: true
    };

  } catch (error) {
    console.error(`[checkAndCategorizePlayer] Unexpected error for player ${playerId}:`, error);
    return { success: false, message: 'Error inesperado en categorización' };
  }
}