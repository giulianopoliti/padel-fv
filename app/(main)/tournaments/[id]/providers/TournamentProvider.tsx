"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { Database } from '@/database.types';
import { getTournamentDetailsWithInscriptions } from '@/app/api/tournaments/actions';
import { getAllPlayersDTO } from '@/app/api/players/actions';
import { TournamentStatus, MatchPointsCouple, Gender } from '@/types';
import { usePermissions } from '../components/permissions/usePermissions';
import type { TournamentAccess } from '../components/permissions/types';
import { createClient } from '@/utils/supabase/client';

// Types
type Tournament = {
  id: string;
  name: string;
  description: string | null;
  club_id: string;
  category_name: string | null;
  type: 'AMERICAN' | 'LONG';
  status: TournamentStatus;
  gender: Gender;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  max_participants: number | null;
  winner_id: string | null;
  winner_image_url: string | null;
  pre_tournament_image_url: string | null;
  es_prueba: boolean | null;
  price: number | null;
  registration_locked?: boolean | null;
  bracket_status?: string | null;
  enable_public_inscriptions?: boolean | null;
  enable_payment_checkboxes?: boolean | null;
  enable_transfer_proof?: boolean | null;
  transfer_alias?: string | null;
  transfer_amount?: number | null;
  clubes?: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    phone2: string | null;
    email: string | null;
    cover_image_url: string | null;
    courts: number | null;
  };
};

interface PlayerInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  score: number | null;
  dni?: string | null;
  phone?: string | null;
}

interface CoupleInfo {
  id: string;
  tournament_id: string;
  player_1_id: string;
  player_2_id: string;
  created_at: string;
  player_1_info: PlayerInfo | null;
  player_2_info: PlayerInfo | null;
  is_pending?: boolean;
  inscription_id?: string;
  payment_proof_status?: 'NOT_REQUIRED' | 'PENDING_REVIEW' | 'APPROVED';
  payment_proof_uploaded_at?: string | null;
  payment_alias_snapshot?: string | null;
  payment_amount_snapshot?: number | null;
  player_1_has_paid?: boolean;
  player_2_has_paid?: boolean;
}

interface TournamentContextValue {
  // Estado básico
  loading: boolean;
  error: string | null;
  
  // Datos del torneo
  tournament: Tournament | null;
  access: TournamentAccess;
  
  // Inscripciones
  individualInscriptions: PlayerInfo[];
  coupleInscriptions: CoupleInfo[];
  pendingInscriptions: any[];
  
  // Metadatos
  allPlayers: PlayerInfo[];
  maxPlayers: number;
  
  // Acciones
  refreshData: () => Promise<void>;
  matchPoints: Record<string, MatchPointsCouple>;
  tournamentGender: Gender;
}

const TournamentContext = createContext<TournamentContextValue | undefined>(undefined);

interface TournamentProviderProps {
  children: React.ReactNode;
  tournamentId: string;
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ 
  children, 
  tournamentId 
}) => {
  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [individualInscriptions, setIndividualInscriptions] = useState<PlayerInfo[]>([]);
  const [coupleInscriptions, setCoupleInscriptions] = useState<CoupleInfo[]>([]);
  const [pendingInscriptions, setPendingInscriptions] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerInfo[]>([]);
  const [matchPoints, setMatchPoints] = useState<Record<string, MatchPointsCouple>>({});

  // Permisos basados en el torneo actual
  const access = usePermissions(tournament);

  // Función para cargar datos
  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener datos del torneo con inscripciones
      const { tournament: tournamentData, inscriptions } = await getTournamentDetailsWithInscriptions(tournamentId);
      
      if (!tournamentData) {
        notFound();
        return;
      }

      setTournament(tournamentData);

      // Procesar inscripciones individuales
      const individuals = inscriptions
        .filter((inscription: any) => inscription.player_id && !inscription.couple_id)
        .map((inscription: any) => {
          if (inscription.player && inscription.player.length > 0) {
            return inscription.player[0];
          }
          return {
            id: inscription.player_id,
            first_name: null,
            last_name: null,
            score: null,
            dni: null,
            phone: null,
          };
        });

      setIndividualInscriptions(individuals);

      // Procesar inscripciones de parejas
      const couples = inscriptions
        .filter((inscription: any) => inscription.couple_id)
        .map((inscription: any) => {
          if (inscription.couple && inscription.couple.length > 0) {
            const couple = inscription.couple[0];
            return {
              id: couple.id,
              tournament_id: tournamentId,
              player_1_id: couple.player1_id,
              player_2_id: couple.player2_id,
              created_at: couple.created_at || new Date().toISOString(),
              player_1_info: couple.player1 && couple.player1.length > 0 ? couple.player1[0] : null,
              player_2_info: couple.player2 && couple.player2.length > 0 ? couple.player2[0] : null,
              is_pending: inscription.is_pending ?? false,
              inscription_id: inscription.id,
            };
          }
          return {
            id: inscription.couple_id,
            tournament_id: tournamentId,
            player_1_id: null,
            player_2_id: null,
            created_at: inscription.created_at || new Date().toISOString(),
            player_1_info: null,
            player_2_info: null,
            is_pending: inscription.is_pending ?? false,
            inscription_id: inscription.id,
          };
        });

      setCoupleInscriptions(couples);

      // Procesar inscripciones pendientes
      const pending = inscriptions
        .filter((inscription: any) => inscription.is_pending)
        .map((inscription: any) => ({
          id: inscription.id,
          couple_id: inscription.couple_id,
          created_at: inscription.created_at,
          couple: inscription.couple && inscription.couple.length > 0 ? inscription.couple[0] : null,
        }));

      setPendingInscriptions(pending);

      // Obtener todos los jugadores para búsquedas
      const allPlayersData = await getAllPlayersDTO();
      setAllPlayers(allPlayersData);

      // Obtener los puntos por partido si el torneo ha finalizado
      if (tournamentData.status === 'FINISHED_POINTS_CALCULATED') {
        const supabase = createClient();
        const { data: matches } = await supabase
          .from('matches')
          .select('id')
          .eq('tournament_id', tournamentId);

        if (matches && matches.length > 0) {
          const matchIds = matches.map(m => m.id);
          const { data: pointsData } = await supabase
            .from('match_points_couples')
            .select('*')
            .in('match_id', matchIds);

          if (pointsData) {
            const pointsByMatch = Object.fromEntries(
              pointsData.map((mp: MatchPointsCouple) => [mp.match_id, mp])
            );
            setMatchPoints(pointsByMatch);
          }
        }
      }

    } catch (err) {
      console.error('Error fetching tournament data:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos iniciales
  useEffect(() => {
    if (tournamentId) {
      fetchTournamentData();
    }
  }, [tournamentId]);

  // Configurar max players (puede venir del torneo en el futuro)
    const maxPlayers = tournament?.max_participants || 32;

  const value: TournamentContextValue = {
    loading,
    error,
    tournament,
    access,
    individualInscriptions,
    coupleInscriptions,
    pendingInscriptions,
    allPlayers,
    maxPlayers,
    refreshData: fetchTournamentData,
    matchPoints,
    tournamentGender: tournament?.gender || Gender.MALE,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

/**
 * Hook para usar el contexto del torneo
 */
export const useTournament = (): TournamentContextValue => {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}; 
