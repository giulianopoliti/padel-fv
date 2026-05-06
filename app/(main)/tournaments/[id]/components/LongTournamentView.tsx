"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useUser } from '@/contexts/user-context';
import PlayerTournamentDashboard from '@/components/player/PlayerTournamentDashboard';
import NotRegisteredView from '@/components/tournament/NotRegisteredView';

interface Tournament {
  id: string;
  name: string;
  type: string;
  status: string;
  gender?: 'MALE' | 'FEMALE' | 'MIXED';
  price?: string | null;
  enable_transfer_proof?: boolean;
  transfer_alias?: string | null;
  transfer_amount?: number | null;
  start_date: string | null;
  end_date: string | null;
  category_name?: string;
  clubes?: {
    name: string;
    phone?: string;
    address?: string;
  };
}

interface TournamentStats {
  inscriptionsCount: number;
  finishedMatches: number;
  notStartedMatches: number;
  scheduledDatesCount: number;
  status: string;
}

interface LongTournamentViewProps {
  tournamentId: string;
}

/**
 * 🎯 VISTA PRINCIPAL PARA TORNEOS LARGOS
 *
 * Dashboard que detecta el rol del usuario:
 * - PLAYER: Muestra PlayerTournamentDashboard
 * - Otros roles: Dashboard con estadísticas básicas y sidebar
 */
const LongTournamentView: React.FC<LongTournamentViewProps> = ({ tournamentId }) => {
  const { userDetails } = useUser();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stats, setStats] = useState<TournamentStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Detectar si el usuario es un jugador logeado
  const isLoggedInPlayer = userDetails?.role === 'PLAYER';

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      // Obtener datos del torneo
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select(`
          id,
          name,
          type,
          status,
          gender,
          price,
          enable_transfer_proof,
          transfer_alias,
          transfer_amount,
          start_date,
          end_date,
          category_name,
          clubes:club_id (
            name,
            phone,
            address
          )
        `)
        .eq('id', tournamentId)
        .single();

      // Obtener estadísticas básicas
      const [
        { count: inscriptionsCount },
        { count: finishedMatches },
        { count: notStartedMatches },
        { count: scheduledDatesCount }
      ] = await Promise.all([
        supabase.from('parejas').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId).eq('status', 'FINISHED'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId).eq('status', 'SCHEDULED'),
        supabase.from('fechas').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId)
      ]);
      
      setTournament(tournamentData as any);
      setStats({
        inscriptionsCount: inscriptionsCount || 0,
        finishedMatches: finishedMatches || 0,
        notStartedMatches: notStartedMatches || 0,
        scheduledDatesCount: scheduledDatesCount || 0,
        status: tournamentData?.status || 'UNKNOWN'
      });
      setLoading(false);
    };

    fetchData();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-6">
        <p className="text-destructive">Error al cargar el torneo</p>
      </div>
    );
  }

  // Si es un jugador logeado, mostrar dashboard específico
  if (isLoggedInPlayer) {
    return (
      <PlayerTournamentDashboard
        tournamentId={tournamentId}
        tournament={{
          id: tournament.id,
          name: tournament.name,
          category: tournament.category_name,
          status: tournament.status,
          gender: tournament.gender,
          price: tournament.price,
          enable_transfer_proof: tournament.enable_transfer_proof,
          transfer_alias: tournament.transfer_alias,
          transfer_amount: tournament.transfer_amount,
        }}
      />
    );
  }

  // Dashboard original para organizadores (userDetails con otro rol)
  if (userDetails && userDetails.role !== 'PLAYER') {
    if (!stats) {
      return (
        <div className="p-6">
          <p className="text-destructive">Error al cargar estadísticas del torneo</p>
        </div>
      );
    }
    // Render organizer dashboard aquí (código que sigue abajo)
  } else {
    // Si no está logeado o no tiene userDetails, mostrar vista de "No inscripto"
    return (
      <div className="p-6 space-y-6">
        <NotRegisteredView tournamentId={tournamentId} tournament={{
          id: tournament.id,
          name: tournament.name,
          category: tournament.category_name,
          status: tournament.status,
          gender: tournament.gender,
          price: tournament.price,
          enable_transfer_proof: tournament.enable_transfer_proof,
          transfer_alias: tournament.transfer_alias,
          transfer_amount: tournament.transfer_amount,
        }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tournament Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-muted-foreground">{tournament.clubes?.name || 'Sin organizador'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>
              {tournament.start_date 
                ? new Date(tournament.start_date).toLocaleDateString('es-ES')
                : 'Sin fecha'
              }
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="capitalize">{stats.status.toLowerCase()}</span>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Parejas Inscriptas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parejas Inscriptas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inscriptionsCount}</div>
            <p className="text-xs text-muted-foreground">Total de equipos</p>
          </CardContent>
        </Card>

        {/* Partidos Terminados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos Terminados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.finishedMatches}</div>
            <p className="text-xs text-muted-foreground">Completados</p>
          </CardContent>
        </Card>

        {/* Partidos Pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidos Pendientes</CardTitle>
            <XCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.notStartedMatches}</div>
            <p className="text-xs text-muted-foreground">Sin empezar</p>
          </CardContent>
        </Card>

        {/* Fechas Programadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fechas Programadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledDatesCount}</div>
            <p className="text-xs text-muted-foreground">Fechas del torneo</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Trophy className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Torneo Largo - Sistema de Fechas
              </h3>
              <p className="text-blue-700 text-sm">
                Utiliza la sidebar para navegar entre las diferentes secciones del torneo. 
                Gestiona inscripciones, programa partidos y controla el desarrollo del torneo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LongTournamentView;
