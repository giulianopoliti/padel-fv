"use client";

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, Medal, Award, TrendingUp, TrendingDown } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { Database } from '@/database.types';
import CoupleAvatar from './CoupleAvatar';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

type CoupleInscription = {
  id: string;
  couple_id: string | null;
  couples?: {
    id: string;
    player1_id: string | null;
    player2_id: string | null;
    players_player1: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      score: number | null;
      dni: string | null;
      phone: string | null;
    } | null;
    players_player2: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      score: number | null;
      dni: string | null;
      phone: string | null;
    } | null;
  } | null;
};

type ZonePosition = {
  id: string;
  position: number;
  wins: number;
  losses: number;
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
  sets_difference: number;
  games_difference: number;
  couple_id: string;
  couples: {
    id: string;
    players_player1: {
      first_name: string | null;
      last_name: string | null;
    } | null;
    players_player2: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  }
};

interface PositionsTableProps {
  tournament: Tournament;
  coupleInscriptions: CoupleInscription[];
  isSingleSetFormat: boolean;
}

const PositionsTable: React.FC<PositionsTableProps> = ({
  tournament,
  coupleInscriptions,
  isSingleSetFormat
}) => {
  const [standings, setStandings] = useState<ZonePosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZonePositions = async () => {
      const supabase = createClient();
      
      // Get zone positions directly from database
      const { data, error } = await supabase
        .from('zone_positions')
        .select(`
          *,
          couples (
            id,
            players_player1:players!couples_player1_id_fkey (
              first_name,
              last_name
            ),
            players_player2:players!couples_player2_id_fkey (
              first_name,
              last_name
            )
          )
        `)
        .eq('tournament_id', tournament.id)
        .order('position', { ascending: true });
      
      if (error) {
        console.error('Error fetching zone positions:', error);
        setStandings([]);
      } else {
        setStandings(data as ZonePosition[] || []);
      }
      
      setLoading(false);
    };

    fetchZonePositions();
  }, [tournament.id]);

  const getCoupleDisplayName = (zonePosition: ZonePosition): string => {
    if (!zonePosition.couples) return 'N/A';

    const player1Name = zonePosition.couples.players_player1
      ? `${zonePosition.couples.players_player1.first_name || ''} ${zonePosition.couples.players_player1.last_name || ''}`.trim()
      : '';
    const player2Name = zonePosition.couples.players_player2
      ? `${zonePosition.couples.players_player2.first_name || ''} ${zonePosition.couples.players_player2.last_name || ''}`.trim()
      : '';

    return `${player1Name} / ${player2Name}`;
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-500" />;
      default:
        return null;
    }
  };

  const getPositionBadgeColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-800 border-yellow-300 shadow-sm";
      case 2:
        return "bg-gradient-to-br from-slate-100 to-gray-100 text-slate-800 border-slate-300 shadow-sm";
      case 3:
        return "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-800 border-orange-300 shadow-sm";
      default:
        return "bg-white text-slate-700 border-slate-300";
    }
  };

  const getRowBackground = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-r from-yellow-50/50 to-amber-50/30 hover:from-yellow-50 hover:to-amber-50";
      case 2:
        return "bg-gradient-to-r from-slate-50/50 to-gray-50/30 hover:from-slate-50 hover:to-gray-50";
      case 3:
        return "bg-gradient-to-r from-orange-50/50 to-amber-50/30 hover:from-orange-50 hover:to-amber-50";
      default:
        return "hover:bg-slate-50";
    }
  };

  const calculateWinPercentage = (wins: number, losses: number): number => {
    const total = wins + losses;
    return total > 0 ? (wins / total) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No hay datos para mostrar la tabla de posiciones.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Format Info */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
        <p className="text-sm text-slate-700">
          <strong className="text-emerald-700">Actualización automática:</strong>{' '}
          Las posiciones se calculan en tiempo real cuando se actualizan los resultados.
        </p>
      </div>

      {/* Standings Table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-50 hover:to-slate-100">
              <TableHead className="w-[100px] font-semibold text-slate-700">Pos</TableHead>
              <TableHead className="min-w-[280px] font-semibold text-slate-700">Pareja</TableHead>
              <TableHead className="text-center w-[70px] font-semibold text-slate-700">PJ</TableHead>
              <TableHead className="text-center w-[70px] font-semibold text-slate-700">PG</TableHead>
              <TableHead className="text-center w-[70px] font-semibold text-slate-700">PP</TableHead>
              <TableHead className="text-center w-[100px] font-semibold text-slate-700">% Vic</TableHead>
              {!isSingleSetFormat && (
                <>
                  <TableHead className="text-center w-[70px] font-semibold text-slate-700">SG</TableHead>
                  <TableHead className="text-center w-[70px] font-semibold text-slate-700">SP</TableHead>
                  <TableHead className="text-center w-[80px] font-semibold text-slate-700">+/-S</TableHead>
                </>
              )}
              <TableHead className="text-center w-[70px] font-semibold text-slate-700">GG</TableHead>
              <TableHead className="text-center w-[70px] font-semibold text-slate-700">GP</TableHead>
              <TableHead className="text-center w-[80px] font-semibold text-slate-700">+/-G</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((zonePosition, index) => {
              const winPercentage = calculateWinPercentage(zonePosition.wins, zonePosition.losses);
              const isTopThree = zonePosition.position <= 3;

              return (
                <React.Fragment key={zonePosition.couple_id}>
                  <TableRow className={`transition-colors ${getRowBackground(zonePosition.position)}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`w-9 h-9 flex items-center justify-center text-sm font-bold ${getPositionBadgeColor(zonePosition.position)}`}
                        >
                          {zonePosition.position}
                        </Badge>
                        {getPositionIcon(zonePosition.position)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <CoupleAvatar
                          player1={zonePosition.couples.players_player1}
                          player2={zonePosition.couples.players_player2}
                          size="md"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {getCoupleDisplayName(zonePosition)}
                          </span>
                          {isTopThree && (
                            <span className="text-xs text-slate-500 mt-0.5">
                              {zonePosition.position === 1 ? '🥇 Primero' : zonePosition.position === 2 ? '🥈 Segundo' : '🥉 Tercero'}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-slate-50">
                        {zonePosition.wins + zonePosition.losses}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                          {zonePosition.wins}
                        </Badge>
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Badge className="bg-rose-100 text-rose-700 border-rose-300">
                          {zonePosition.losses}
                        </Badge>
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-slate-900">
                          {winPercentage.toFixed(0)}%
                        </span>
                        <Progress
                          value={winPercentage}
                          className="h-1.5 w-16"
                        />
                      </div>
                    </TableCell>
                    {!isSingleSetFormat && (
                      <>
                        <TableCell className="text-center text-sm text-slate-700">
                          {zonePosition.sets_for}
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-700">
                          {zonePosition.sets_against}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`font-bold ${
                              zonePosition.sets_difference > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : zonePosition.sets_difference < 0
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-slate-50 text-slate-700 border-slate-300'
                            }`}
                          >
                            {zonePosition.sets_difference > 0 ? '+' : ''}
                            {zonePosition.sets_difference}
                          </Badge>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-center text-sm text-slate-700">
                      {zonePosition.games_for}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-700">
                      {zonePosition.games_against}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`font-bold ${
                          zonePosition.games_difference > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : zonePosition.games_difference < 0
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        {zonePosition.games_difference > 0 ? '+' : ''}
                        {zonePosition.games_difference}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {/* Separator after top 3 */}
                  {zonePosition.position === 3 && index < standings.length - 1 && (
                    <TableRow>
                      <TableCell colSpan={12} className="p-0">
                        <Separator className="bg-amber-200" />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="text-slate-700">
          <strong className="text-slate-900">PJ:</strong> Partidos Jugados
        </div>
        <div className="text-slate-700">
          <strong className="text-slate-900">PG:</strong> Partidos Ganados
        </div>
        <div className="text-slate-700">
          <strong className="text-slate-900">PP:</strong> Partidos Perdidos
        </div>
        <div className="text-slate-700">
          <strong className="text-slate-900">% Vic:</strong> Porcentaje de Victorias
        </div>
        {!isSingleSetFormat && (
          <>
            <div className="text-slate-700">
              <strong className="text-slate-900">SG/SP:</strong> Sets Ganados/Perdidos
            </div>
            <div className="text-slate-700">
              <strong className="text-slate-900">+/-S:</strong> Diferencia de Sets
            </div>
          </>
        )}
        <div className="text-slate-700">
          <strong className="text-slate-900">GG/GP:</strong> Games Ganados/Perdidos
        </div>
        <div className="text-slate-700">
          <strong className="text-slate-900">+/-G:</strong> Diferencia de Games
        </div>
      </div>
    </div>
  );
};

export default PositionsTable;