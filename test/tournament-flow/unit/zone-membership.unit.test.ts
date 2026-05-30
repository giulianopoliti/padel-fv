jest.mock('@/lib/services/zone-rules-sync.service', () => ({
  ZoneRulesSyncService: {
    syncZoneRulesForZones: jest.fn(async () => []),
  },
}))

import {
  ensureCanonicalZoneMembership,
  removeTournamentCoupleMembership,
} from '@/lib/services/tournament-zone-membership'

const query = (terminal: any = { data: null, error: null }) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue(terminal),
  single: jest.fn().mockResolvedValue(terminal),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  then: (resolve: any) => resolve(terminal),
})

describe('tournament flow unit: canonical zone membership', () => {
  it('writes zone_positions first and mirrors zone_couples as best effort', async () => {
    const callOrder: string[] = []
    const existingPosition = query({ data: null, error: null })
    const maxPosition = query({ data: null, error: null })
    const insertPosition = query({ data: { id: 'zp-1' }, error: null })
    const existingMirror = query({ data: null, error: null })
    const insertMirror = query({ data: null, error: { message: 'legacy mirror failed' } })

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'zone_positions' && callOrder.length === 0) {
          callOrder.push('select-zone_positions-existing')
          return existingPosition
        }
        if (table === 'zone_positions' && callOrder.length === 1) {
          callOrder.push('select-zone_positions-max')
          return maxPosition
        }
        if (table === 'zone_positions' && callOrder.length === 2) {
          callOrder.push('insert-zone_positions')
          return insertPosition
        }
        if (table === 'zone_couples' && callOrder.length === 3) {
          callOrder.push('select-zone_couples-existing')
          return existingMirror
        }

        callOrder.push('insert-zone_couples')
        return insertMirror
      }),
    }

    const result = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: 'tournament-1',
      zoneId: 'zone-1',
      coupleId: 'couple-1',
    })

    expect(result.success).toBe(true)
    expect(result.zonePositionId).toBe('zp-1')
    expect(result.mirroredToZoneCouples).toBe(false)
    expect(result.mirrorWarning).toBe('legacy mirror failed')
    expect(callOrder).toEqual([
      'select-zone_positions-existing',
      'select-zone_positions-max',
      'insert-zone_positions',
      'select-zone_couples-existing',
      'insert-zone_couples',
    ])
  })

  it('is idempotent when zone_positions already has the canonical row', async () => {
    const existingPosition = query({ data: { id: 'zp-existing' }, error: null })
    const existingMirror = query({ data: { zone_id: 'zone-1' }, error: null })

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(existingPosition)
        .mockReturnValueOnce(existingMirror),
    }

    const result = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: 'tournament-1',
      zoneId: 'zone-1',
      coupleId: 'couple-1',
    })

    expect(result.success).toBe(true)
    expect(result.zonePositionId).toBe('zp-existing')
    expect(existingPosition.insert).not.toHaveBeenCalled()
  })

  it('removes zone_positions, legacy mirrors, and inscription in that order', async () => {
    const zones = query({ data: [{ id: 'zone-1' }, { id: 'zone-2' }], error: null })
    const deletePositions = query({ data: null, error: null })
    const deleteMirrors = query({ data: null, error: null })
    const deleteInscriptions = query({ data: null, error: null })

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(zones)
        .mockReturnValueOnce(deletePositions)
        .mockReturnValueOnce(deleteMirrors)
        .mockReturnValueOnce(deleteInscriptions),
    }

    const result = await removeTournamentCoupleMembership({
      supabase,
      tournamentId: 'tournament-1',
      coupleId: 'couple-1',
      deleteInscription: true,
    })

    expect(result).toEqual({ success: true, zonesCount: 2 })
    expect(supabase.from.mock.calls.map(([table]) => table)).toEqual([
      'zones',
      'zone_positions',
      'zone_couples',
      'inscriptions',
    ])
  })
})
