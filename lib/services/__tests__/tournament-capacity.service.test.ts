import {
  buildTournamentCapacitySummary,
  syncTournamentCapacityRegistrationLockWithClient,
} from '@/lib/services/tournament-capacity.service'

function createSupabaseMock(coupleCount: number) {
  const tournamentsUpdate = {
    eq: jest.fn().mockResolvedValue({ error: null }),
  }

  const tournamentsTable = {
    update: jest.fn().mockReturnValue(tournamentsUpdate),
  }

  const inscriptionsTable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockResolvedValue({ count: coupleCount, error: null }),
  }

  return {
    from: jest.fn((table: string) => {
      if (table === 'inscriptions') {
        return inscriptionsTable
      }

      if (table === 'tournaments') {
        return tournamentsTable
      }

      throw new Error(`Unexpected table ${table}`)
    }),
    tournamentsTable,
    tournamentsUpdate,
  }
}

describe('tournament-capacity.service', () => {
  it('marks few slots when only two places remain', () => {
    expect(buildTournamentCapacitySummary(16, 14)).toEqual({
      maxParticipants: 16,
      currentParticipants: 14,
      remainingSlots: 2,
      isFull: false,
      hasFewSlots: true,
    })
  })

  it('locks registrations automatically when the tournament becomes full', async () => {
    const supabase = createSupabaseMock(16)

    const result = await syncTournamentCapacityRegistrationLockWithClient(supabase, {
      id: 'tournament-1',
      status: 'NOT_STARTED',
      bracket_status: 'NOT_STARTED',
      max_participants: 16,
      registration_locked: false,
      registration_locked_by_capacity: false,
    })

    expect(result.updated).toBe(true)
    expect(result.capacity.isFull).toBe(true)
    expect(supabase.tournamentsTable.update).toHaveBeenCalledWith({
      registration_locked: true,
      registration_locked_by_capacity: true,
    })
  })

  it('reopens registrations when capacity lock is released below the limit', async () => {
    const supabase = createSupabaseMock(15)

    const result = await syncTournamentCapacityRegistrationLockWithClient(supabase, {
      id: 'tournament-1',
      status: 'NOT_STARTED',
      bracket_status: 'NOT_STARTED',
      max_participants: 16,
      registration_locked: true,
      registration_locked_by_capacity: true,
    })

    expect(result.updated).toBe(true)
    expect(result.capacity.remainingSlots).toBe(1)
    expect(supabase.tournamentsTable.update).toHaveBeenCalledWith({
      registration_locked: false,
      registration_locked_by_capacity: false,
    })
  })
})
