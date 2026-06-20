jest.mock('@/lib/services/zone-rules-sync.service', () => ({
  ZoneRulesSyncService: {
    syncZoneRulesForZones: jest.fn(async () => []),
  },
}))

import {
  ensureCanonicalZoneMembership,
  removeTournamentCoupleMembership,
} from '@/lib/services/tournament-zone-membership'
import {
  applyZoneMembershipChangesAtomically,
  replaceZonePositionsAtomically,
} from '@/lib/services/zone-position/atomic-position-persistence'

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
    const inscription = query({ data: { id: 'inscription-1' }, error: null })
    const existingPosition = query({ data: null, error: null })
    const maxPosition = query({ data: null, error: null })
    const insertPosition = query({ data: { id: 'zp-1' }, error: null })
    const existingMirror = query({ data: null, error: null })
    const insertMirror = query({ data: null, error: { message: 'legacy mirror failed' } })

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'inscriptions') {
          callOrder.push('select-inscription')
          return inscription
        }
        if (table === 'zone_positions' && callOrder.length === 1) {
          callOrder.push('select-zone_positions-existing')
          return existingPosition
        }
        if (table === 'zone_positions' && callOrder.length === 2) {
          callOrder.push('select-zone_positions-max')
          return maxPosition
        }
        if (table === 'zone_positions' && callOrder.length === 3) {
          callOrder.push('insert-zone_positions')
          return insertPosition
        }
        if (table === 'zone_couples' && callOrder.length === 4) {
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
      'select-inscription',
      'select-zone_positions-existing',
      'select-zone_positions-max',
      'insert-zone_positions',
      'select-zone_couples-existing',
      'insert-zone_couples',
    ])
  })

  it('is idempotent when zone_positions already has the canonical row', async () => {
    const inscription = query({ data: { id: 'inscription-1' }, error: null })
    const existingPosition = query({ data: { id: 'zp-existing' }, error: null })
    const existingMirror = query({ data: { zone_id: 'zone-1' }, error: null })

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(inscription)
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

  it('rejects zone membership when the tournament inscription is missing', async () => {
    const missingInscription = query({ data: null, error: null })
    const supabase = { from: jest.fn().mockReturnValue(missingInscription) }

    const result = await ensureCanonicalZoneMembership({
      supabase,
      tournamentId: 'tournament-1',
      zoneId: 'zone-1',
      coupleId: 'couple-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('inscripcion valida')
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith('inscriptions')
  })

  it('deletes the inscription and relies on the database trigger for membership cleanup', async () => {
    const memberships = query({ data: [{ zone_id: 'zone-1' }, { zone_id: 'zone-2' }], error: null })
    const deleteInscriptions = query({ data: null, error: null })

    const supabase = {
      from: jest
        .fn()
        .mockReturnValueOnce(memberships)
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
      'zone_positions',
      'inscriptions',
    ])
  })
})

describe('tournament flow unit: atomic zone position persistence', () => {
  const position = {
    couple_id: 'couple-1',
    position: 1,
    is_definitive: false,
    points: 0,
    wins: 0,
    losses: 0,
    games_for: 0,
    games_against: 0,
    games_difference: 0,
    player_score_total: 0,
    tie_info: null,
    calculated_at: '2026-06-19T00:00:00.000Z',
    sets_for: 0,
    sets_against: 0,
    sets_difference: 0,
  }

  it('replaces a complete ranking through one RPC call', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: 1, error: null }),
    }

    await expect(
      replaceZonePositionsAtomically(supabase, 'tournament-1', 'zone-1', [position])
    ).resolves.toBe(1)

    expect(supabase.rpc).toHaveBeenCalledWith('replace_zone_positions', {
      p_tournament_id: 'tournament-1',
      p_zone_id: 'zone-1',
      p_positions: [position],
    })
  })

  it('surfaces RPC failure without issuing a client-side delete', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'position payload contains a non-member' },
      }),
      from: jest.fn(),
    }

    await expect(
      replaceZonePositionsAtomically(supabase, 'tournament-1', 'zone-1', [position])
    ).rejects.toThrow('position payload contains a non-member')

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('refuses an empty ranking before touching the database', async () => {
    const supabase = { rpc: jest.fn() }

    await expect(
      replaceZonePositionsAtomically(supabase, 'tournament-1', 'zone-1', [])
    ).rejects.toThrow('empty ranking')

    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('tournament flow unit: atomic zone membership changes', () => {
  const move = {
    couple_id: 'couple-1',
    from_zone_id: 'zone-1',
    to_zone_id: 'zone-2',
    to_position: 2,
  }

  it('moves membership through one RPC call', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: 1, error: null }),
    }

    await expect(
      applyZoneMembershipChangesAtomically(supabase, 'tournament-1', [move])
    ).resolves.toBe(1)

    expect(supabase.rpc).toHaveBeenCalledWith('apply_zone_membership_changes', {
      p_tournament_id: 'tournament-1',
      p_changes: [move],
    })
  })

  it('accepts an atomic removal returning zero inserted memberships', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: 0, error: null }),
    }
    const removal = { ...move, to_zone_id: null, to_position: null }

    await expect(
      applyZoneMembershipChangesAtomically(supabase, 'tournament-1', [removal])
    ).resolves.toBe(0)
  })

  it('surfaces membership RPC failure without client-side writes', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'source membership does not exist' },
      }),
      from: jest.fn(),
    }

    await expect(
      applyZoneMembershipChangesAtomically(supabase, 'tournament-1', [move])
    ).rejects.toThrow('source membership does not exist')

    expect(supabase.from).not.toHaveBeenCalled()
  })
})
