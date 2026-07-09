export interface TournamentOperationalSettings {
  enforceLongBracketMatchRequirement: boolean
}

const DEFAULT_TOURNAMENT_OPERATIONAL_SETTINGS: TournamentOperationalSettings = {
  enforceLongBracketMatchRequirement: true,
}

export const normalizeTournamentOperationalSettings = (
  settings: unknown
): TournamentOperationalSettings => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return DEFAULT_TOURNAMENT_OPERATIONAL_SETTINGS
  }

  const rawSettings = settings as Partial<Record<keyof TournamentOperationalSettings, unknown>>

  return {
    enforceLongBracketMatchRequirement:
      typeof rawSettings.enforceLongBracketMatchRequirement === 'boolean'
        ? rawSettings.enforceLongBracketMatchRequirement
        : DEFAULT_TOURNAMENT_OPERATIONAL_SETTINGS.enforceLongBracketMatchRequirement,
  }
}

export const mergeTournamentOperationalSettings = (
  currentSettings: unknown,
  nextSettings: Partial<TournamentOperationalSettings>
): TournamentOperationalSettings => ({
  ...normalizeTournamentOperationalSettings(currentSettings),
  ...nextSettings,
})

export const shouldEnforceLongBracketMatchRequirement = async (
  supabase: any,
  tournamentId: string
): Promise<boolean> => {
  const { data: rankingConfig, error } = await supabase
    .from('tournament_ranking_config')
    .select('operational_settings')
    .eq('tournament_id', tournamentId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.warn('[operational-settings] Could not load settings, using defaults:', error)
    return DEFAULT_TOURNAMENT_OPERATIONAL_SETTINGS.enforceLongBracketMatchRequirement
  }

  return normalizeTournamentOperationalSettings(
    rankingConfig?.operational_settings
  ).enforceLongBracketMatchRequirement
}
