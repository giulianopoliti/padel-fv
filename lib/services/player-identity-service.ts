import { supabaseAdmin } from "@/lib/supabase-admin"
import { normalizePlayerDni } from "@/lib/utils/player-dni"
import { levenshteinDistance } from "@/utils/player-dni-utils"

export type IdentityMatchedBy = "dni" | "name"

export interface IdentityContextItem {
  tournamentId: string
  tournamentName: string
  organizationName: string | null
  clubName: string | null
  createdAt: string
}

export interface IdentityCandidate {
  id: string
  first_name: string | null
  last_name: string | null
  dni: string | null
  gender?: string | null
  user_id?: string | null
  score?: number | null
  category_name?: string | null
  matchedBy: IdentityMatchedBy
  confidence: number
  context: IdentityContextItem[]
}

interface ResolveIdentityOptions {
  firstName: string
  lastName: string
  dni?: string | null
  gender?: string | null
  limit?: number
}

function normalizePart(value?: string | null): string {
  if (!value) return ""
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1
  const distance = levenshteinDistance(left, right)
  const maxLen = Math.max(left.length, right.length)
  if (!maxLen) return 0
  return (maxLen - distance) / maxLen
}

function splitTokens(value: string): string[] {
  return value.split(" ").map((token) => token.trim()).filter(Boolean)
}

function isTokenCompatible(searchToken: string, candidateToken: string): boolean {
  if (!searchToken || !candidateToken) return false
  if (searchToken === candidateToken) return true
  if (searchToken.length >= 3 && candidateToken.includes(searchToken)) return true
  if (candidateToken.length >= 3 && searchToken.includes(candidateToken)) return true
  if (Math.min(searchToken.length, candidateToken.length) >= 4 && similarity(searchToken, candidateToken) >= 0.84) return true
  if (Math.min(searchToken.length, candidateToken.length) >= 3 && levenshteinDistance(searchToken, candidateToken) <= 1) return true
  return false
}

function computeNameConfidence(
  sourceFirstName: string,
  sourceLastName: string,
  candidateFirstName: string,
  candidateLastName: string,
): number {
  const sourceFull = `${sourceFirstName} ${sourceLastName}`.trim()
  const sourceReverse = `${sourceLastName} ${sourceFirstName}`.trim()
  const candidateFull = `${candidateFirstName} ${candidateLastName}`.trim()
  const candidateReverse = `${candidateLastName} ${candidateFirstName}`.trim()

  if (!sourceFull || !candidateFull) return 0
  if (sourceFull === candidateFull) return 1
  if (sourceFull === candidateReverse || sourceReverse === candidateFull) return 0.97

  const sourceTokens = splitTokens(sourceFull)
  const candidateTokens = splitTokens(candidateFull)
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return 0

  const tokenCoverage = sourceTokens.filter((sourceToken) =>
    candidateTokens.some((candidateToken) => isTokenCompatible(sourceToken, candidateToken))
  ).length / sourceTokens.length

  const directSimilarity = similarity(sourceFull, candidateFull)
  const reverseSimilarity = similarity(sourceFull, candidateReverse)
  const combined = Math.max(
    tokenCoverage * 0.9,
    directSimilarity * 0.95,
    reverseSimilarity * 0.9,
  )

  return Math.min(1, combined)
}

