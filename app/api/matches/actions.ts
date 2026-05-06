'use server';

import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/database.types';
import { revalidatePath } from 'next/cache';

type MatchStatus = Database["public"]["Enums"]["match_status"];

export async function updateMatch(
  matchId: string,
  data: {
    status?: MatchStatus;
    court?: string | undefined;
  }
) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check:', { userId: user?.id, authError });
    
    if (authError) {
      console.error('Authentication error:', authError);
      throw new Error('Error de autenticación');
    }
    
    if (!user) {
      throw new Error('No autorizado - Usuario no encontrado');
    }

    // Get match to verify permissions
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('tournament_id')
      .eq('id', matchId)
      .single();

    console.log('Match check:', { matchId, match, matchError });

    if (matchError) {
      console.error('Match error:', matchError);
      throw new Error('Error al buscar el partido');
    }

    if (!match || !match.tournament_id) {
      throw new Error('Partido no encontrado');
    }

    // Verify user is tournament owner
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('club_id')
      .eq('id', match.tournament_id)
      .single();

    console.log('Tournament check:', { tournamentId: match.tournament_id, tournament, tournamentError });

    if (tournamentError) {
      console.error('Tournament error:', tournamentError);
      throw new Error('Error al buscar el torneo');
    }

    if (!tournament || !tournament.club_id) {
      throw new Error('Torneo no encontrado');
    }

    // Get user's club
    const { data: club, error: clubError } = await supabase
      .from('clubes')
      .select('id')
      .eq('user_id', user.id)
      .single();

    console.log('Club check:', { userId: user.id, club, clubError });

    if (clubError) {
      console.error('Club error:', clubError);
      throw new Error('Error al verificar permisos del club');
    }

    if (!club || club.id !== tournament.club_id) {
      throw new Error('No autorizado para modificar este partido');
    }

    // Update match
    const { error: updateError } = await supabase
      .from('matches')
      .update({
        status: data.status,
        court: data.court,
      })
      .eq('id', matchId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Error al actualizar el partido');
    }

    // Revalidate both tournament paths to ensure UI updates
    revalidatePath(`/tournaments/${match.tournament_id}`);
    revalidatePath(`/my-tournaments/${match.tournament_id}`);

    return { success: true };
  } catch (error) {
    console.error('Error updating match:', error);
    throw error;
  }
}

export async function startMatch(matchId: string, court: string) {
  try {
    await updateMatch(matchId, {
      status: 'IN_PROGRESS',
      court: court
    });
    return { success: true };
  } catch (error) {
    console.error('Error starting match:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}



export async function cancelMatch(matchId: string) {
  try {
    await updateMatch(matchId, {
      status: 'CANCELED'
    });
    return { success: true };
  } catch (error) {
    console.error('Error canceling match:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function changeMatchCourt(matchId: string, court: string) {
  try {
    await updateMatch(matchId, {
      court: court
    });
    return { success: true };
  } catch (error) {
    console.error('Error changing match court:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
} 