import { Gender } from "@/types"

export type TournamentGenderFilter = Gender.MALE | Gender.FEMALE | Gender.MIXED

const TOURNAMENT_GENDER_FILTERS: TournamentGenderFilter[] = [
  Gender.MALE,
  Gender.FEMALE,
  Gender.MIXED,
]

const normalizeTournamentGender = (gender: string | null | undefined): TournamentGenderFilter | null => {
  if (gender === Gender.MALE || gender === Gender.FEMALE || gender === Gender.MIXED) {
    return gender
  }

  return null
}

export const isTournamentGenderFilter = (
  value: string | null | undefined,
): value is TournamentGenderFilter => {
  return TOURNAMENT_GENDER_FILTERS.includes(value as TournamentGenderFilter)
}

export const getTournamentGenderPriority = (
  playerGender: string | null | undefined,
): TournamentGenderFilter[] | null => {
  if (playerGender === Gender.MALE) {
    return [Gender.MALE, Gender.MIXED, Gender.FEMALE]
  }

  if (playerGender === Gender.FEMALE) {
    return [Gender.FEMALE, Gender.MIXED, Gender.MALE]
  }

  return null
}

export const filterTournamentsByGender = <TournamentLike extends { gender?: string | null }>(
  tournaments: TournamentLike[],
  genderFilter: string | null | undefined,
): TournamentLike[] => {
  if (!isTournamentGenderFilter(genderFilter)) {
    return tournaments
  }

  return tournaments.filter((tournament) => tournament.gender === genderFilter)
}

export const prioritizeTournamentsByGender = <TournamentLike extends { gender?: string | null }>(
  tournaments: TournamentLike[],
  playerGender: string | null | undefined,
): TournamentLike[] => {
  const priority = getTournamentGenderPriority(playerGender)

  if (!priority) {
    return tournaments
  }

  const buckets = new Map<TournamentGenderFilter, TournamentLike[]>(
    priority.map((gender) => [gender, []]),
  )
  const fallbackBucket: TournamentLike[] = []

  for (const tournament of tournaments) {
    const normalizedGender = normalizeTournamentGender(tournament.gender)

    if (!normalizedGender) {
      fallbackBucket.push(tournament)
      continue
    }

    buckets.get(normalizedGender)?.push(tournament)
  }

  return [
    ...(buckets.get(priority[0]) || []),
    ...(buckets.get(priority[1]) || []),
    ...(buckets.get(priority[2]) || []),
    ...fallbackBucket,
  ]
}
