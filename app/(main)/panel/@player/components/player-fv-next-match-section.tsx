import type { ReactNode } from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight, MapPin, Swords, Users } from "lucide-react"
import type { PlayerNextMatch } from "@/app/api/panel/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMatchDateTime, formatRoundLabel } from "./panel-formatters"

interface PlayerFvNextMatchSectionProps {
  nextMatches: PlayerNextMatch[]
}

export default function PlayerFvNextMatchSection({ nextMatches }: PlayerFvNextMatchSectionProps) {
  if (nextMatches.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center shadow-sm backdrop-blur-sm sm:px-8 sm:py-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-court-500/10 text-court-300">
          <Swords className="h-8 w-8" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Mi proximo partido</p>
        <h2 className="text-2xl font-black text-white sm:text-3xl">Todavia no tenes un cruce programado</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
          Cuando se confirme tu siguiente partido lo vas a ver aca con rival, companero, horario y sede.
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-brand-800/75 shadow-[0_18px_45px_rgba(7,12,28,0.18)] backdrop-blur-sm">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(198,222,6,0.18)_0%,rgba(18,29,57,0)_100%)] px-5 py-5 sm:px-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-court-300">Agenda inmediata</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Mi proximo partido</h2>
            <p className="mt-1 text-sm text-slate-300">
              Mismo seguimiento de siempre, con una vista mas clara y prioritaria.
            </p>
          </div>
          {nextMatches.length > 1 ? (
            <Badge className="w-fit border-court-400/30 bg-court-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-court-200 hover:bg-court-500/15">
              {nextMatches.length} partidos pendientes
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {nextMatches.map((match, index) => {
          const roundLabel = formatRoundLabel(match.round)
          const isPrimary = index === 0

          return (
            <article
              key={match.match_id}
              className={[
                "overflow-hidden rounded-[1.75rem] border transition-colors",
                isPrimary
                  ? "border-court-500/35 bg-[linear-gradient(135deg,rgba(198,222,6,0.12)_0%,rgba(255,255,255,0.03)_100%)]"
                  : "border-white/10 bg-white/5 hover:bg-white/[0.07]",
              ].join(" ")}
            >
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-court-500 text-brand-900 hover:bg-court-500">
                      {isPrimary ? "Sigue ahora" : "En cola"}
                    </Badge>
                    {roundLabel ? (
                      <Badge variant="outline" className="border-white/15 text-slate-200">
                        {roundLabel}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-white/15 text-slate-200">
                      {match.status === "IN_PROGRESS" ? "En progreso" : "Pendiente"}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{match.tournament_name}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {isPrimary
                        ? "Este es el siguiente partido que deberias tener primero a la vista."
                        : "Tambien tenes este cruce pendiente en la agenda."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBlock
                      icon={<Users className="h-4 w-4 text-court-300" />}
                      label="Companero"
                      value={`Pareja con ${match.partner_name}`}
                    />
                    <InfoBlock
                      icon={<Swords className="h-4 w-4 text-court-300" />}
                      label="Rivales"
                      value={`Vs. ${match.opponent_names.join(" / ")}`}
                    />
                    <InfoBlock
                      icon={<CalendarDays className="h-4 w-4 text-court-300" />}
                      label="Fecha y hora"
                      value={formatMatchDateTime(match.scheduled_info.date, match.scheduled_info.time)}
                    />
                    <InfoBlock
                      icon={<MapPin className="h-4 w-4 text-court-300" />}
                      label="Sede"
                      value={match.scheduled_info.court || match.club_name || "Cancha a confirmar"}
                    />
                  </div>

                  {match.club_address ? <p className="text-sm text-slate-300">{match.club_address}</p> : null}
                </div>

                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">{match.club_name || "Club a confirmar"}</p>
                    <p className="mt-1">{match.club_address || "La direccion aparece aca cuando este disponible."}</p>
                  </div>

                  <Button asChild className="h-11 bg-court-500 text-base font-semibold text-brand-900 hover:bg-court-400">
                    <Link href={`/tournaments/${match.tournament_id}`}>
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
