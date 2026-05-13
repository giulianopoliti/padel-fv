import type { ReactNode } from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight, MapPin, Trophy, Users } from "lucide-react"
import type { InscribedTournament } from "@/app/api/panel/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateLabel } from "./panel-formatters"

interface PlayerFvInscribedTournamentsSectionProps {
  tournaments: InscribedTournament[]
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Proximo",
  ZONE_REGISTRATION: "Proximo",
  IN_PROGRESS: "En juego",
  ZONE_PHASE: "Fase de zonas",
  BRACKET_PHASE: "Llaves",
  FINISHED: "Finalizado",
}

export default function PlayerFvInscribedTournamentsSection({
  tournaments,
}: PlayerFvInscribedTournamentsSectionProps) {
  if (tournaments.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center shadow-sm backdrop-blur-sm sm:px-8 sm:py-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-court-500/10 text-court-300">
          <Trophy className="h-8 w-8" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Mis torneos inscriptos</p>
        <h2 className="text-2xl font-black text-white sm:text-3xl">Todavia no tenes inscripciones confirmadas</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          Cuando te anotes en un torneo, aca vas a ver rapido la fecha, la sede y con quien jugas.
        </p>
        <Button asChild className="mt-6 h-11 rounded-full bg-court-500 px-6 text-base font-semibold text-brand-900 hover:bg-court-400">
          <Link href="/tournaments/upcoming">Buscar torneos</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-brand-800/75 shadow-[0_18px_45px_rgba(7,12,28,0.18)] backdrop-blur-sm">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(18,29,57,0)_100%)] px-5 py-5 sm:px-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Tu calendario activo</p>
        <h2 className="text-2xl font-black text-white sm:text-3xl">Mis torneos inscriptos</h2>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {tournaments.map((inscription) => {
          const tournament = inscription.tournament
          const partnerName = `${inscription.partner.first_name} ${inscription.partner.last_name}`.trim()

          return (
            <article
              key={tournament.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/[0.07] sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-court-500 text-brand-900 hover:bg-court-500">
                      {tournament.category_name || "Categoria abierta"}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 text-slate-200">
                      {tournament.gender || "Abierto"}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 text-slate-200">
                      {statusLabels[tournament.status] || tournament.status}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{tournament.name}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      Inscripcion confirmada para que sigas rapido la sede, la fecha y tu pareja.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      icon={<CalendarDays className="h-4 w-4 text-court-300" />}
                      label="Fecha"
                      value={formatDateLabel(tournament.start_date)}
                    />
                    <InfoBlock
                      icon={<Users className="h-4 w-4 text-court-300" />}
                      label="Pareja"
                      value={`Jugas con ${partnerName}`}
                    />
                    <InfoBlock
                      icon={<MapPin className="h-4 w-4 text-court-300" />}
                      label="Club"
                      value={tournament.club?.name || "Club a confirmar"}
                    />
                    <InfoBlock
                      icon={<MapPin className="h-4 w-4 text-court-300" />}
                      label="Direccion"
                      value={tournament.club?.address || "Direccion a confirmar"}
                    />
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-court-200">Estado</p>
                    <p className="mt-2 font-medium text-white">{statusLabels[tournament.status] || tournament.status}</p>
                  </div>

                  <Button asChild variant="outline" className="h-11 border-white/20 bg-white/5 text-base font-semibold text-white hover:bg-white/10">
                    <Link href={`/tournaments/${tournament.id}`}>
                      Ver torneo
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-court-200">{label}</p>
          <p className="mt-1 text-sm font-medium text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}
