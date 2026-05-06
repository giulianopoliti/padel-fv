import { getTournamentFormatPreset } from '@/config/tournament-format-presets';
import { TournamentConfigService } from '@/lib/services/tournament-config.service';
import { getZonesFormatIdFromTournament } from '@/lib/services/zones-format-utils';

describe('zones-format-utils', () => {
  it('maps legacy AMERICAN_3 tournaments to AMERICAN_3 rules', () => {
    const formatId = getZonesFormatIdFromTournament({
      type: 'AMERICAN',
      format_type: 'AMERICAN_3'
    });

    expect(formatId).toBe('AMERICAN_3');
  });

  it('maps v2 AMERICAN multi-zone presets to effective zone format ids', () => {
    const mz2 = getZonesFormatIdFromTournament({
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2')
    });
    const mz3 = getZonesFormatIdFromTournament({
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3')
    });

    expect(mz2).toBe('AMERICAN_2');
    expect(mz3).toBe('AMERICAN_3');
  });

  it('keeps long tournaments on LONG rules', () => {
    const formatId = getZonesFormatIdFromTournament({ type: 'LONG' });
    expect(formatId).toBe('LONG');
  });

  it('returns expected match limits for MZ2 and MZ3', () => {
    expect(TournamentConfigService.getMatchesPerCouple('AMERICAN_2', 4)).toBe(2);
    expect(TournamentConfigService.getMatchesPerCouple('AMERICAN_3', 4)).toBe(3);
    expect(TournamentConfigService.getMatchesPerCouple('AMERICAN_3', 3)).toBe(2);
  });
});
