import { isFreeDateSlot, partitionLongScheduleSlots } from '../long-schedule-slots'

describe('long schedule slots', () => {
  const freeDate = { id: 'free', slot_type: 'FREE_DATE' as const }
  const morning = { id: 'morning', slot_type: 'TIME_RANGE' as const }
  const legacy = { id: 'legacy' }

  it('identifies only the explicit FREE_DATE slot', () => {
    expect(isFreeDateSlot(freeDate)).toBe(true)
    expect(isFreeDateSlot(morning)).toBe(false)
    expect(isFreeDateSlot(legacy)).toBe(false)
  })

  it('keeps FREE_DATE outside playable time ranges', () => {
    expect(partitionLongScheduleSlots([morning, freeDate, legacy])).toEqual({
      freeDateSlot: freeDate,
      playableTimeSlots: [morning, legacy],
    })
  })
})