async function getIdentityContext(playerId: string): Promise<IdentityContextItem[]> {
  const [directInscriptionsResult, couplesResult] = await Promise.all([
    supabaseAdmin
      .from("inscriptions")
      .select(`
        created_at,
        tournament:tournaments (
          id,
          name,
          club_id,
          organization_id
        )
      `)
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("couples")
      .select("id")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .limit(20),
  ])

  const coupleIds = (couplesResult.data || []).map((couple: any) => couple.id).filter(Boolean)
  const coupleInscriptionsResult = coupleIds.length
    ? await supabaseAdmin
      .from("inscriptions")
      .select(`
        created_at,
        tournament:tournaments (
          id,
          name,
          club_id,
          organization_id
        )
      `)
      .in("couple_id", coupleIds)
      .order("created_at", { ascending: false })
      .limit(20)
    : ({ data: [], error: null } as any)

  const directRows = directInscriptionsResult.data || []
  const coupleRows = coupleInscriptionsResult.data || []
  const rows = [...directRows, ...coupleRows]

  if (!rows.length) return []

  const tournaments = rows
    .map((row: any) => row.tournament)
    .filter((row: any) => row?.id)

  const clubIds = Array.from(new Set(tournaments.map((row: any) => row.club_id).filter(Boolean)))
  const organizationIds = Array.from(new Set(tournaments.map((row: any) => row.organization_id).filter(Boolean)))

  const [clubsResult, orgsResult] = await Promise.all([
    clubIds.length
      ? supabaseAdmin.from("clubes").select("id,name").in("id", clubIds)
      : Promise.resolve({ data: [], error: null } as any),
    organizationIds.length
      ? supabaseAdmin.from("organizaciones").select("id,name").in("id", organizationIds)
      : Promise.resolve({ data: [], error: null } as any),
  ])

  const clubMap = new Map((clubsResult.data || []).map((club: any) => [club.id, club.name || null]))
  const orgMap = new Map((orgsResult.data || []).map((org: any) => [org.id, org.name || null]))

  const sortedRows = rows.sort((a: any, b: any) => {
    const left = new Date(a.created_at || "").getTime()
    const right = new Date(b.created_at || "").getTime()
    return right - left
  })

  const contexts: IdentityContextItem[] = []
  const seenTournaments = new Set<string>()

  for (const row of sortedRows) {
    const tournament = (row as any).tournament
    if (!tournament?.id || seenTournaments.has(tournament.id)) continue

    seenTournaments.add(tournament.id)
    contexts.push({
      tournamentId: tournament.id,
      tournamentName: tournament.name || "Torneo",
      organizationName: tournament.organization_id ? orgMap.get(tournament.organization_id) || null : null,
      clubName: tournament.club_id ? clubMap.get(tournament.club_id) || null : null,
      createdAt: row.created_at,
    })

    if (contexts.length >= 3) break
  }

  return contexts
}

export async function resolvePlayerIdentity(options: ResolveIdentityOptions) {
  const {
    firstName,
    lastName,
    dni,
    gender,
    limit = 5,
  } = options

  const normalizedFirst = normalizePart(firstName)
  const normalizedLast = normalizePart(lastName)
  const normalizedGender = gender?.toUpperCase() || null
  const normalizedDni = normalizePlayerDni(dni)
  const candidates: IdentityCandidate[] = []
  const seenPlayerIds = new Set<string>()

  if (normalizedDni.dni) {
    const { data: byDni, error: dniError } = await supabaseAdmin
      .from("players")
      .select("id, first_name, last_name, dni, gender, user_id, score, category_name")
      .eq("dni", normalizedDni.dni)

    if (dniError) {
      return { candidates: [], error: dniError.message }
    }

    for (const player of byDni || []) {
      const context = await getIdentityContext(player.id)
      candidates.push({
        ...player,
        matchedBy: "dni",
        confidence: 1,
        context,
      })
      seenPlayerIds.add(player.id)
    }
  }

  if (normalizedFirst && normalizedLast) {
    let query = supabaseAdmin
      .from("players")
      .select("id, first_name, last_name, dni, gender, user_id, score, category_name")
      .limit(5000)

    if (normalizedGender) {
      query = query.eq("gender", normalizedGender)
    }

    const { data: pool, error: poolError } = await query
    if (poolError) {
      return { candidates: [], error: poolError.message }
    }

    const scored = (pool || [])
      .filter((player) => !seenPlayerIds.has(player.id))
      .map((player) => {
        const candidateFirst = normalizePart(player.first_name)
        const candidateLast = normalizePart(player.last_name)
        return {
          player,
          confidence: computeNameConfidence(normalizedFirst, normalizedLast, candidateFirst, candidateLast),
        }
      })
      .filter((entry) => entry.confidence >= 0.78)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, Math.max(3, limit))

    for (const entry of scored) {
      const context = await getIdentityContext(entry.player.id)
      candidates.push({
        ...entry.player,
        matchedBy: "name",
        confidence: entry.confidence,
        context,
      })
    }
  }

  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return (b.score || 0) - (a.score || 0)
  })

  const topCandidates = candidates.slice(0, limit)
  const strongest = topCandidates[0] || null

  return {
    candidates: topCandidates,
    primary: strongest,
    hasStrongMatch: !!strongest && strongest.confidence >= (strongest.matchedBy === "dni" ? 1 : 0.9),
  }
}
