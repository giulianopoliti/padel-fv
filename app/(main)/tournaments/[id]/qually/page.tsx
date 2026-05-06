import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import QuallyView from './components/QuallyView';

interface QuallyPageProps {
  params: { id: string };
}

/**
 * 🎯 PÁGINA INDEPENDIENTE PARA GESTIÓN DE QUALI
 * 
 * Esta página es completamente independiente del sistema americano.
 * Maneja la gestión previa de parejas inscritas con drag & drop para
 * agregar/quitar parejas que se hayan anotado después.
 */
export default async function QuallyPage({ params }: QuallyPageProps) {
  const resolvedParams = await params;
  const tournamentId = resolvedParams.id;
  
  const supabase = await createClient();

  // Verificar que el torneo existe
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, name, type, status, club_id')
    .eq('id', tournamentId)
    .single();

  if (error || !tournament) {
    redirect('/tournaments');
  }

  // Por ahora solo para torneos largos, pero se puede extender
  if (tournament.type !== 'LONG') {
    redirect(`/tournaments/${tournamentId}`);
  }

  // Obtener parejas inscritas con información de jugadores
  const { data: coupleInscriptions } = await supabase
    .from('inscriptions')
    .select(`
      id,
      couple_id,
      created_at,
      couples:couple_id (
        id,
        player1_id,
        player2_id,
        players_player1:player1_id (
          id,
          first_name,
          last_name,
          score,
          dni,
          phone
        ),
        players_player2:player2_id (
          id,
          first_name,
          last_name,
          score,
          dni,
          phone
        )
      )
    `)
    .eq('tournament_id', tournamentId)
    .eq('is_pending', false)
    .not('couple_id', 'is', null)
    .order('created_at', { ascending: true });

  return (
    <QuallyView 
      tournament={tournament as any}
      coupleInscriptions={coupleInscriptions as any}
    />
  );
}