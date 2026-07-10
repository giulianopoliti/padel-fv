import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import {
  getBracketReplacementCutLines,
  getCoupleDisplayName,
} from '@/lib/services/bracket-replacement.service'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'

describe('bracket replacement service', () => {
  it('uses gold and silver cut lines for gold/silver long tournaments', () => {
    const config = getTournamentFormatPreset('LONG_SINGLE_ZONE_GOLD_SILVER')
    config.advancementConfig = {
      kind: 'GOLD_SILVER',
      goldCount: 6,
      silverCount: 4,
      eliminatedCount: 2,
    }
    const format = TournamentFormatResolver.getResolvedFormat({ format_config: config })

    expect(getBracketReplacementCutLines({
      bracketKey: 'GOLD',
      format,
      currentSeedCount: 6,
    })).toEqual([
      { afterPosition: 6, label: 'Corte Copa de Oro' },
      { afterPosition: 10, label: 'Corte Copa de Plata' },
    ])
  })

  it('uses the configured advance count for single-bracket long tournaments', () => {
    const config = getTournamentFormatPreset('LONG_SINGLE_ZONE_BRACKET')
    config.advancementConfig = {
      kind: 'SINGLE',
      advanceCount: 12,
    }
    const format = TournamentFormatResolver.getResolvedFormat({ format_config: config })

    expect(getBracketReplacementCutLines({
      bracketKey: 'MAIN',
      format,
      currentSeedCount: 8,
    })).toEqual([
      { afterPosition: 12, label: 'Corte de clasificacion' },
    ])
  })

  it('formats couple names from the players aliases used by Supabase queries', () => {
    expect(getCoupleDisplayName({
      players_player1: { first_name: 'Ana', last_name: 'Lopez' },
      players_player2: { first_name: 'Mia', last_name: 'Perez' },
    })).toBe('Ana Lopez / Mia Perez')
  })

  it('formats couple names when Supabase relation typing returns arrays', () => {
    expect(getCoupleDisplayName({
      players_player1: [{ first_name: 'Leo', last_name: 'Diaz' }],
      players_player2: [{ first_name: 'Noa', last_name: 'Ruiz' }],
    })).toBe('Leo Diaz / Noa Ruiz')
  })
})
