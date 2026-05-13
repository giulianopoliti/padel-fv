import type { ReactNode } from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight, Clock3, MapPin, Ticket, Trophy, Users } from "lucide-react"
import type { UpcomingTournament } from "@/app/api/panel/actions"
import PublicRegistrationLauncher from "@/components/tournament/public-registration-launcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Gender } from "@/types"
import { formatDateLabel, formatPrice, formatTimeLabel } from "./panel-formatters"

interface PlayerFvUpcomingTournamentsSectionProps {
  tournaments: UpcomingTournament[]
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Inscripciones abiertas",
  IN_PROGRESS: "En juego",
  ZONE_PHASE: "Fase de zonas",
  BRACKET_PHASE: "Llaves",
  FINISHED: "Finalizado",
  FINISHED_POINTS_PENDING: "Finalizado",
  FINISHED_POINTS_CALCULATED: "Finalizado",
}

const typeLabels: Record<string, string> = {
  AMERICAN: "Americano",
  LONG: "Torneo largo",
}

export default function PlayerFvUpcomingTournamentsSection({
  tournaments,
}: PlayerFvUpcomingTournamentsSectionProps) {
  if (tournaments.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center shadow-sm backdrop-blur-sm sm:px-8 sm:py-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-court-500/10 text-court-300">
          <CalendarDays className="h-8 w-8" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Proximos torneos</p>
        <h2 className="text-2xl font-black text-white sm:text-3xl">No hay fechas listas para anotarte</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          En cuanto aparezcan nuevas competencias para tu categoria, vas a verlas aca primero.
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-brand-800/75 shadow-[0_18px_45px_rgba(7,12,28,0.18)] backdrop-blur-sm">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(198,222,6,0.12)_0%,rgba(18,29,57,0)_100%)] px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Inscripciones abiertas</p>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Proximos torneos</h2>
          </div>
          <Button asChild variant="ghost" className="h-auto justify-start rounded-full px-0 text-sm font-semibold text-court-300 hover:bg-transparent hover:text-court-200">
            <Link href="/tournaments/upcoming">
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {tournaments.map((tournament) => {
          const priceLabel = formatPrice(tournament.price)
          const statusLabel = statusLabels[tournament.status] || tournament.status
          const tournamentType = tournament.type || "LONG"
          const canRegister = !tournament.is_inscribed && !tournament.is_full && tournament.status === "NOT_STARTED"

          return (
            <article
              key={tournament.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/[0.07] sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-court-500 text-brand-900 hover:bg-court-500">
                      {typeLabels[tournamentType] || tournamentType}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 text-slate-200">
                      {tournament.category_name || "Categoria abierta"}
                    </Badge>
                    {tournament.is_inscribed ? (
                      <Badge variant="outline" className="border-court-400/30 bg-court-500/15 text-court-200">
                        Ya inscripto
                      </Badge>
                    ) : null}
                    {tournament.is_full && !tournament.is_inscribed ? (
                      <Badge variant="outline" className="border-white/15 text-slate-200">
                        Completo
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{tournament.name}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {tournamentType === "AMERICAN"
                        ? "Formato rapido con horario puntual, sede clara e inscripcion directa."
                        : "Torneo largo con fecha de inicio visible y toda la informacion principal a mano."}
                    </p>
                  </div>

                  {tournamentType === "AMERICAN" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoBlock
                        icon={<CalendarDays className="h-4 w-4 text-court-300" />}
                        label="Fecha"
                        value={formatDateLabel(tournament.start_date)}
                      />
                      <InfoBlock
                        icon={<Clock3 className="h-4 w-4 text-court-300" />}
                        label="Hora"
                        value={formatTimeLabel(tournament.start_date)}
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
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
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
                      <InfoBlock
                        icon={<CalendarDays className="h-4 w-4 text-court-300" />}
                        label="Fecha de inicio"
                        value={formatDateLabel(tournament.start_date)}
                      />
                      <InfoBlock
                        icon={<Trophy className="h-4 w-4 text-court-300" />}
                        label="Categoria"
                        value={tournament.category_name || "Categoria abierta"}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-white/15 text-slate-200">
                      {statusLabel}
                    </Badge>
                    {typeof tournament.max_participants === "number" ? (
                      <Badge variant="outline" className="border-white/15 text-slate-200">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {tournament.current_inscriptions}/{tournament.max_participants} parejas
                      </Badge>
                    ) : null}
                    {priceLabel ? (
                      <Badge className="bg-court-500 text-brand-900 hover:bg-court-500">
                        <Ticket className="mr-1 h-3.5 w-3.5" />
                        {priceLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                  {canRegister ? (
                    <PublicRegistrationLauncher
                      tournamentId={tournament.id}
                      tournamentName={tournament.name}
                      tournamentGender={(tournament.gender as Gender) || Gender.MALE}
                      tournamentPrice={tournament.price ?? null}
                      enableTransferProof={tournament.enable_transfer_proof || false}
                      transferAlias={tournament.transfer_alias || null}
                      transferAmount={tournament.transfer_amount || null}
                      buttonClassName="h-11 bg-court-500 text-base font-semibold text-brand-900 hover:bg-court-400"
                      fullWidth
                    />
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      <p className="font-medium text-white">
                        {tournament.is_inscribed ? "Ya estas anotado en esta fecha." : "Mira los detalles del torneo."}
                      </p>
                    </div>
                  )}

                  <Button asChild variant="outline" className="h-11 border-white/20 bg-white/5 text-base font-semibold text-white hover:bg-white/10">
                    <Link href={`/tournaments/${tournament.id}`}>
                      Ver detalles
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
