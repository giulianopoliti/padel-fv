export type PlayerTournamentReference = {
  id: string
  name: string
  organizationId: string | null
}

export type PlayerIdentityCandidate = {
  id: string
  firstName: string
  lastName: string
  dni: string | null
  phone: string | null
  userId: string | null
  email: string | null
  tournaments: Array<{ id: string; name: string }>
}

export const hasExternalTournamentHistory = (
  tournaments: PlayerTournamentReference[],
  organizationId: string,
) => tournaments.some((tournament) => tournament.organizationId !== organizationId)

export const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))))
