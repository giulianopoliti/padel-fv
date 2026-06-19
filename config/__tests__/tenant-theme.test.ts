import { getTenantBranding } from '@/config/tenant'

describe('tournament tenant themes', () => {
  const originalTenant = process.env.NEXT_PUBLIC_TENANT_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_TENANT_KEY = originalTenant
  })

  it('resolves the Padel FV tournament palette', () => {
    process.env.NEXT_PUBLIC_TENANT_KEY = 'padel-fv'
    const branding = getTenantBranding()

    expect(branding.tournaments.theme.className).toBe('tournament-theme-padel-fv')
    expect(branding.tournaments.theme.primary).toBe('#20335d')
  })

  it('resolves the Padel Elite tournament palette', () => {
    process.env.NEXT_PUBLIC_TENANT_KEY = 'padel-elite'
    const branding = getTenantBranding()

    expect(branding.tournaments.theme.className).toBe('tournament-theme-padel-elite')
    expect(branding.tournaments.theme.focusRing).toBe('#2ac8ff')
  })
})
