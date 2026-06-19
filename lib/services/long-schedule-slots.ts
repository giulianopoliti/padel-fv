export type LongScheduleSlotType = 'TIME_RANGE' | 'FREE_DATE'

export interface LongScheduleSlotLike {
  slot_type?: LongScheduleSlotType | null
}

export const isFreeDateSlot = <T extends LongScheduleSlotLike>(slot: T) =>
  slot.slot_type === 'FREE_DATE'

export const partitionLongScheduleSlots = <T extends LongScheduleSlotLike>(slots: T[]) => ({
  freeDateSlot: slots.find(isFreeDateSlot) || null,
  playableTimeSlots: slots.filter(slot => !isFreeDateSlot(slot)),
})
