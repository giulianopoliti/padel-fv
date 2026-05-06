import { createClient } from "@/utils/supabase/server"
import { getTenantBranding } from "@/config/tenant"

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
  category_name: string | null
  gender: string | null
  start_date: string | null
  club_name: string | null
  pre_tournament_image_url: string | null
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
  const branding = getTenantBranding()

  let organization: any = null

  const configuredSlug = branding.tenantOrganizationSlug?.trim()
  if (configuredSlug) {
    const { data } = await supabase
      .from("organizaciones")
      .select("id, slug, name, description, logo_url")
      .eq("slug", configuredSlug)
      .eq("is_active", true)
      .maybeSingle()

    organization = data
  }

  if (!organization) {
    const { data } = await supabase
      .from("organizaciones")
      .select("id, slug, name, description, logo_url")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    organization = data
  }

  if (!organization) {
    return {
      organization: null,
      tournaments: [],
      clubs: [],
      ranking: [],
    }
  }

  const [tournamentsResult, clubsResult, rankingResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, status, category_name, gender, start_date, pre_tournament_image_url, clubes(name)")
      .eq("organization_id", organization.id)
      .neq("status", "CANCELED")
      .order("start_date", { ascending: true })
      .limit(6),
    supabase
      .from("organization_clubs")
      .select("clubes(id, name, address, courts, cover_image_url)")
      .eq("organizacion_id", organization.id)
      .limit(6),
    supabase
      .from("players")
      .select("id, first_name, last_name, score, category_name, profile_image_url, clubes(name)")
      .eq("organizador_id", organization.id)
      .eq("es_prueba", false)
      .order("score", { ascending: false })
      .limit(10),
  ])

  const tournaments = (tournamentsResult.data || []).map((tournament: any) => ({
    id: tournament.id,
    name: tournament.name,
    status: tournament.status,
    category_name: tournament.category_name,
    gender: tournament.gender,
    start_date: tournament.start_date,
    pre_tournament_image_url: tournament.pre_tournament_image_url,
    club_name: Array.isArray(tournament.clubes) ? tournament.clubes[0]?.name || null : tournament.clubes?.name || null,
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

  const ranking = (rankingResult.data || []).map((player: any) => ({
    id: player.id,
    first_name: player.first_name,
    last_name: player.last_name,
    score: player.score,
    category_name: player.category_name,
    profile_image_url: player.profile_image_url,
    club_name: Array.isArray(player.clubes) ? player.clubes[0]?.name || null : player.clubes?.name || null,
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
    ranking,
  }
}
