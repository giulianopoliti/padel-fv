import { shouldShowFewSlotsAlert } from '../few-slots-visibility'

describe('shouldShowFewSlotsAlert', () => {
  it('shows the alert by default when few slots remain', () => {
    expect(shouldShowFewSlotsAlert(undefined, true)).toBe(true)
  })

  it('hides the alert when the organizer disables it', () => {
    expect(shouldShowFewSlotsAlert(false, true)).toBe(false)
  })

  it('does not show the alert when capacity is not low', () => {
    expect(shouldShowFewSlotsAlert(true, false)).toBe(false)
  })
})
