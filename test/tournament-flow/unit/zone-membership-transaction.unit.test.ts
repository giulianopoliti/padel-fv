jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createClientServiceRole: jest.fn(),
}))

jest.mock('@/utils/tournament-permissions', () => ({
  checkTournamentPermissions: jest.fn(),
}))

import { applyAuthorizedZoneMembershipChanges } from '@/lib/services/zone-position/zone-membership-transaction.service'
import { checkTournamentPermissions } from '@/utils/tournament-permissions'
import { createClient, createClientServiceRole } from '@/utils/supabase/server'

const change = {
  couple_id: 'couple-1',
  from_zone_id: 'zone-1',
  to_zone_id: 'zone-2',
  to_position: 1,
}

describe('authorized zone membership transaction service', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects unauthenticated requests before creating a service client', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })

    await expect(
      applyAuthorizedZoneMembershipChanges('tournament-1', [change])
    ).rejects.toThrow('Autenticacion requerida')

    expect(checkTournamentPermissions).not.toHaveBeenCalled()
    expect(createClientServiceRole).not.toHaveBeenCalled()
  })

  it('rejects users without tournament management permission', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    ;(checkTournamentPermissions as jest.Mock).mockResolvedValue({
      hasPermission: false,
      reason: 'Sin acceso al torneo',
    })

    await expect(
      applyAuthorizedZoneMembershipChanges('tournament-1', [change])
    ).rejects.toThrow('Sin acceso al torneo')

    expect(createClientServiceRole).not.toHaveBeenCalled()
  })

  it('uses the privileged client only after authorization', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 1, error: null })
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
    })
    ;(checkTournamentPermissions as jest.Mock).mockResolvedValue({ hasPermission: true })
    ;(createClientServiceRole as jest.Mock).mockResolvedValue({ rpc })

    await expect(
      applyAuthorizedZoneMembershipChanges('tournament-1', [change])
    ).resolves.toBe(1)

    expect(checkTournamentPermissions).toHaveBeenCalledWith('user-1', 'tournament-1')
    expect(rpc).toHaveBeenCalledWith('apply_zone_membership_changes', {
      p_tournament_id: 'tournament-1',
      p_changes: [change],
    })
  })
})
