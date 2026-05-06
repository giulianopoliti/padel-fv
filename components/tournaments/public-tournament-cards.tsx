import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, Clock3, MapPin, Tag, Trophy } from "lucide-react"

export interface PublicTournamentSummary {
  id: string
  name: string
  status: string
  category?: string | null
  gender?: string | null
  type?: "LONG" | "AMERICAN"
  startDate?: string | null
  endDate?: string | null
  price?: number | string | null
  award?: string | null
  enablePublicInscriptions?: boolean
  club?: {
    name?: string | null
    address?: string | null
  } | null
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

const getRegistrationHref = (tournament: PublicTournamentSummary) => {
  if (tournament.enablePublicInscriptions) {
    return `/tournaments/${tournament.id}/inscriptions`
  }

  return `/tournaments/${tournament.id}`
}

export function PublicTournamentCards({
  tournaments,
  emptyTitle,
  emptyDescription,
}: PublicTournamentCardsProps) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center shadow-sm">
        <h3 className="text-xl font-bold text-brand-900">{emptyTitle}</h3>
        <p className="mx-auto mt-3 max-w-2xl text-slate-500">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {tournaments.map((tournament) => {
        const priceLabel = formatPrice(tournament.price)

        return (
          <Card key={tournament.id} className="overflow-hidden border-brand-100 shadow-sm transition-shadow hover:border-brand-200 hover:shadow-md">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-brand-600 text-white hover:bg-brand-600">
                      {typeLabel[tournament.type || "LONG"]}
                    </Badge>
                    {tournament.category ? (
                      <Badge variant="outline" className="border-brand-200 bg-brand-50 text-brand-800">
                        {tournament.category}
                      </Badge>
                    ) : null}
                    {tournament.gender ? (
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        {genderLabel[tournament.gender as keyof typeof genderLabel] || tournament.gender}
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-brand-900">{tournament.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {tournament.type === "AMERICAN"
                        ? "Formato rapido con horario puntual y registro simple."
                        : "Liga con fechas programadas y seguimiento durante la semana."}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-brand-600" />
                      <div>
                        <p className="font-semibold text-brand-900">Fecha</p>
                        <p>{formatSchedule(tournament)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3">
                      <Clock3 className="mt-0.5 h-4 w-4 text-brand-600" />
                      <div>
                        <p className="font-semibold text-brand-900">Horario</p>
                        <p>
                          {tournament.startDate
                            ? hasExplicitTime(tournament.startDate)
                              ? `${formatTime(tournament.startDate)} hs`
                              : "A confirmar"
                            : "A confirmar"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-brand-600" />
                      <div>
                        <p className="font-semibold text-brand-900">Club</p>
                        <p>{tournament.club?.name || "Sede a confirmar"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3">
                      <Trophy className="mt-0.5 h-4 w-4 text-brand-600" />
                      <div>
                        <p className="font-semibold text-brand-900">Detalle</p>
                        <p>{tournament.club?.address || tournament.award || "Informacion disponible al abrir el torneo"}</p>
                      </div>
                    </div>
                  </div>

                  {(priceLabel || tournament.award) ? (
                    <div className="flex flex-wrap gap-2">
                      {priceLabel ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-court-100 px-3 py-1 text-sm font-semibold text-brand-900">
                          <Tag className="h-3.5 w-3.5" />
                          Inscripcion {priceLabel}
                        </div>
                      ) : null}
                      {tournament.award ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                          <Trophy className="h-3.5 w-3.5" />
                          {tournament.award}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <Button asChild className="h-11 bg-brand-600 text-base font-semibold text-white hover:bg-brand-700">
                    <Link href={getRegistrationHref(tournament)}>Inscribirme</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 border-brand-200 text-base font-semibold text-brand-700 hover:bg-brand-50">
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
