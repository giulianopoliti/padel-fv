import { redirect } from "next/navigation"
import { getTournamentsOptimized, getCategories, getClubsForFilter } from "@/app/api/tournaments"
import TournamentsLayout from "../components/tournaments-layout"
import PaginationWrapper from "../components/pagination-wrapper"
import { PublicTournamentCards } from "@/components/tournaments/public-tournament-cards"
import { getDefaultPublicTournamentType, getTenantBranding } from "@/config/tenant"
import { isTournamentGenderFilter } from "@/lib/tournaments/gender-filtering"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    page?: string
    category?: string
    club?: string
    gender?: string
    search?: string
    type?: string
  }>
}

export default async function InProgressTournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const branding = getTenantBranding()

  if (branding.key !== "padel-elite") {
    const queryString = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
    ).toString()
    redirect(`/tournaments${queryString ? `?${queryString}` : ""}`)
  }

  const page = Number(params.page) || 1
  const categoryFilter = params.category
  const clubFilter = params.club
  const genderFilter = isTournamentGenderFilter(params.gender) ? params.gender : undefined
  const searchTerm = params.search
  const defaultType = getDefaultPublicTournamentType()
  const type = params.type === "AMERICAN" || params.type === "LONG" ? params.type : defaultType

  const [tournamentsData, categories, clubs] = await Promise.all([
    getTournamentsOptimized({
      status: "in-progress",
      page,
      limit: 10,
      filters: {
        categoryName: categoryFilter,
        clubId: clubFilter,
        gender: genderFilter,
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
      title="Torneos activos"
      description={`Seguimiento simple de los torneos que ya estan en juego dentro de ${branding.siteName}.`}
      currentType={type}
      categories={categories}
      clubs={clubs}
    >
      <div className="space-y-8">
        <PublicTournamentCards
          tournaments={tournaments}
          emptyTitle="No hay torneos activos"
          emptyDescription={
            categoryFilter || clubFilter || genderFilter || searchTerm
              ? "No encontramos torneos activos con esos filtros."
              : `No hay torneos activos para este formato en ${branding.siteName} en este momento.`
          }
        />

        <PaginationWrapper total={totalCount} pageSize={10} currentPage={page} />
      </div>
    </TournamentsLayout>
  )
}
