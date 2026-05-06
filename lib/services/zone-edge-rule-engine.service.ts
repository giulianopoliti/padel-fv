import { TournamentFormat, ZoneOverflowStrategy, EdgeRule } from '@/types';
import { TournamentFormatDetector } from './tournament-format-detector.service';
import { createClient } from '@/utils/supabase/server';

export interface ZoneOverflowResolution {
  strategy: ZoneOverflowStrategy;
  affectedZones: string[];
  newConfiguration: {
    roundsPerCouple?: number;
    maxCouples?: number;
  };
  warning?: string;
}

export class ZoneEdgeRuleEngine {
  
  /**
   * Resolves zone overflow when adding new couples
   */
  static async resolveZoneOverflow(
    tournamentId: string,
    targetZoneId: string,
    currentZoneSize: number,
    newCouples: number
  ): Promise<ZoneOverflowResolution[]> {
    const supabase = createClient();
    
    // Get tournament format
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('format_type, format_config')
      .eq('id', tournamentId)
      .single();

    const format = TournamentFormatDetector.detectFormat(tournament);
    const rules = TournamentFormatDetector.getZoneRules(format);
    
    const finalSize = currentZoneSize + newCouples;
    const strategies: ZoneOverflowResolution[] = [];

    // Strategy 1: Add to current zone if within max capacity
    if (finalSize <= rules.maxCouplesPerZone) {
      strategies.push({
        strategy: { type: "NORMAL_ZONE", zones: [targetZoneId] },
        affectedZones: [targetZoneId],
        newConfiguration: this.calculateRoundsForZoneSize(finalSize, format)
      });
    }

    // Strategy 2: Overflow handling (5 couples in AMERICAN_2)
    if (finalSize === 5 && format === 'AMERICAN_2') {
      strategies.push({
        strategy: { 
          type: "OVERFLOW_ZONE", 
          zones: [targetZoneId],
          warning: "La zona tendrá 5 parejas y jugará 3 partidos en lugar de 2"
        },
        affectedZones: [targetZoneId],
        newConfiguration: {
          roundsPerCouple: 3,
          maxCouples: 5
        },
        warning: "Esta zona jugará 3 partidos por pareja debido al número impar"
      });
    }

    // Strategy 3: Create new zone
    const availableZones = await this.getAvailableZones(tournamentId);
    const canCreateNewZone = availableZones.length === 0 || newCouples >= rules.idealCouplesPerZone;
    
    if (canCreateNewZone) {
      strategies.push({
        strategy: { 
          type: "NEW_ZONE",
          disabled: newCouples < 3 // Minimum couples for a new zone
        },
        affectedZones: [],
        newConfiguration: this.calculateRoundsForZoneSize(newCouples, format),
        warning: newCouples < 3 ? "Se necesitan al menos 3 parejas para crear una zona nueva" : undefined
      });
    }

    // Strategy 4: Distribute among available zones
    if (availableZones.length > 0) {
      const distributionPlan = this.planCoupleDistribution(availableZones, newCouples, rules);
      if (distributionPlan.feasible) {
        strategies.push({
          strategy: { 
            type: "NORMAL_ZONE", 
            zones: distributionPlan.targetZones
          },
          affectedZones: distributionPlan.targetZones,
          newConfiguration: {},
          warning: `Se distribuirán entre ${distributionPlan.targetZones.length} zonas disponibles`
        });
      }
    }

    return strategies;
  }

  /**
   * Calculates required rounds for a zone size based on format
   */
  private static calculateRoundsForZoneSize(zoneSize: number, format: TournamentFormat) {
    if (format === 'AMERICAN_2') {
      // Special case: 5 couples need 3 rounds, others need 2
      return {
        roundsPerCouple: zoneSize === 5 ? 3 : 2,
        maxCouples: zoneSize
      };
    }
    
    if (format === 'AMERICAN_3') {
      // Always 3 rounds regardless of size
      return {
        roundsPerCouple: 3,
        maxCouples: zoneSize
      };
    }
    
    if (format === 'LONG') {
      // Full round-robin: each couple plays against all others
      return {
        roundsPerCouple: zoneSize - 1,
        maxCouples: zoneSize
      };
    }

    // Default fallback
    return {
      roundsPerCouple: 2,
      maxCouples: zoneSize
    };
  }

