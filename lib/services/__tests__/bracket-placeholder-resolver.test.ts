import { resolvePlaceholderSeeds, updateBracketMatches } from '@/lib/services/bracket-placeholder-resolver'
import { createClientServiceRole } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({
  createClientServiceRole: jest.fn(),
}))

const createThenableBuilder = (state: {
  selectFilters: Array<{ method: 'eq' | 'is'; column: string; value: unknown }>
  updatePayloads: unknown[]
}) => {
  const builder: any = {
    mode: null,
    select: jest.fn(() => {
      builder.mode = 'select'
      return builder
    }),
    update: jest.fn((payload) => {
      builder.mode = 'update'
      state.updatePayloads.push(payload)
      return builder
    }),
    eq: jest.fn((column, value) => {
      if (builder.mode === 'select') {
        state.selectFilters.push({ method: 'eq', column, value })
      }
      return builder
    }),
    is: jest.fn((column, value) => {
      if (builder.mode === 'select') {
        state.selectFilters.push({ method: 'is', column, value })
      }
      return builder
    }),
    then: (resolve: (value: unknown) => void) => {
      if (builder.mode === 'select') {
        resolve({
          data: [{
            id: 'seed-2',
            seed: 2,
            placeholder_label: '#2 general',
            placeholder_zone_id: null,
            placeholder_position: 2,
            is_placeholder: true,
            couple_id: null,
          }],
          error: null,
        })
        return
      }

      resolve({ error: null })
    },
  }

  return builder
}

describe('bracket-placeholder-resolver', () => {
  it('resolves global placeholders by placeholder_position without a zone id', async () => {
    const state = {
      selectFilters: [] as Array<{ method: 'eq' | 'is'; column: string; value: unknown }>,
      updatePayloads: [] as unknown[],
    }

    ;(createClientServiceRole as jest.Mock).mockResolvedValue({
      from: jest.fn(() => createThenableBuilder(state)),
    })

    const result = await resolvePlaceholderSeeds('tournament-1', [{
      zoneId: null,
      position: 2,
      coupleId: 'couple-2',
      isDefinitive: true,
    }])

    expect(state.selectFilters).toEqual(expect.arrayContaining([
      { method: 'eq', column: 'tournament_id', value: 'tournament-1' },
      { method: 'eq', column: 'placeholder_position', value: 2 },
      { method: 'eq', column: 'is_placeholder', value: true },
      { method: 'is', column: 'placeholder_zone_id', value: null },
    ]))
    expect(state.selectFilters).not.toEqual(expect.arrayContaining([
      { method: 'eq', column: 'placeholder_zone_id', value: null },
    ]))
    expect(result).toEqual([expect.objectContaining({
      seedId: 'seed-2',
      seedNumber: 2,
      placeholderLabel: '#2 general',
      coupleId: 'couple-2',
      zoneId: null,
      position: 2,
    })])
    expect(state.updatePayloads).toEqual([expect.objectContaining({
      couple_id: 'couple-2',
      is_placeholder: false,
      placeholder_zone_id: null,
      placeholder_position: null,
      placeholder_label: null,
    })])
  })

  it('clears stale winner_id when a waiting match becomes playable', async () => {
    const updatePayloads: unknown[] = []

    const builder: any = {
      mode: null,
      select: jest.fn(() => {
        builder.mode = 'select'
        return builder
      }),
      update: jest.fn((payload) => {
        builder.mode = 'update'
        updatePayloads.push(payload)
        return builder
      }),
      eq: jest.fn(() => builder),
      or: jest.fn(() => builder),
      then: (resolve: (value: unknown) => void) => {
        if (builder.mode === 'select') {
          resolve({
            data: [{
              id: 'match-1',
              couple1_id: 'couple-1',
              couple2_id: null,
              tournament_couple_seed1_id: 'seed-1',
              tournament_couple_seed2_id: 'seed-2',
              round: '8VOS',
              order_in_round: 1,
            }],
            error: null,
          })
          return
        }

        resolve({ error: null })
      },
    }

    ;(createClientServiceRole as jest.Mock).mockResolvedValue({
      from: jest.fn(() => builder),
    })

    await updateBracketMatches('tournament-1', [{
      seedId: 'seed-2',
      seedNumber: 2,
      placeholderLabel: '#2 general',
      coupleId: 'couple-2',
      zoneId: null,
      position: 2,
    }])

    expect(updatePayloads).toEqual([expect.objectContaining({
      couple2_id: 'couple-2',
      placeholder_couple2_label: null,
      status: 'PENDING',
      winner_id: null,
    })])
  })
})
