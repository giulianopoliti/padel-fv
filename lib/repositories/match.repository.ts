/**
 * Match Repository - Handles all match-related database operations
 * Ensures zone_id is ALWAYS preserved and validated
 */

import { BaseRepository } from './base.repository';
import type { 
  MatchEntity, 
  MatchWithRelations, 
  CreateMatchRequest,
  MatchResult,
  MatchStatus 
} from '../domain/types/tournament.types';
import type { Database } from '@/database.types';
import { ValidationError } from '../domain/types/common.types';

type MatchRow = Database['public']['Tables']['matches']['Row'];
type MatchInsert = Database['public']['Tables']['matches']['Insert'];

export class MatchRepository extends BaseRepository {
  private readonly MATCH_SELECT_QUERY = `
    id,
    tournament_id,
    zone_id,
    couple1_id,
    couple2_id,
    court,
    status,
    round,
    result_couple1,
    result_couple2,
    winner_id,
    created_at,
    scheduled_time,
    zones!matches_zone_id_fkey (
      id,
      name
    ),
    couple1:couples!matches_couple1_id_fkey (
      id,
      player1_details:players!couples_player1_id_fkey(id, first_name, last_name),
      player2_details:players!couples_player2_id_fkey(id, first_name, last_name)
    ),
    couple2:couples!matches_couple2_id_fkey (
      id,
      player1_details:players!couples_player1_id_fkey(id, first_name, last_name),
      player2_details:players!couples_player2_id_fkey(id, first_name, last_name)
    )
  `;

  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================

  async findById(matchId: string): Promise<MatchWithRelations | null> {
    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select(this.MATCH_SELECT_QUERY)
        .eq('id', matchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToMatchWithRelations(data);
    } catch (error) {
      this.handleError(error, `findById(${matchId})`);
    }
  }

