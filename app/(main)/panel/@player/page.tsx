import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { createClient } from "@/utils/supabase/server"
import { getTenantBranding } from "@/config/tenant"
import {
  getPlayerDashboardData,
  getPlayerInscribedTournaments,
  getPlayerUpcomingTournaments,
} from "@/app/api/panel/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PlayerInscribedTournamentsSection from "./components/player-inscribed-tournaments-section"
import PlayerNextMatchSection from "./components/player-next-match-section"
import PlayerUpcomingTournamentsSection from "./components/player-upcoming-tournaments-section"
import LegacyPlayerDashboard from "@/app/(main)/panel-cpa/@player/page"

export const dynamic = "force-dynamic"

export default async function PlayerDashboard() {
  const branding = getTenantBranding()

  if (branding.features.playerPanelVariant !== "padel-elite") {
    return <LegacyPlayerDashboard />
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>No autorizado</div>
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "PLAYER") {
    return null
  }

  const { playerData, nextMatches } = await getPlayerDashboardData(user.id)

  const { inscribedTournaments } = playerData?.id
    ? await getPlayerInscribedTournaments(playerData.id)
    : { inscribedTournaments: [] }

  const { upcomingTournaments } = playerData?.id
    ? await getPlayerUpcomingTournaments(playerData.id)
    : { upcomingTournaments: [] }

  const firstName = playerData?.first_name || "Jugador"

  return (
    <div className="tpe-page min-h-screen">
      <section className="container mx-auto px-4 pb-14 pt-6 sm:px-6 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="tpe-kicker mb-4">Panel jugador</p>
                <h1 className="text-4xl font-black tracking-[-0.04em] text-[var(--tpe-night)] sm:text-5xl">
                  Inscribite rapido y segui tu agenda
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-700 sm:text-lg">
                  Hola {firstName}. Priorizamos tus proximos torneos para que puedas anotarte en pocos toques y ver
                  enseguida lo que ya tenes confirmado.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {playerData?.category_name ? (
                  <Badge className="rounded-full border-0 bg-[var(--tpe-night)] px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[var(--tpe-paper)]">
                    Categoria {playerData.category_name}
                  </Badge>
                ) : null}
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-[var(--tpe-night)] px-8 py-6 text-sm font-black uppercase tracking-[0.16em] text-[var(--tpe-paper)] hover:bg-[var(--tpe-night-soft)]"
                >
                  <Link href="/tournaments/upcoming">
                    Ver torneos
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <PlayerUpcomingTournamentsSection tournaments={upcomingTournaments} />
            <PlayerInscribedTournamentsSection tournaments={inscribedTournaments} />
            <PlayerNextMatchSection nextMatches={nextMatches || []} />
          </div>
        </div>
      </section>
    </div>
  )
}
