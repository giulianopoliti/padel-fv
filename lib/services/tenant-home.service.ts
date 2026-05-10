import { createClient } from "@/utils/supabase/server"
import { getTenantOrganization } from "@/lib/services/tenant-organization.service"
import type { PublicTournamentSummary } from "@/types/public-tournament"

export interface TenantClub {
  id: string
  name: string
  address: string | null
  courts: number | null
  cover_image_url: string | null
}

export interface TenantRankingPlayer {
  id: string
  first_name: string | null
  last_name: string | null
  score: number | null
  category_name: string | null
  club_name: string | null
  profile_image_url: string | null
}

export interface TenantHomeData {
  organization: {
    id: string
    slug: string | null
    name: string
    description: string | null
    logo_url: string | null
  } | null
  tournaments: PublicTournamentSummary[]
  clubs: TenantClub[]
  ranking: TenantRankingPlayer[]
}

export async function getTenantUpcomingTournamentSummaries(limit: number = 12): Promise<PublicTournamentSummary[]> {
  const supabase = await createClient()
  const organization = await getTenantOrganization()

  if (!organization) {
    return []
  }

  const { data } = await supabase
    .from("tournaments")
    .select(`
      id,
      name,
      status,
      category_name,
      gender,
      type,
      start_date,
      end_date,
      price,
      award,
      enable_public_inscriptions,
      enable_transfer_proof,
      transfer_alias,
      transfer_amount,
      clubes(id, name, address)
    `)
    .eq("organization_id", organization.id)
    .eq("status", "NOT_STARTED")
    .neq("status", "CANCELED")
    .order("start_date", { ascending: true })
    .limit(limit)

  return (data || []).map((tournament: any) => {
    const club = Array.isArray(tournament.clubes) ? tournament.clubes[0] || null : tournament.clubes || null

    return {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      category: tournament.category_name,
      categoryName: tournament.category_name,
      gender: tournament.gender,
      type: tournament.type || "LONG",
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      price: tournament.price,
      award: tournament.award,
      enablePublicInscriptions: Boolean(tournament.enable_public_inscriptions),
      enableTransferProof: Boolean(tournament.enable_transfer_proof),
      transferAlias: tournament.transfer_alias,
      transferAmount: tournament.transfer_amount,
      club: club
        ? {
            id: club.id || null,
            name: club.name || null,
            address: club.address || null,
          }
        : null,
    }
  })
}

export async function getTenantHomeData(): Promise<TenantHomeData> {
  const supabase = await createClient()
  const organization = await getTenantOrganization()

  if (!organization) {
    return {
      organization: null,
      tournaments: [],
      clubs: [],
      ranking: [],
    }
  }

  const [tournaments, clubsResult] = await Promise.all([
    getTenantUpcomingTournamentSummaries(12),
    supabase
      .from("organization_clubs")
      .select("clubes(id, name, address, courts, cover_image_url)")
      .eq("organizacion_id", organization.id)
      .limit(6),
  ])

  const clubs = (clubsResult.data || [])
    .map((item: any) => item.clubes)
    .filter(Boolean)
    .map((club: any) => ({
      id: club.id,
      name: club.name,
      address: club.address,
      courts: club.courts,
      cover_image_url: club.cover_image_url,
    }))

  return {
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      description: organization.description,
      logo_url: organization.logo_url,
    },
    tournaments,
    clubs,
    ranking: [],
  }
}
