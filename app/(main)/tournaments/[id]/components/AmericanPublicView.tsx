"use client";

import React from "react";
import { Calendar, MapPin, Trophy, Users, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PublicRegistrationLauncher from "@/components/tournament/public-registration-launcher";
import { Gender } from "@/types";
import type { AccessLevel, TournamentPermission } from "@/utils/tournament-permissions";

interface AmericanPublicViewProps {
  tournamentId: string;
  tournament: any;
  accessLevel: AccessLevel;
  permissions: TournamentPermission[];
  metadata: {
    userRole?: "ADMIN" | "CLUB" | "ORGANIZADOR" | "PLAYER" | "COACH";
    isInscribed?: boolean;
    coupleId?: string;
    playerId?: string;
    source?: "admin" | "club_owner" | "organization_member" | "player" | "public";
  };
  coupleInscriptions?: any[];
  individualInscriptions?: any[];
}

export default function AmericanPublicView({
  tournamentId,
  tournament,
  accessLevel,
  permissions,
  metadata,
  coupleInscriptions = [],
  individualInscriptions = [],
}: AmericanPublicViewProps) {
  void accessLevel;
  void permissions;

  const stats = {
    couples: coupleInscriptions.length,
    players: individualInscriptions.length,
  };

  const isActive = tournament.status !== "NOT_STARTED";
  const isCanceled = tournament.status === "CANCELED";
  const isAuthenticated = !!metadata.userRole;
  const canRegister = metadata.userRole === "PLAYER";
  const isGuest = !isAuthenticated;

  const registrationLauncher = (
    <PublicRegistrationLauncher
      tournamentId={tournamentId}
      tournamentName={tournament.name}
      tournamentGender={tournament.gender || Gender.MALE}
      tournamentPrice={tournament.price ?? null}
      enableTransferProof={tournament.enable_transfer_proof || false}
      transferAlias={tournament.transfer_alias || null}
      transferAmount={tournament.transfer_amount || null}
      buttonLabel="Inscribirme"
      buttonClassName="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
    />
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-12 lg:py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Torneo Americano
              </Badge>
              {isCanceled && (
                <Badge variant="destructive" className="bg-red-600 text-white border-red-700 gap-2">
                  <XCircle className="h-3 w-3" />
                  CANCELADO
                </Badge>
              )}
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-4">{tournament.name}</h1>

            {tournament.clubes?.name && (
              <div className="flex items-center justify-center gap-2 text-xl text-blue-100 mb-6">
                <MapPin className="h-5 w-5" />
                <span>{tournament.clubes.name}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <div className="text-3xl font-bold">{stats.couples}</div>
                <div className="text-blue-100 text-sm mt-1">Parejas inscriptas</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <Trophy className="h-8 w-8 mx-auto mb-2" />
                <div className="text-3xl font-bold">{stats.players}</div>
                <div className="text-blue-100 text-sm mt-1">Jugadores</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 col-span-2 md:col-span-1">
                <Calendar className="h-8 w-8 mx-auto mb-2" />
                <div className="text-lg font-bold mt-1">
                  {tournament.start_date
                    ? new Date(tournament.start_date).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Fecha por definir"}
                </div>
                <div className="text-blue-100 text-sm mt-1">Fecha de inicio</div>
              </div>
            </div>

            {isCanceled && (
              <div className="mt-8 max-w-md mx-auto">
                <div className="bg-red-100/20 border border-red-300/30 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-2 text-red-100">
                    <XCircle className="h-5 w-5" />
                    <p className="font-medium">Este torneo ha sido cancelado</p>
                  </div>
                  <p className="text-sm text-red-200 mt-2 text-center">Las inscripciones estan cerradas</p>
                </div>
              </div>
            )}

            {(isGuest || canRegister) && !isCanceled && (
              <div className="mt-8 space-y-4">
                <p className="text-blue-100 text-lg">Queres participar en este torneo?</p>
                <div className="flex justify-center">{registrationLauncher}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Informacion del torneo</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tournament.category_name && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Categoria</h3>
                    <p className="text-lg font-semibold text-slate-900">{tournament.category_name}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Genero</h3>
                  <p className="text-lg font-semibold text-slate-900">
                    {tournament.gender === "MALE"
                      ? "Masculino"
                      : tournament.gender === "FEMALE"
                        ? "Femenino"
                        : "Mixto"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Estado</h3>
                  <Badge variant={isActive ? "default" : "secondary"} className="text-sm">
                    {isActive ? "En curso" : "Proximamente"}
                  </Badge>
                </div>

                {tournament.price !== null && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-2">Precio</h3>
                    <p className="text-lg font-semibold text-slate-900">
                      {tournament.price === 0 ? "Gratis" : `$${tournament.price}`}
                    </p>
                  </div>
                )}
              </div>

              {tournament.description && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Descripcion</h3>
                  <p className="text-slate-700 whitespace-pre-wrap">{tournament.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {tournament.clubes && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Club organizador</h2>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{tournament.clubes.name}</p>
                      {tournament.clubes.address && (
                        <p className="text-sm text-slate-600">{tournament.clubes.address}</p>
                      )}
                    </div>
                  </div>

                  {tournament.clubes.phone && (
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-slate-500" />
                      <p className="text-slate-700">{tournament.clubes.phone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isGuest && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Trophy className="h-12 w-12 mx-auto text-blue-600" />
                  <h3 className="text-xl font-semibold text-slate-900">Listo para competir?</h3>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Registrate o inicia sesion y completa la inscripcion sin salir del torneo.
                  </p>
                  <div className="flex justify-center pt-2">{registrationLauncher}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {canRegister && !isGuest && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Trophy className="h-12 w-12 mx-auto text-blue-600" />
                  <h3 className="text-xl font-semibold text-slate-900">Listo para competir?</h3>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Inscribite en este torneo y empeza a jugar.
                  </p>
                  <div className="flex justify-center pt-2">{registrationLauncher}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
