import { createClient } from "@/utils/supabase/server"
import { getTenantOrganization } from "@/lib/services/tenant-organization.service"

export interface TenantClub {
  id: string
  name: string
  address: string | null
  courts: number | null
  cover_image_url: string | null
}

export interface TenantTournament {
  id: string
  name: string
  status: string
  category: string | null
  gender: string | null
  type: "LONG" | "AMERICAN"
  startDate: string | null
  endDate: string | null
  price: number | null
  award: string | null
  enablePublicInscriptions: boolean
  club: {
    name: string | null
    address: string | null
  } | null
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
  tournaments: TenantTournament[]
  clubs: TenantClub[]
  ranking: TenantRankingPlayer[]
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

  const [tournamentsResult, clubsResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, status, category_name, gender, type, start_date, end_date, price, award, enable_public_inscriptions, clubes(name, address)")
      .eq("organization_id", organization.id)
      .eq("status", "NOT_STARTED")
      .neq("status", "CANCELED")
      .order("start_date", { ascending: true })
      .limit(12),
    supabase
      .from("organization_clubs")
      .select("clubes(id, name, address, courts, cover_image_url)")
      .eq("organizacion_id", organization.id)
      .limit(6),
  ])

  const tournaments = (tournamentsResult.data || []).map((tournament: any) => ({
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    category: tournament.category_name,
    gender: tournament.gender,
    type: tournament.type || "LONG",
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    price: tournament.price,
    award: tournament.award,
    enablePublicInscriptions: Boolean(tournament.enable_public_inscriptions),
    club: {
      name: Array.isArray(tournament.clubes) ? tournament.clubes[0]?.name || null : tournament.clubes?.name || null,
      address: Array.isArray(tournament.clubes) ? tournament.clubes[0]?.address || null : tournament.clubes?.address || null,
    },
  }))

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