  /**
   * Gets zones that can accept more couples
   */
  private static async getAvailableZones(tournamentId: string) {
    const supabase = createClient();
    
    const { data: zones } = await supabase
      .from('zones')
      .select(`
        id, 
        name, 
        max_couples,
        couples:tournament_couples(count)
      `)
      .eq('tournament_id', tournamentId);

    if (!zones) return [];

    return zones.filter(zone => {
      const currentSize = (zone.couples as any)?.length || 0;
      const maxSize = zone.max_couples || 4;
      return currentSize < maxSize;
    });
  }

  /**
   * Plans how to distribute couples among available zones
   */
  private static planCoupleDistribution(
    availableZones: any[],
    newCouples: number,
    rules: any
  ) {
    let remainingCouples = newCouples;
    const targetZones: string[] = [];
    
    for (const zone of availableZones) {
      if (remainingCouples === 0) break;
      
      const currentSize = (zone.couples as any)?.length || 0;
      const availableSpace = (zone.max_couples || rules.maxCouplesPerZone) - currentSize;
      
      if (availableSpace > 0) {
        targetZones.push(zone.id);
        remainingCouples -= Math.min(remainingCouples, availableSpace);
      }
    }

    return {
      feasible: remainingCouples === 0,
      targetZones,
      remainingCouples
    };
  }

  /**
   * Validates if a zone movement is allowed based on format rules
   */
  static async validateZoneMovement(
    tournamentId: string,
    coupleId: string,
    sourceZoneId: string,
    targetZoneId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const supabase = createClient();

    // Check if couples have played matches
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .or(`couple_1.eq.${coupleId},couple_2.eq.${coupleId}`)
      .neq('status', 'PENDING');

    if (matches && matches.length > 0) {
      return {
        allowed: false,
        reason: 'No se puede mover una pareja que ya ha jugado partidos'
      };
    }

    // Check target zone capacity
    const { data: targetZone } = await supabase
      .from('zones')
      .select(`
        max_couples,
        couples:tournament_couples(count)
      `)
      .eq('id', targetZoneId)
      .single();

    if (targetZone) {
      const currentSize = (targetZone.couples as any)?.length || 0;
      const maxSize = targetZone.max_couples || 4;
      
      if (currentSize >= maxSize) {
        return {
          allowed: false,
          reason: `La zona de destino está llena (${currentSize}/${maxSize} parejas)`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Applies edge rules for a specific tournament format
   */
  static async applyEdgeRules(
    tournamentId: string,
    zoneId: string,
    rule: EdgeRule
  ): Promise<void> {
    const supabase = createClient();

    switch (rule.action) {
      case "ADD_ROUND":
        await supabase
          .from('zones')
          .update({
            rounds_per_couple: rule.parameters?.extraRounds || 3
          })
          .eq('id', zoneId);
        break;

      case "MODIFY_ROUNDS":
        await supabase
          .from('zones')
          .update({
            rounds_per_couple: rule.parameters?.newRounds || 2
          })
          .eq('id', zoneId);
        break;

      case "CREATE_ZONE":
        // This would be handled by the zone creation service
        break;

      case "MERGE_ZONES":
        // This would be handled by the zone management service
        break;

      default:
        console.warn(`Unknown edge rule action: ${rule.action}`);
    }
  }

  /**
   * Gets the optimal zone configuration for a given number of couples
   */
  static getOptimalZoneConfiguration(
    totalCouples: number,
    format: TournamentFormat
  ) {
    const rules = TournamentFormatDetector.getZoneRules(format);
    const idealZoneSize = rules.idealCouplesPerZone;
    const maxZoneSize = rules.maxCouplesPerZone;

    const baseZones = Math.floor(totalCouples / idealZoneSize);
    const remainder = totalCouples % idealZoneSize;

    let configuration = {
      zones: baseZones,
      distribution: new Array(baseZones).fill(idealZoneSize),
      warnings: [] as string[]
    };

    if (remainder > 0) {
      if (remainder >= 3) {
        // Create additional zone
        configuration.zones += 1;
        configuration.distribution.push(remainder);
      } else {
        // Distribute remainder among existing zones
        for (let i = 0; i < remainder && i < configuration.zones; i++) {
          if (configuration.distribution[i] < maxZoneSize) {
            configuration.distribution[i] += 1;
          }
        }
      }
    }

    // Add warnings for special cases
    configuration.distribution.forEach((size, index) => {
      if (size === 5 && format === 'AMERICAN_2') {
        configuration.warnings.push(`Zona ${index + 1} tendrá 5 parejas y jugará 3 partidos`);
      }
    });

    return configuration;
  }
}