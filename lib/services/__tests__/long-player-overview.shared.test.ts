import { selectPriorityAvailability } from '@/lib/services/long-player-overview.shared'

const summary = (overrides: Partial<Parameters<typeof selectPriorityAvailability>[0][number]> = {}) => ({
  fechaId: 'fecha-1',
  fechaName: 'Fecha 1',
  fechaNumber: 1,
  totalSlots: 4,
  respondedSlots: 4,
  canEdit: true,
  restrictionReason: null,
  ...overrides,
})

describe('selectPriorityAvailability', () => {
  it('prioritizes the first editable fecha with unanswered slots', () => {
    const selected = selectPriorityAvailability([
      summary({ fechaId: 'complete' }),
      summary({ fechaId: 'pending', respondedSlots: 2 }),
    ])

    expect(selected?.fechaId).toBe('pending')
  })

  it('falls back to an editable completed fecha', () => {
    const selected = selectPriorityAvailability([
      summary({ fechaId: 'blocked', canEdit: false, respondedSlots: 0 }),
      summary({ fechaId: 'complete' }),
    ])

    expect(selected?.fechaId).toBe('complete')
  })

  it('returns null when the tournament has no eligible fechas', () => {
    expect(selectPriorityAvailability([])).toBeNull()
  })
})
