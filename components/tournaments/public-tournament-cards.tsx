"use client"

import Link from "next/link"
import PublicRegistrationLauncher from "@/components/tournament/public-registration-launcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Gender } from "@/types"
import { CalendarDays, Clock3, MapPin, Tag, Trophy } from "lucide-react"

export interface PublicTournamentSummary {
  id: string
  name: string
  status: string
  category?: string | null
  categoryName?: string | null
  gender?: string | null
  type?: "LONG" | "AMERICAN" | string | null
  startDate?: string | null
  endDate?: string | null
  price?: number | string | null
  award?: string | null
  enablePublicInscriptions?: boolean
  club?: {
    id?: string | null
    name?: string | null
    address?: string | null
  } | null
  enableTransferProof?: boolean
  transferAlias?: string | null
  transferAmount?: number | null
}

interface PublicTournamentCardsProps {
  tournaments: PublicTournamentSummary[]
  emptyTitle: string
  emptyDescription: string
}

const typeLabel = {
  LONG: "Liga",
  AMERICAN: "Americano",
}

const genderLabel = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  MIXED: "Mixto",
}

const hasExplicitTime = (dateString: string | null | undefined) => {
  return Boolean(dateString && dateString.includes("T"))
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) {
    return "Fecha a confirmar"
  }

  const date = new Date(dateString)

  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  })
}

const formatTime = (dateString: string | null | undefined) => {
  if (!dateString || !hasExplicitTime(dateString)) {
    return "Horario a confirmar"
  }

  const date = new Date(dateString)

  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })
}

const formatSchedule = (tournament: PublicTournamentSummary) => {
  if (!tournament.startDate) {
    return "Fecha a confirmar"
  }

  if (tournament.type === "AMERICAN") {
    const timeLabel = formatTime(tournament.startDate)
    return timeLabel === "Horario a confirmar"
      ? formatDate(tournament.startDate)
      : `${formatDate(tournament.startDate)} - ${timeLabel} hs`
  }

  if (!tournament.endDate || tournament.endDate === tournament.startDate) {
    return formatDate(tournament.startDate)
  }

  return `${formatDate(tournament.startDate)} al ${formatDate(tournament.endDate)}`
}

const formatPrice = (price: number | string | null | undefined) => {
  if (price === null || price === undefined || price === "") {
    return null
  }

  if (typeof price === "number") {
    return `$${price.toLocaleString("es-AR")}`
  }

  return price
}

const resolveTournamentGender = (gender: string | null | undefined): Gender => {
  if (gender === Gender.FEMALE) {
    return Gender.FEMALE
  }

  if (gender === Gender.MIXED) {
    return Gender.MIXED
  }

  return Gender.MALE
}

export function PublicTournamentCards({
  tournaments,
  emptyTitle,
  emptyDescription,
}: PublicTournamentCardsProps) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center shadow-sm backdrop-blur-sm sm:px-6 sm:py-12">
        <h3 className="text-xl font-bold text-white">{emptyTitle}</h3>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {tournaments.map((tournament) => {
        const priceLabel = formatPrice(tournament.price)

        return (
          <Card key={tournament.id} className="overflow-hidden border-white/10 bg-brand-800/70 shadow-sm transition-shadow hover:border-court-500/40 hover:shadow-md">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-court-500 text-brand-900 hover:bg-court-500">
                      {typeLabel[(tournament.type || "LONG") as keyof typeof typeLabel] || tournament.type || "Torneo"}
                    </Badge>
                    {tournament.category || tournament.categoryName ? (
                      <Badge variant="outline" className="border-court-500/30 bg-court-500/10 text-court-200">
                        {tournament.category || tournament.categoryName}
                      </Badge>
                    ) : null}
                    {tournament.gender ? (
                      <Badge variant="outline" className="border-white/10 text-slate-300">
                        {genderLabel[tournament.gender as keyof typeof genderLabel] || tournament.gender}
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">{tournament.name}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {tournament.type === "AMERICAN"
                        ? "Formato rapido con horario puntual y registro simple."
                        : "Liga con fechas programadas y seguimiento durante la semana."}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-3 sm:px-4">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-court-300" />
                      <div>
                        <p className="font-semibold text-white">Fecha</p>
                        <p>{formatSchedule(tournament)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-3 sm:px-4">
                      <Clock3 className="mt-0.5 h-4 w-4 text-court-300" />
                      <div>
                        <p className="font-semibold text-white">Horario</p>
                        <p>
                          {tournament.startDate
                            ? hasExplicitTime(tournament.startDate)
                              ? `${formatTime(tournament.startDate)} hs`
                              : "A confirmar"
                            : "A confirmar"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-3 sm:px-4">
                      <MapPin className="mt-0.5 h-4 w-4 text-court-300" />
                      <div>
                        <p className="font-semibold text-white">Club</p>
                        <p>{tournament.club?.name || "Sede a confirmar"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-3 sm:px-4">
                      <Trophy className="mt-0.5 h-4 w-4 text-court-300" />
                      <div>
                        <p className="font-semibold text-white">Detalle</p>
                        <p>{tournament.club?.address || tournament.award || "Informacion disponible al abrir el torneo"}</p>
                      </div>
                    </div>
                  </div>

                  {(priceLabel || tournament.award) ? (
                    <div className="flex flex-wrap gap-2">
                      {priceLabel ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-court-500 px-3 py-1 text-sm font-semibold text-brand-900">
                          <Tag className="h-3.5 w-3.5" />
                          Inscripcion {priceLabel}
                        </div>
                      ) : null}
                      {tournament.award ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-court-500/15 px-3 py-1 text-sm font-semibold text-court-200">
                          <Trophy className="h-3.5 w-3.5" />
                          {tournament.award}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <PublicRegistrationLauncher
                    tournamentId={tournament.id}
                    tournamentName={tournament.name}
                    tournamentGender={resolveTournamentGender(tournament.gender)}
                    tournamentPrice={tournament.price ?? null}
                    enableTransferProof={tournament.enableTransferProof || false}
                    transferAlias={tournament.transferAlias || null}
                    transferAmount={tournament.transferAmount || null}
                    buttonClassName="h-11 bg-court-500 text-base font-semibold text-brand-900 hover:bg-court-400"
                    fullWidth
                  />
                  <Button asChild variant="outline" className="h-11 border-white/20 bg-white/5 text-base font-semibold text-white hover:bg-white/10">
                    <Link href={`/tournaments/${tournament.id}`}>Ver detalles</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
