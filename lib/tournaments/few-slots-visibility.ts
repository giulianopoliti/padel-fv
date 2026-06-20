export const shouldShowFewSlotsAlert = (
  showFewSlotsAlert: boolean | null | undefined,
  hasFewSlots: boolean | null | undefined,
): boolean => showFewSlotsAlert !== false && Boolean(hasFewSlots)
