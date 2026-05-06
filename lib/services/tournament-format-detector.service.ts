import { TournamentFormat, TournamentFormatConfig, EdgeRule } from '@/types';
import { createClient } from '@/utils/supabase/server';

export class TournamentFormatDetector {
  
  /**
   * Detects the format of a tournament based on its configuration
   */
  static detectFormat(tournament: any): TournamentFormat {
    // Check explicit format_type first
    if (tournament.format_type) {
      return tournament.format_type as TournamentFormat;
    }

    // Legacy detection based on type field
    if (tournament.type === 'LONG') {
      return 'LONG';
    }

    // Default to AMERICAN_2 for existing tournaments
    return 'AMERICAN_2';
  }

  /**
   * Gets the configuration for a specific tournament format
   */
  static getFormatConfig(format: TournamentFormat): TournamentFormatConfig {
    const configs: Record<TournamentFormat, TournamentFormatConfig> = {
      AMERICAN_2: {
        zoneRounds: 2,
        setsPerMatch: 1,
        zoneCapacity: { ideal: 4, max: 5 },
        edgeRules: [
          {
            condition: "ZONE_OVERFLOW",
            action: "ADD_ROUND",
            parameters: { targetZoneSize: 5, extraRounds: 1 }
          }
        ]
      },
      AMERICAN_3: {
        zoneRounds: 3,
        setsPerMatch: 1,
        zoneCapacity: { ideal: 4, max: 4 },
        edgeRules: [
          {
            condition: "ZONE_OVERFLOW",
            action: "CREATE_ZONE",
            parameters: { minZoneSize: 3 }
          }
        ]
      },
      LONG: {
        zoneRounds: 6, // Full round-robin for 4 couples
        setsPerMatch: 3,
        zoneCapacity: { ideal: 4, max: 4 },
        edgeRules: [
          {
            condition: "ZONE_OVERFLOW",
            action: "CREATE_ZONE",
            parameters: { minZoneSize: 3 }
          }
        ]
      }
    };

    return configs[format];
  }

  /**
   * Migrates a tournament to a new format
   */
  static async migrateToFormat(tournamentId: string, format: TournamentFormat): Promise<void> {
    const supabase = createClient();
    const config = this.getFormatConfig(format);

    const { error } = await supabase
      .from('tournaments')
      .update({
        format_type: format,
        format_config: config
      })
      .eq('id', tournamentId);

    if (error) {
      throw new Error(`Failed to migrate tournament to format ${format}: ${error.message}`);
    }

    // Update zones with new configuration
    await this.updateZonesForFormat(tournamentId, config);
  }

  /**
   * Updates existing zones to match format configuration
   */
  private static async updateZonesForFormat(
    tournamentId: string, 
    config: TournamentFormatConfig
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('zones')
      .update({
        max_couples: config.zoneCapacity.max,
        rounds_per_couple: config.zoneRounds
      })
      .eq('tournament_id', tournamentId);

    if (error) {
      throw new Error(`Failed to update zones for tournament: ${error.message}`);
    }
  }

  /**
   * Validates if a tournament can be migrated to a specific format
   */
  static async canMigrateToFormat(
    tournamentId: string, 
    targetFormat: TournamentFormat
  ): Promise<{ canMigrate: boolean; reason?: string }> {
    const supabase = createClient();

    // Check if tournament has started
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('status, type')
      .eq('id', tournamentId)
      .single();

    if (error) {
      return { canMigrate: false, reason: 'Tournament not found' };
    }

    if (tournament.status !== 'NOT_STARTED') {
      return { canMigrate: false, reason: 'Tournament has already started' };
    }

    // Check zone constraints
    const { data: zones } = await supabase
      .from('zones')
      .select('id, couples:tournament_couples(count)')
      .eq('tournament_id', tournamentId);

    if (zones) {
      const targetConfig = this.getFormatConfig(targetFormat);
      
      for (const zone of zones) {
        const coupleCount = (zone.couples as any)?.length || 0;
        if (coupleCount > targetConfig.zoneCapacity.max) {
          return { 
            canMigrate: false, 
            reason: `Zone has ${coupleCount} couples, but ${targetFormat} supports maximum ${targetConfig.zoneCapacity.max}` 
          };
        }
      }
    }

    return { canMigrate: true };
  }

  /**
   * Gets format-specific rules for zone management
   */
  static getZoneRules(format: TournamentFormat) {
    const config = this.getFormatConfig(format);
    
    return {
      maxCouplesPerZone: config.zoneCapacity.max,
      idealCouplesPerZone: config.zoneCapacity.ideal,
      roundsPerCouple: config.zoneRounds,
      setsPerMatch: config.setsPerMatch,
      edgeRules: config.edgeRules
    };
  }
}