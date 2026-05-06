"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Table, Trophy, BarChart3 } from 'lucide-react';
import { Database } from '@/database.types';
import ResultsMatrix from './ResultsMatrix';
import PositionsTable from './PositionsTable';

type Tournament = Database['public']['Tables']['tournaments']['Row'];
type CoupleInscription = {
  id: string;
  couple_id: string | null;
  created_at: string | null;
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

interface QuallyViewProps {
  tournament: Tournament;
  coupleInscriptions: CoupleInscription[];
}

const QuallyView: React.FC<QuallyViewProps> = ({ 
  tournament, 
  coupleInscriptions 
}) => {
  const [activeTab, setActiveTab] = useState('results');

  // Determine if this is a single-set format (future american qually)
  const isSingleSetFormat = tournament.format_type === 'AMERICAN_2' || tournament.format_type === 'AMERICAN_3';
  const isLongFormat = tournament.format_type === 'LONG';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 lg:py-6">
          <div className="max-w-7xl mx-auto">
            {/* Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 lg:mb-6">
              <Button asChild variant="outline" className="border-gray-300 w-fit">
                <Link href={`/tournaments/${tournament.id}`} className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Volver al Torneo</span>
                </Link>
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  {isLongFormat && "Qually - Round Robin"}
                  {isSingleSetFormat && "Qually - American Format"}
                </div>
              </div>
            </div>

            {/* Tournament Title */}
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="bg-purple-100 p-2 lg:p-3 rounded-xl">
                <Trophy className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2 truncate">
                  {tournament.name} - Qually
                </h1>
                
                <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-xs lg:text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 lg:h-4 lg:w-4" />
                    <span>{coupleInscriptions.length} parejas inscritas</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3 lg:h-4 lg:w-4" />
                    <span>
                      {isLongFormat && "Todos contra todos - 3 sets"}
                      {isSingleSetFormat && "Todos contra todos - 1 set"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">

          {/* Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Table className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">
                  🎾 Sistema Qually - Clasificatorio
                </h3>
                <p className="text-purple-700 text-sm">
                  {isLongFormat && "Round-robin completo a 3 sets. Todas las parejas juegan entre sí para determinar las posiciones finales."}
                  {isSingleSetFormat && "Fase clasificatoria a 1 set. Todas las parejas juegan entre sí para clasificar a la fase eliminatoria."}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Table className="h-4 w-4" />
                Matriz de Resultados
              </TabsTrigger>
              <TabsTrigger value="standings" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Tabla de Posiciones
              </TabsTrigger>
            </TabsList>

            {/* Results Matrix Tab */}
            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Table className="h-5 w-5 text-blue-600" />
                    Matriz de Resultados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResultsMatrix 
                    tournament={tournament}
                    coupleInscriptions={coupleInscriptions}
                    isSingleSetFormat={isSingleSetFormat}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Standings Tab */}
            <TabsContent value="standings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Tabla de Posiciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PositionsTable 
                    tournament={tournament}
                    coupleInscriptions={coupleInscriptions}
                    isSingleSetFormat={isSingleSetFormat}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </div>
  );
};

export default QuallyView;