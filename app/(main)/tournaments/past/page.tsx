import React from "react"
import { getTournamentsOptimized, getCategories, getOrganizationsForFilter, getClubsForFilter } from "@/app/api/tournaments"
import TournamentsLayout from "../components/tournaments-layout"
import TournamentCard from "@/components/tournament-card"
import PaginationWrapper from "../components/pagination-wrapper"
import { Archive } from "lucide-react"

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

export default async function PastTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const categoryFilter = params.category
  const organizationFilter = params.organization
  const clubFilter = params.club
  const searchTerm = params.search

  const [tournamentsData, categories, organizations, clubs] = await Promise.all([
    getTournamentsOptimized({
      status: 'past',
      page,
      limit: 30, // More items per page for past tournaments
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
            pageSize={30}
            currentPage={page}
          />
        </>
      ) : (
        <EmptyState
          icon={<Archive className="h-8 w-8 text-gray-400" />}
          title="No hay torneos pasados"
          description={
            categoryFilter || organizationFilter || clubFilter || searchTerm
              ? "No se encontraron torneos finalizados con los filtros seleccionados. Intenta ajustar tus criterios de búsqueda."
              : "No hay torneos finalizados en el sistema. Los torneos completados aparecerán aquí."
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
