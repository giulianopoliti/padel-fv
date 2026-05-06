import React from "react"
import { getTournamentsOptimized, getCategories, getOrganizationsForFilter, getClubsForFilter } from "@/app/api/tournaments"
import TournamentsLayout from "../components/tournaments-layout"
import TournamentCard from "@/components/tournament-card"
import PaginationWrapper from "../components/pagination-wrapper"
import { Calendar } from "lucide-react"

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    page?: string
    category?: string
    organization?: string
    club?: string
    search?: string
  }>
}

export default async function UpcomingTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const categoryFilter = params.category
  const organizationFilter = params.organization
  const clubFilter = params.club
  const searchTerm = params.search

  const [tournamentsData, categories, organizations, clubs] = await Promise.all([
    getTournamentsOptimized({
      status: 'upcoming',
      page,
      limit: 12,
      filters: {
        categoryName: categoryFilter,
        organizationId: organizationFilter,
        clubId: clubFilter,
        search: searchTerm
      }
    }),
    getCategories(),
    getOrganizationsForFilter(),
    getClubsForFilter()
  ])

  const { tournaments, totalCount, totalPages } = tournamentsData

  return (
    <TournamentsLayout categories={categories} organizations={organizations} clubs={clubs}>
      {tournaments.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                categories={categories}
                showViewButton={true}
                showStatus={true}
              />
            ))}
          </div>

          <PaginationWrapper
            total={totalCount}
            pageSize={12}
            currentPage={page}
          />
        </>
      ) : (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-gray-400" />}
          title="No hay próximos torneos"
          description={
            categoryFilter || organizationFilter || clubFilter || searchTerm
              ? "No se encontraron torneos con los filtros seleccionados. Intenta ajustar tus criterios de búsqueda."
              : "No hay próximos torneos disponibles en este momento. Vuelve a consultar más tarde."
          }
        />
      )}
    </TournamentsLayout>
  )
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center py-12">
      <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">{icon}</div>
      <h3 className="text-xl font-medium text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 max-w-md mx-auto">{description}</p>
    </div>
  )
}
