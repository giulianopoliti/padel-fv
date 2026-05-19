"use client"

import Link from "next/link"
import PublicRegistrationLauncher from "@/components/tournament/public-registration-launcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Gender } from "@/types"
import { getTenantBranding } from "@/config/tenant"
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
  const branding = getTenantBranding()
  const isElite = branding.key === "padel-elite"

  const emptyStateClassName = isElite
    ? "tpe-shell rounded-[2rem] px-5 py-10 text-center text-white sm:px-6 sm:py-12"
    : "rounded-3xl border border-dashed border-white/20 bg-white/5 px-5 py-10 text-center shadow-sm backdrop-blur-sm sm:px-6 sm:py-12"
  const emptyTitleClassName = isElite ? "text-2xl font-black text-white" : "text-xl font-bold text-white"
  const emptyDescriptionClassName = isElite
    ? "mx-auto mt-3 max-w-2xl text-sm text-white/72 sm:text-base"
    : "mx-auto mt-3 max-w-2xl text-slate-300"
  const cardClassName = isElite
    ? "tpe-shell overflow-hidden rounded-[2rem] border-[var(--tpe-forest)] shadow-[0_20px_50px_rgba(16,24,40,0.2)]"
    : "overflow-hidden border-white/10 bg-brand-800/70 shadow-sm transition-shadow hover:border-court-500/40 hover:shadow-md"
  const primaryBadgeClassName = isElite
    ? "rounded-full border-0 bg-[var(--tpe-lime)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tpe-night)] hover:bg-[var(--tpe-lime)]"
    : "bg-court-500 text-brand-900 hover:bg-court-500"
  const secondaryBadgeClassName = isElite
    ? "tpe-chip rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
    : "border-court-500/30 bg-court-500/10 text-court-200"
  const mutedBadgeClassName = isElite
    ? "rounded-full border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80"
    : "border-white/10 text-slate-300"
  const titleClassName = isElite
    ? "text-2xl font-black uppercase tracking-tight text-[var(--tpe-paper)] sm:text-3xl"
    : "text-xl font-black tracking-tight text-white sm:text-2xl"
  const bodyTextClassName = isElite ? "text-sm font-semibold uppercase tracking-[0.03em] text-white/72" : "text-sm text-slate-300"
  const infoBoxClassName = isElite
    ? "flex items-start gap-3 rounded-2xl border border-white/16 bg-[rgba(10,19,34,0.78)] px-4 py-3 sm:px-5"
    : "flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-3 sm:px-4"
  const infoIconClassName = isElite ? "mt-0.5 h-4 w-4 text-[var(--tpe-lime)]" : "mt-0.5 h-4 w-4 text-court-300"
  const infoLabelClassName = isElite ? "text-[11px] font-black uppercase tracking-[0.14em] text-white/70" : "font-semibold text-white"
  const infoValueClassName = isElite ? "font-semibold text-white" : ""
  const pricePillClassName = isElite
    ? "inline-flex items-center gap-2 rounded-full bg-[var(--tpe-lime)] px-3 py-1 text-sm font-black uppercase tracking-[0.12em] text-[var(--tpe-night)]"
    : "inline-flex items-center gap-2 rounded-full bg-court-500 px-3 py-1 text-sm font-semibold text-brand-900"
  const awardPillClassName = isElite
    ? "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-bold uppercase tracking-[0.12em] text-[var(--tpe-paper)]"
    : "inline-flex items-center gap-2 rounded-full bg-court-500/15 px-3 py-1 text-sm font-semibold text-court-200"
  const registrationButtonClassName = isElite
    ? "h-11 rounded-full bg-[var(--tpe-lime)] text-sm font-black uppercase tracking-[0.16em] text-[var(--tpe-night)] hover:bg-[#e6ff63]"
    : "h-11 bg-court-500 text-base font-semibold text-brand-900 hover:bg-court-400"
  const detailsButtonClassName = isElite
    ? "h-11 rounded-full border-white/20 bg-white/5 text-sm font-bold uppercase tracking-[0.14em] text-white hover:bg-white/10 hover:text-white"
    : "h-11 border-white/20 bg-white/5 text-base font-semibold text-white hover:bg-white/10"

  if (tournaments.length === 0) {
    return (
      <div className={emptyStateClassName}>
        <h3 className={emptyTitleClassName}>{emptyTitle}</h3>
        <p className={emptyDescriptionClassName}>{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {tournaments.map((tournament) => {
        const priceLabel = formatPrice(tournament.price)
        const timeLabel = tournament.startDate
          ? hasExplicitTime(tournament.startDate)
            ? `${formatTime(tournament.startDate)} hs`
            : "A confirmar"
          : "A confirmar"

        return (
          <Card key={tournament.id} className={cardClassName}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={primaryBadgeClassName}>
                      {typeLabel[(tournament.type || "LONG") as keyof typeof typeLabel] || tournament.type || "Torneo"}
                    </Badge>
                    {tournament.category || tournament.categoryName ? (
                      <Badge variant="outline" className={secondaryBadgeClassName}>
                        {tournament.category || tournament.categoryName}
                      </Badge>
                    ) : null}
                    {tournament.gender ? (
                      <Badge variant="outline" className={mutedBadgeClassName}>
                        {genderLabel[tournament.gender as keyof typeof genderLabel] || tournament.gender}
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <h3 className={titleClassName}>{tournament.name}</h3>
                    <p className={`mt-1 ${bodyTextClassName}`}>
                      {tournament.type === "AMERICAN"
                        ? "Formato rapido con horario puntual y registro simple."
                        : "Liga con fechas programadas y seguimiento durante la semana."}
                    </p>
                  </div>

                  <div className={`grid gap-3 text-sm ${isElite ? "text-white" : "text-slate-200"} sm:grid-cols-2`}>
                    <div className={infoBoxClassName}>
                      <CalendarDays className={infoIconClassName} />
                      <div className="min-w-0">
                        <p className={infoLabelClassName}>Fecha</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <p className={infoValueClassName}>{formatSchedule(tournament)}</p>
                          <p className="inline-flex items-center gap-1 font-semibold text-white">
                            <Clock3 className="h-3.5 w-3.5 text-[var(--tpe-lime)]" />
                            {timeLabel}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-white/65">
                          {tournament.type === "AMERICAN" ? "Partido unico con horario definido." : "Fecha principal del torneo."}
                        </p>
                      </div>
                    </div>

                    <div className={infoBoxClassName}>
                      <MapPin className={infoIconClassName} />
                      <div className="min-w-0">
                        <p className={infoLabelClassName}>Club</p>
                        <p className={infoValueClassName}>{tournament.club?.name || "Sede a confirmar"}</p>
                        <p className="mt-1 text-xs text-white/65">
                          {tournament.club?.address || "Direccion a confirmar"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(priceLabel || tournament.award) ? (
                    <div className="flex flex-wrap gap-2">
                      {priceLabel ? (
                        <div className={pricePillClassName}>
                          <Tag className="h-3.5 w-3.5" />
                          Inscripcion {priceLabel}
                        </div>
                      ) : null}
                      {tournament.award ? (
                        <div className={awardPillClassName}>
                          <Trophy className="h-3.5 w-3.5" />
                          {tournament.award}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex w-full flex-col justify-end gap-3 lg:w-56 lg:items-center">
                  {tournament.status === "NOT_STARTED" ? (
                    <PublicRegistrationLauncher
                      tournamentId={tournament.id}
                      tournamentName={tournament.name}
                      tournamentGender={resolveTournamentGender(tournament.gender)}
                      tournamentPrice={tournament.price ?? null}
                      enableTransferProof={tournament.enableTransferProof || false}
                      transferAlias={tournament.transferAlias || null}
                      transferAmount={tournament.transferAmount || null}
                      buttonClassName={`${registrationButtonClassName} lg:max-w-[220px]`}
                      fullWidth
                    />
                  ) : null}
                  <Button asChild variant="outline" className={`${detailsButtonClassName} lg:max-w-[220px]`}>
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
