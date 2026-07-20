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

export default async function UpcomingTournamentsPage({ searchParams }: PageProps) {
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
      status: "upcoming",
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
      title="Proximos torneos"
      description={`Las proximas fechas de ${branding.siteName}, ordenadas para que veas rapido categoria, horario, club e inscripcion.`}
      currentType={type}
      categories={categories}
      clubs={clubs}
    >
      <div className="space-y-8">
        <PublicTournamentCards
          tournaments={tournaments}
          emptyTitle={type === "LONG" ? "No hay ligas publicadas" : "No hay americanos publicados"}
          emptyDescription={
            categoryFilter || clubFilter || searchTerm || genderFilter
              ? "No encontramos torneos con esos filtros. Proba cambiando la categoria, el club o la busqueda."
              : `No hay torneos cargados para este formato en ${branding.siteName} en este momento.`
          }
        />

        <PaginationWrapper total={totalCount} pageSize={10} currentPage={page} />
      </div>
    </TournamentsLayout>
  )
}
