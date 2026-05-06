'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Registrar una pareja para un torneo
 * Primero crea la pareja si no existe, luego la inscribe en el torneo
 */
export async function registerCoupleForTournament({ 
  player1Id, 
  player2Id, 
  tournamentId,
  isOrganizerRegistration = false
}: { 
  player1Id: string; 
  player2Id: string;
  tournamentId: string;
  isOrganizerRegistration?: boolean;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const supabase = await createClient();
  console.log(`[registerCoupleForTournament] Inscribiendo pareja en torneo ${tournamentId}`, {
    player1Id,
    player2Id
  });
  
  // Check if either player is already registered in this tournament (individually or in a couple)
  const { data: existingPlayerInscriptions, error: playerCheckError } = await supabase
    .from('inscriptions')
    .select(`
      id, 
      player_id, 
      couple_id,
      couples (
        id,
        player1_id,
        player2_id
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('is_pending', false)
    .or(`player_id.eq.${player1Id},player_id.eq.${player2Id}`);

  if (playerCheckError) {
    console.error("[registerCoupleForTournament] Error checking existing player inscriptions:", playerCheckError);
    return { success: false, error: "Error al verificar inscripciones existentes." };
  }

  // Check if any player is already inscribed individually
  const individualInscription = existingPlayerInscriptions?.find(inscription => 
    inscription.player_id === player1Id || inscription.player_id === player2Id
  );

  if (individualInscription) {
    const playerName = individualInscription.player_id === player1Id ? "El primer jugador" : "El segundo jugador";
    return { success: false, error: `${playerName} ya está inscrito individualmente en este torneo.` };
  }

  // Check if either player is already in a couple for this tournament
  const { data: existingCoupleInscriptions, error: coupleCheckError } = await supabase
    .from('inscriptions')
    .select(`
      id,
      couples (
        id,
        player1_id,
        player2_id
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('is_pending', false)
    .not('couple_id', 'is', null);

  if (coupleCheckError) {
    console.error("[registerCoupleForTournament] Error checking existing couple inscriptions:", coupleCheckError);
    return { success: false, error: "Error al verificar parejas existentes." };
  }

  // Check if either player is already in any couple for this tournament
  const playerInCouple = existingCoupleInscriptions?.find(inscription => {
    const couple = inscription.couples;
    if (couple) {
      // Handle both array and object cases from Supabase join
      const coupleData = Array.isArray(couple) ? couple[0] : couple;
      if (coupleData) {
        return coupleData.player1_id === player1Id || 
               coupleData.player1_id === player2Id ||
               coupleData.player2_id === player1Id || 
               coupleData.player2_id === player2Id;
      }
    }
    return false;
  });

  if (playerInCouple) {
    return { success: false, error: "Uno de los jugadores ya está inscrito en otra pareja para este torneo." };
  }
  
  // Verificar que ambos jugadores existan
  const { data: player1, error: player1Error } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('id', player1Id)
    .single();
    
  if (player1Error) {
    console.error("[registerCoupleForTournament] Error verificando jugador 1:", player1Error);
    return { success: false, error: "No se pudo verificar el primer jugador" };
  }
  
  const { data: player2, error: player2Error } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .eq('id', player2Id)
    .single();
    
  if (player2Error) {
    console.error("[registerCoupleForTournament] Error verificando jugador 2:", player2Error);
    return { success: false, error: "No se pudo verificar el segundo jugador" };
  }
  
  console.log("[registerCoupleForTournament] Jugadores verificados:", { player1, player2 });
  
  // Verificar si la pareja ya existe (en cualquier orden)
  const { data: existingCouple, error: findCoupleError } = await supabase
    .from('couples')
    .select('id')
    .or(`and(player1_id.eq.${player1Id},player2_id.eq.${player2Id}),and(player1_id.eq.${player2Id},player2_id.eq.${player1Id})`)
    .maybeSingle();
    
  if (findCoupleError) {
    console.error("[registerCoupleForTournament] Error verificando pareja existente:", findCoupleError);
    return { success: false, error: "No se pudo verificar si la pareja ya existe" };
  }
  
  let coupleId;
  
  if (existingCouple) {
    // Usar la pareja existente
    coupleId = existingCouple.id;
    console.log(`[registerCoupleForTournament] Usando pareja existente: ${coupleId}`);
  } else {
    // Crear una nueva pareja
    const { data: newCouple, error: createCoupleError } = await supabase
      .from('couples')
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (createCoupleError) {
      console.error("[registerCoupleForTournament] Error creando pareja:", createCoupleError);
      return { success: false, error: "No se pudo crear la pareja" };
    }
    
    coupleId = newCouple.id;
    console.log(`[registerCoupleForTournament] Pareja creada con ID: ${coupleId}`);
  }
  
  // Verificar si la pareja ya está inscrita en este torneo
  const { data: existingInscription, error: inscriptionCheckError } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('couple_id', coupleId)
    .eq('is_pending', false)
    .maybeSingle();
    
  if (inscriptionCheckError) {
    console.error("[registerCoupleForTournament] Error verificando inscripción existente:", inscriptionCheckError);
    return { success: false, error: "No se pudo verificar si la pareja ya está inscrita" };
  }
  
  if (existingInscription) {
    console.log("[registerCoupleForTournament] La pareja ya está inscrita en este torneo");
    return { success: false, error: "Esta pareja ya está inscrita en el torneo" };
  }
  
  // Inscribir la pareja en el torneo
  // Si es inscripcion del organizador, player_id queda null
  // Si es inscripcion del jugador, player_id es el id del jugador que inscribe
  const { error: inscriptionError } = await supabase
    .from('inscriptions')
    .insert({
      player_id: isOrganizerRegistration ? null : player1Id,
      couple_id: coupleId,
      tournament_id: tournamentId,
      is_pending: true, // Inscripcion pendiente hasta que el organizador la apruebe
      created_at: new Date().toISOString()
    });
    
  if (inscriptionError) {
    console.error("[registerCoupleForTournament] Error inscribiendo pareja:", inscriptionError);
    return { success: false, error: "No se pudo inscribir la pareja en el torneo" };
  }
  
  console.log("[registerCoupleForTournament] Pareja inscrita exitosamente");
  
  // Revalidar la ruta para actualizar la UI
  try {
    console.log(`[registerCoupleForTournament] Revalidando ruta: /tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}`);
    // También revalidar la ruta principal de torneos
    revalidatePath('/tournaments');
  } catch (revalidateError) {
    console.error("[registerCoupleForTournament] Error al revalidar ruta:", revalidateError);
    // No lanzar error aquí para no interrumpir el flujo principal
  }
  
  return { success: true, message: "Pareja inscrita con éxito" };
} 

export async function getCouplesByTournamentId(tournamentId: string) {
  if (!tournamentId) {
    console.warn("[getCouplesByTournamentId] No tournamentId provided");
    return []; // Devuelve array vacío si no hay ID
  }
  const supabase = await createClient();

  // 1. Obtener los couple_id de la tabla inscriptions para el torneo dado
  const { data: inscriptions, error: inscriptionsError } = await supabase
    .from('inscriptions')
    .select('couple_id') // Solo necesitamos couple_id
    .eq('tournament_id', tournamentId);

  if (inscriptionsError) {
    console.error(`[getCouplesByTournamentId] Error fetching inscriptions for tournament ${tournamentId}:`, inscriptionsError.message);
    throw inscriptionsError; // Relanzar el error para que sea manejado por el llamador
  }

  if (!inscriptions || inscriptions.length === 0) {
    // console.log(`[getCouplesByTournamentId] No inscriptions found for tournament ${tournamentId}`);
    return []; // No hay parejas inscritas en este torneo
  }

  // Extraer los IDs de las parejas (asegurándose de que no sean null y sean únicos)
  const coupleIds = inscriptions
    .map(inscription => inscription.couple_id)
    .filter(id => id !== null) as string[];
    
  if (coupleIds.length === 0) {
    // console.log(`[getCouplesByTournamentId] No valid couple_ids found in inscriptions for tournament ${tournamentId}`);
    return [];
  }

  // 2. Obtener los detalles de esas parejas
  // Incluimos detalles de player1_id y player2_id para mostrar nombres, etc.
  const { data: couples, error: couplesError } = await supabase
    .from('couples')
    .select(`
      *,
      player1:players!couples_player1_id_fkey ( id, first_name, last_name, score ),
      player2:players!couples_player2_id_fkey ( id, first_name, last_name, score )
    `)
    .in('id', coupleIds);

  if (couplesError) {
    console.error(`[getCouplesByTournamentId] Error fetching couple details for tournament ${tournamentId}:`, couplesError.message);
    throw couplesError;
  }

  // 3. Transformar los datos al formato esperado por los componentes del frontend
  const transformedCouples = (couples || []).map(couple => ({
    id: couple.id,
    player1_id: couple.player1_id,
    player2_id: couple.player2_id,
    created_at: couple.created_at,
    player_1_info: couple.player1 ? {
      id: couple.player1.id,
      first_name: couple.player1.first_name,
      last_name: couple.player1.last_name,
      score: couple.player1.score
    } : null,
    player_2_info: couple.player2 ? {
      id: couple.player2.id,
      first_name: couple.player2.first_name,
      last_name: couple.player2.last_name,
      score: couple.player2.score
    } : null
  }));

  // console.log(`[getCouplesByTournamentId] Fetched ${transformedCouples.length || 0} couples for tournament ${tournamentId}`);
  return transformedCouples;
}
