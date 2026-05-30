import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'
import { ZoneRulesSyncService } from '@/lib/services/zone-rules-sync.service'

type TableRows = Record<string, any[]>

const createMemorySupabase = (tables: TableRows) => {
  const updates: Array<{ table: string; values: Record<string, any>; filters: Record<string, any> }> = []

  class QueryBuilder {
    private filters: Record<string, any> = {}
    private operation: 'select' | 'update' = 'select'
    private updateValues: Record<string, any> = {}

    constructor(private readonly table: string) {}

    select() {
      return this
    }

    eq(column: string, value: any) {
      this.filters[column] = value
      return this
    }

    update(values: Record<string, any>) {
      this.operation = 'update'
      this.updateValues = values
      return this
    }

    async single() {
      const result = await this.execute()
      return {
        data: result.data?.[0] ?? null,
        error: result.error,
      }
    }

    then(resolve: any, reject: any) {
      return this.execute().then(resolve, reject)
    }

    private matches(row: Record<string, any>) {
      return Object.entries(this.filters).every(([column, value]) => row[column] === value)
    }

    private async execute() {
      if (this.operation === 'update') {
        updates.push({ table: this.table, values: this.updateValues, filters: this.filters })
        tables[this.table] = (tables[this.table] || []).map((row) => (
          this.matches(row) ? { ...row, ...this.updateValues } : row
        ))
        return { data: null, error: null }
      }

      return {
        data: (tables[this.table] || []).filter((row) => this.matches(row)),
        error: null,
      }
    }
  }

  return {
    client: {
      from: (table: string) => new QueryBuilder(table),
    },
    updates,
  }
}

describe('tournament flow unit: zone rules sync', () => {
  it('calculates temporary and multi-zone match limits from real zone size', () => {
    const tournament = {
      type: 'AMERICAN',
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
    }

    expect(ZoneRulesSyncService.resolveExpectedMetadata({ tournament, coupleCount: 2 }).roundsPerCouple).toBe(1)
    expect(ZoneRulesSyncService.resolveExpectedMetadata({ tournament, coupleCount: 3 }).roundsPerCouple).toBe(2)
    expect(ZoneRulesSyncService.resolveExpectedMetadata({ tournament, coupleCount: 4 }).roundsPerCouple).toBe(3)
  })

  it('syncs stale zone metadata and validates with the recalculated limit', async () => {
    const { client, updates } = createMemorySupabase({
      zones: [{
        id: 'zone-1',
        tournament_id: 'tournament-1',
        capacity: 3,
        max_couples: 3,
        rounds_per_couple: 2,
      }],
      tournaments: [{
        id: 'tournament-1',
        type: 'AMERICAN',
        format_type: 'AMERICAN_3',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
      }],
      zone_positions: [
        { zone_id: 'zone-1', couple_id: 'couple-1' },
        { zone_id: 'zone-1', couple_id: 'couple-2' },
        { zone_id: 'zone-1', couple_id: 'couple-3' },
        { zone_id: 'zone-1', couple_id: 'couple-4' },
      ],
      zone_couples: [],
    })

    const rules = await ZoneMatchRulesService.getRulesForZone(client, 'zone-1')

    expect(rules.maxMatchesPerCouple).toBe(3)
    expect(rules.coupleCount).toBe(4)
    expect(updates).toEqual([{
      table: 'zones',
      filters: { id: 'zone-1' },
      values: {
        capacity: 4,
        max_couples: 4,
        rounds_per_couple: 3,
      },
    }])
  })

  it('falls back to zone_couples only when zone_positions is empty', async () => {
    const { client } = createMemorySupabase({
      zones: [{
        id: 'zone-legacy',
        tournament_id: 'tournament-1',
        capacity: 3,
        max_couples: 3,
        rounds_per_couple: 2,
      }],
      tournaments: [{
        id: 'tournament-1',
        type: 'AMERICAN',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
      }],
      zone_positions: [],
      zone_couples: [
        { zone_id: 'zone-legacy', couple_id: 'couple-1' },
        { zone_id: 'zone-legacy', couple_id: 'couple-2' },
        { zone_id: 'zone-legacy', couple_id: 'couple-3' },
        { zone_id: 'zone-legacy', couple_id: 'couple-4' },
      ],
    })

    const rules = await ZoneMatchRulesService.getRulesForZone(client, 'zone-legacy')

    expect(rules.maxMatchesPerCouple).toBe(3)
    expect(rules.coupleCount).toBe(4)
  })
})
