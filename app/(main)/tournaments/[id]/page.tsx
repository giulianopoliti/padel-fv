import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { checkTournamentAccess } from '@/utils/tournament-permissions';
import AmericanTournamentOverview from './components/AmericanTournamentOverview';
import LongTournamentView from './components/LongTournamentView';

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 🎯 PUNTO DE ENTRADA ÚNICO PARA TODOS LOS TORNEOS - Sistema V2
 *
 * Esta página maneja AMBOS tipos de torneo con permisos granulares:
 * - AMERICAN: Vista overview con routing basado en accessLevel
 * - LONG: Sistema de torneos largos con dashboard
 *
 * ✅ Sistema V2 con checkTournamentAccess():
 *    - Soporte GUEST (usuarios no logeados)
 *    - AccessLevel granular (FULL_MANAGEMENT, PLAYER_*, PUBLIC_VIEW)
 *    - Props type-safe desde server-side
 *
 * @see docs/PERMISSIONS_SPEC.md
 */
export default async function TournamentPage({ params }: TournamentPageProps) {
  const resolvedParams = await params;
  const tournamentId = resolvedParams.id;

  // ========================================
  // OBTENER DATOS DEL TORNEO
  // ========================================

  const supabase = await createClient();
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      clubes (
        id,
        name,
        address,
        phone,
        phone2,
        email,
        cover_image_url,
        courts
      )
    `)
    .eq('id', tournamentId)
    .single();

  if (error || !tournament) {
    notFound();
  }

  // ========================================
  // VERIFICAR PERMISOS CON SISTEMA V2
  // ========================================

  const { data: { user } } = await supabase.auth.getUser();

  // ✅ Sistema V2: Una sola llamada, soporte GUEST, type-safe
  const access = await checkTournamentAccess(user?.id || null, tournamentId);

  // ========================================
  // ROUTING POR TIPO DE TORNEO
  // ========================================

  if (tournament.type === 'LONG') {
    // ➜ SISTEMA LARGO: Dashboard con estadísticas
    return <LongTournamentView tournamentId={tournamentId} />;
  }

  // ➜ SISTEMA AMERICANO: Overview con props V2
  return (
    <AmericanTournamentOverview
      tournamentId={tournamentId}
      tournament={tournament}
      accessLevel={access.accessLevel}
      permissions={access.permissions}
      metadata={access.metadata}
    />
  );
} 