  async findByTournament(tournamentId: string): Promise<MatchWithRelations[]> {
    this.validateUuid(tournamentId, 'tournamentId');

    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select(this.MATCH_SELECT_QUERY)
        .eq('tournament_id', tournamentId)
        .order('created_at');

      if (error) throw error;

      return (data || [])
        .filter(this.validateMatchIntegrity) // CRITICAL: Ensure zone_id exists
        .map(this.mapToMatchWithRelations);
    } catch (error) {
      this.handleError(error, `findByTournament(${tournamentId})`);
    }
  }

  async findByZone(zoneId: string): Promise<MatchWithRelations[]> {
    this.validateUuid(zoneId, 'zoneId');

    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select(this.MATCH_SELECT_QUERY)
        .eq('zone_id', zoneId)
        .order('created_at');

      if (error) throw error;

      return (data || [])
        .filter(this.validateMatchIntegrity)
        .map(this.mapToMatchWithRelations);
    } catch (error) {
      this.handleError(error, `findByZone(${zoneId})`);
    }
  }

  async create(request: CreateMatchRequest): Promise<MatchEntity> {
    this.validateCreateRequest(request);

    const matchData: MatchInsert = {
      tournament_id: request.tournamentId,
      zone_id: request.zoneId, // CRITICAL: Always include zone_id
      couple1_id: request.couple1Id,
      couple2_id: request.couple2Id,
      court: request.court,
      status: 'IN_PROGRESS',
      round: 'ZONE',
      type: 'ZONE',
      scheduled_time: request.scheduledTime?.toISOString()
    };

    try {
      const { data, error } = await this.supabase
        .from('matches')
        .insert(matchData)
        .select('*')
        .single();

      if (error) throw error;

      // Double-check zone_id preservation
      if (!data.zone_id) {
        throw new ValidationError('CRITICAL: zone_id was lost during match creation');
      }

      return this.mapToMatchEntity(data);
    } catch (error) {
      this.handleError(error, 'createMatch');
    }
  }

  async updateResult(matchId: string, result: MatchResult): Promise<MatchEntity> {
    this.validateUuid(matchId, 'matchId');
    this.validateMatchResult(result);

    const updates: Partial<MatchRow> = {
      status: 'FINISHED',
      winner_id: result.winnerId,
      result_couple1: result.sets[0]?.couple1Score || 0,
      result_couple2: result.sets[0]?.couple2Score || 0
    };

    // For Long format (3 sets), add additional set results
    if (result.sets.length > 1) {
      updates.result_set2 = result.sets[1]?.couple1Score || 0;
      updates.result_couple2_set2 = result.sets[1]?.couple2Score || 0;
    }
    if (result.sets.length > 2) {
      updates.result_set3 = result.sets[2]?.couple1Score || 0;
      updates.result_couple2_set3 = result.sets[2]?.couple2Score || 0;
    }

    return await this.update('matches', matchId, updates);
  }

  async updateStatus(matchId: string, status: MatchStatus): Promise<MatchEntity> {
    return await this.update('matches', matchId, { status });
  }

  async deleteMatch(matchId: string): Promise<void> {
    // Validate match can be deleted (business rules)
    const match = await this.findById(matchId);
    if (!match) {
      throw new ValidationError(`Match ${matchId} not found`);
    }

    if (match.status === 'FINISHED') {
      throw new ValidationError('Cannot delete finished matches');
    }

    await this.delete('matches', matchId);
  }

  // ============================================================================
  // SPECIALIZED QUERIES
  // ============================================================================

  async findActiveMatchesForCouple(coupleId: string, tournamentId: string): Promise<MatchEntity[]> {
    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .in('status', ['IN_PROGRESS', 'FINISHED'])
        .or(`couple1_id.eq.${coupleId},couple2_id.eq.${coupleId}`);

      if (error) throw error;

      return (data || []).map(this.mapToMatchEntity);
    } catch (error) {
      this.handleError(error, `findActiveMatchesForCouple(${coupleId})`);
    }
  }

  async findFinishedMatchesInZone(zoneId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('matches')
        .select('couple1_id, couple2_id')
        .eq('zone_id', zoneId)
        .eq('status', 'FINISHED');

      if (error) throw error;

      const coupleIds = new Set<string>();
      (data || []).forEach(match => {
        coupleIds.add(match.couple1_id);
        coupleIds.add(match.couple2_id);
      });

      return Array.from(coupleIds);
    } catch (error) {
      this.handleError(error, `findFinishedMatchesInZone(${zoneId})`);
    }
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private validateCreateRequest(request: CreateMatchRequest): void {
    this.validateRequired(request.tournamentId, 'tournamentId');
    this.validateRequired(request.zoneId, 'zoneId');
    this.validateRequired(request.couple1Id, 'couple1Id');
    this.validateRequired(request.couple2Id, 'couple2Id');

    this.validateUuid(request.tournamentId, 'tournamentId');
    this.validateUuid(request.zoneId, 'zoneId');
    this.validateUuid(request.couple1Id, 'couple1Id');
    this.validateUuid(request.couple2Id, 'couple2Id');

    if (request.couple1Id === request.couple2Id) {
      throw new ValidationError('couple1Id and couple2Id must be different');
    }
  }

  private validateMatchResult(result: MatchResult): void {
    if (!result.sets || result.sets.length === 0) {
      throw new ValidationError('Match result must include at least one set');
    }

    if (!result.winnerId) {
      throw new ValidationError('Match result must include winner ID');
    }

    result.sets.forEach((set, index) => {
      if (set.couple1Score < 0 || set.couple2Score < 0) {
        throw new ValidationError(`Set ${index + 1} scores must be non-negative`);
      }
      if (set.couple1Score === set.couple2Score) {
        throw new ValidationError(`Set ${index + 1} cannot be a tie`);
      }
    });
  }

  private validateMatchIntegrity = (match: any): boolean => {
    if (!match.zone_id) {
      console.error(`[CRITICAL] Match ${match.id} has no zone_id - data integrity violation`);
      return false;
    }
    return true;
  };

  // ============================================================================
  // MAPPING
  // ============================================================================

  private mapToMatchEntity = (row: MatchRow): MatchEntity => {
    // CRITICAL: Ensure zone_id is preserved
    if (!row.zone_id) {
      throw new ValidationError(`Match ${row.id} missing zone_id - data integrity violation`);
    }

    const result: MatchResult | undefined = row.winner_id ? {
      sets: [{
        setNumber: 1,
        couple1Score: row.result_couple1 || 0,
        couple2Score: row.result_couple2 || 0
      }],
      winnerId: row.winner_id,
      totalScore: {
        couple1: row.result_couple1 || 0,
        couple2: row.result_couple2 || 0
      }
    } : undefined;

    return {
      id: row.id,
      tournamentId: row.tournament_id,
      zoneId: row.zone_id, // CRITICAL: Always present
      couple1Id: row.couple1_id,
      couple2Id: row.couple2_id,
      status: row.status as MatchStatus,
      round: row.round as any,
      court: row.court,
      result,
      scheduledTime: row.scheduled_time ? new Date(row.scheduled_time) : undefined,
      createdAt: new Date(row.created_at),
      type: 'ZONE'
    };
  };

  private mapToMatchWithRelations = (row: any): MatchWithRelations => {
    const baseMatch = this.mapToMatchEntity(row);

    return {
      ...baseMatch,
      zone: {
        id: row.zones?.id || row.zone_id,
        name: row.zones?.name || 'Zona Desconocida'
      },
      couple1: this.mapCoupleInfo(row.couple1),
      couple2: this.mapCoupleInfo(row.couple2),
      tournament: {
        id: row.tournament_id,
        name: 'Tournament', // Would need tournament join for full name
        format: 'AMERICAN' // Would need tournament join for actual format
      }
    };
  };

  private mapCoupleInfo = (couple: any): any => {
    if (!couple) return { id: '', player1Name: 'Unknown', player2Name: 'Unknown' };

    const player1 = Array.isArray(couple.player1_details) 
      ? couple.player1_details[0] 
      : couple.player1_details;
    const player2 = Array.isArray(couple.player2_details) 
      ? couple.player2_details[0] 
      : couple.player2_details;

    return {
      id: couple.id,
      player1Name: player1 ? `${player1.first_name} ${player1.last_name}`.trim() : 'Player 1',
      player2Name: player2 ? `${player2.first_name} ${player2.last_name}`.trim() : 'Player 2'
    };
  };
}