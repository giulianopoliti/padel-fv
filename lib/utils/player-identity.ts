import { normalizePlayerDni } from "@/lib/utils/player-dni"

export interface ExistingPlayerMatch {
  id: string
  first_name: string | null
  last_name: string | null
  dni?: string | null
  dni_is_temporary?: boolean | null
  gender?: string | null
  user_id?: string | null
  score?: number | null
  category_name?: string | null
  created_at?: string | null
}

interface FindExistingPlayerParams {
  supabase: any
  firstName: string
  lastName: string
  dni?: string | null
  gender?: string | null
}

export function normalizePlayerNamePart(value?: string | null): string {
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

export function hasSameNormalizedPlayerName(
  leftFirstName?: string | null,
  leftLastName?: string | null,
  rightFirstName?: string | null,
  rightLastName?: string | null,
): boolean {
  return (
    normalizePlayerNamePart(leftFirstName) === normalizePlayerNamePart(rightFirstName) &&
    normalizePlayerNamePart(leftLastName) === normalizePlayerNamePart(rightLastName)
  )
}

export async function findExistingPlayerByIdentity({
  supabase,
  firstName,
  lastName,
  dni,
  gender,
}: FindExistingPlayerParams): Promise<{
  player: ExistingPlayerMatch | null
  matchedBy: "dni" | "name" | null
  error?: string
}> {
  const normalizedDni = normalizePlayerDni(dni)
  const normalizedFirstName = normalizePlayerNamePart(firstName)
  const normalizedLastName = normalizePlayerNamePart(lastName)
  const normalizedGender = gender?.toUpperCase() || null

  if (normalizedDni.dni) {
    const { data, error } = await supabase
      .from("players")
      .select("id, first_name, last_name, dni, dni_is_temporary, gender, user_id, score, category_name, created_at")
      .eq("dni", normalizedDni.dni)
      .eq("es_prueba", false)
      .maybeSingle()

    if (error) {
      return { player: null, matchedBy: null, error: error.message }
    }

    if (data) {
      return { player: data, matchedBy: "dni" }
    }
  }

  if (!normalizedFirstName || !normalizedLastName) {
    return { player: null, matchedBy: null }
  }

  let candidatesQuery = supabase
    .from("players")
    .select("id, first_name, last_name, dni, dni_is_temporary, gender, user_id, score, category_name, created_at")
    .eq("es_prueba", false)
    .order("created_at", { ascending: true })

  if (normalizedGender) {
    candidatesQuery = candidatesQuery.eq("gender", normalizedGender)
  }

  const { data: candidates, error } = await candidatesQuery

  if (error) {
    return { player: null, matchedBy: null, error: error.message }
  }

  const exactNameMatches = (candidates || []).filter((candidate: ExistingPlayerMatch) =>
    hasSameNormalizedPlayerName(candidate.first_name, candidate.last_name, firstName, lastName)
  )

  if (exactNameMatches.length === 0) {
    return { player: null, matchedBy: null }
  }

  const sortedExactNameMatches = [...exactNameMatches].sort((left, right) => {
    const leftHasUser = left.user_id ? 1 : 0
    const rightHasUser = right.user_id ? 1 : 0
    if (leftHasUser !== rightHasUser) return leftHasUser - rightHasUser

    const leftHasDni = normalizePlayerDni(left.dni).dni ? 1 : 0
    const rightHasDni = normalizePlayerDni(right.dni).dni ? 1 : 0
    if (leftHasDni !== rightHasDni) return leftHasDni - rightHasDni

    return (left.created_at || "").localeCompare(right.created_at || "")
  })

  if (normalizedGender) {
    const genderMatchedPlayer =
      sortedExactNameMatches.find(
        (candidate) => !candidate.gender || candidate.gender.toUpperCase() === normalizedGender,
      ) || null

    return { player: genderMatchedPlayer, matchedBy: genderMatchedPlayer ? "name" : null }
  }

  return { player: sortedExactNameMatches[0], matchedBy: "name" }
}
