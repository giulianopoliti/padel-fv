interface InscriptionValidationInput {
  validateInscriptions?: boolean | null
  actorRole?: string | null
  isOrganizerRegistration?: boolean
}

const MANAGEMENT_ROLES = new Set(['ADMIN', 'CLUB', 'ORGANIZADOR'])

export const shouldRequireInscriptionValidation = ({
  validateInscriptions,
  actorRole,
  isOrganizerRegistration = false,
}: InscriptionValidationInput): boolean => {
  if (!validateInscriptions || isOrganizerRegistration) return false
  return !actorRole || !MANAGEMENT_ROLES.has(actorRole)
}

export const getTournamentInscriptionPendingState = async ({
  supabase,
  tournamentId,
  actorRole,
  isOrganizerRegistration = false,
}: {
  supabase: any
  tournamentId: string
  actorRole?: string | null
  isOrganizerRegistration?: boolean
}): Promise<boolean> => {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('validate_inscriptions')
    .eq('id', tournamentId)
    .single()

  if (error || !tournament) {
    throw new Error(error?.message || 'No se pudo obtener la configuracion de inscripciones')
  }

  return shouldRequireInscriptionValidation({
    validateInscriptions: tournament.validate_inscriptions,
    actorRole,
    isOrganizerRegistration,
  })
}
