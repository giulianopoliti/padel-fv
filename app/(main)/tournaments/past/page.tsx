import React from "react"
import { getTournamentsOptimized, getCategories, getClubsForFilter } from "@/app/api/tournaments"
import TournamentsLayout from "../components/tournaments-layout"
import PaginationWrapper from "../components/pagination-wrapper"
import { PublicTournamentCards } from "@/components/tournaments/public-tournament-cards"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    page?: string
    category?: string
    club?: string
    search?: string
    type?: string
  }>
}

export default async function PastTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const categoryFilter = params.category
  const clubFilter = params.club
  const searchTerm = params.search
  const type = params.type === "AMERICAN" ? "AMERICAN" : "LONG"

  const [tournamentsData, categories, clubs] = await Promise.all([
    getTournamentsOptimized({
      status: "past",
      page,
      limit: 10,
      filters: {
        categoryName: categoryFilter,
        clubId: clubFilter,
        search: searchTerm,
        type,
      },
    }),
    getCategories(),
    getClubsForFilter(),
  ])

  const { tournaments, totalCount } = tournamentsData

  return (
    <TournamentsLayout
      title="Torneos finalizados"
      description="Historial del circuito Padel FV con la misma lectura simple y clara del resto del sitio."
      currentType={type}
      categories={categories}
      clubs={clubs}
    >
      <div className="space-y-8">
        <PublicTournamentCards
          tournaments={tournaments}
          emptyTitle="No hay torneos finalizados"
          emptyDescription={
            categoryFilter || clubFilter || searchTerm
              ? "No encontramos torneos finalizados con esos filtros."
              : "Todavia no hay torneos finalizados para este formato."
          }
        />

        <PaginationWrapper total={totalCount} pageSize={10} currentPage={page} />
      </div>
    </TournamentsLayout>
  )
}
