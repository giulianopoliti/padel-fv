"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PublicTournamentCards, type PublicTournamentSummary } from "@/components/tournaments/public-tournament-cards"

interface HomeTournamentTabsProps {
  tournaments: PublicTournamentSummary[]
}

export function HomeTournamentTabs({ tournaments }: HomeTournamentTabsProps) {
  const [activeType, setActiveType] = useState<"LONG" | "AMERICAN">("LONG")

  const filteredTournaments = useMemo(
    () => tournaments.filter((tournament) => (tournament.type || "LONG") === activeType),
    [activeType, tournaments],
  )

  return (
    <div className="space-y-6">
      <Tabs value={activeType} onValueChange={(value) => setActiveType(value as "LONG" | "AMERICAN")}>
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-2xl bg-brand-100/70 p-1">
          <TabsTrigger
            value="LONG"
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-brand-700"
          >
            Ligas
          </TabsTrigger>
          <TabsTrigger
            value="AMERICAN"
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-brand-700"
          >
            Americanos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PublicTournamentCards
        tournaments={filteredTournaments}
        emptyTitle={activeType === "LONG" ? "No hay ligas publicadas" : "No hay americanos publicados"}
        emptyDescription="En cuanto Padel FV cargue nuevos torneos, van a aparecer aca automaticamente."
      />
    </div>
  )
}
