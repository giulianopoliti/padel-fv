/**
 * Test Suite: Tournament Permissions System
 *
 * Tests the permission system for tournament access control.
 * Validates that the current implementation works correctly for:
 * - ADMIN users (full access)
 * - CLUB owners (access to their tournaments)
 * - ORGANIZADOR members (access to organization tournaments)
 * - PLAYER inscription checking (both player1 and player2)
 * - Error handling
 *
 * @see docs/PERMISSIONS_SPEC.md for complete specification
 */

import {
  checkTournamentPermissions,
  checkUserTournamentInscription,
  checkEnhancedTournamentPermissions,
  checkOrganizationPermissions,
  checkTournamentAccess,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type TournamentAccessResult,
} from '../tournament-permissions'
import { createClient } from '@/utils/supabase/server'

// Mock Supabase client
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn()
}))

describe('Tournament Permissions System', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a fresh mock that returns new instances for each call
    const createMockSupabase = () => ({
      from: jest.fn(),
      auth: {
        getUser: jest.fn()
      }
    })

    mockSupabase = createMockSupabase()

    // Mock createClient to return mockSupabase every time it's called
    ;(createClient as jest.Mock).mockImplementation(() => Promise.resolve(mockSupabase))
  })

  describe('checkTournamentPermissions - ADMIN role', () => {
    it('should grant full access to ADMIN users', async () => {
      const userId = 'admin-user-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'ADMIN' },
              error: null
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: true,
        userRole: 'ADMIN',
        source: 'admin'
      })
    })
  })

  describe('checkTournamentPermissions - CLUB role', () => {
    it('should grant access to club owners of their tournaments', async () => {
      const userId = 'club-owner-id'
      const tournamentId = 'tournament-123'
      const clubId = 'club-456'

      // Mock 1: User role query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'CLUB' },
              error: null
            })
          })
        })
      })

      // Mock 2: Tournament query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: clubId, organization_id: null },
              error: null
            })
          })
        })
      })

      // Mock 3: Club ownership verification
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: clubId },
                error: null
              })
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: true,
        userRole: 'CLUB',
        source: 'club_owner'
      })
    })

    it('should deny access to CLUB users who do not own the tournament', async () => {
      const userId = 'club-owner-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'CLUB' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: null },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'No eres el propietario de este torneo',
        userRole: 'CLUB'
      })
    })
  })

  describe('checkTournamentPermissions - ORGANIZADOR role', () => {
    it('should grant access to ORGANIZADOR with matching organization_id', async () => {
      const userId = 'organizador-id'
      const tournamentId = 'tournament-123'
      const organizationId = 'org-789'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'ORGANIZADOR' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: organizationId },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: organizationId },
                error: null
              })
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: true,
        userRole: 'ORGANIZADOR',
        source: 'organization_member'
      })
    })

    it('should deny access to ORGANIZADOR when tournament has different organization_id', async () => {
      const userId = 'organizador-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'ORGANIZADOR' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: 'org-789' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: 'org-999' }, // Different organization
                error: null
              })
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'No tienes acceso a este torneo como organizador',
        userRole: 'ORGANIZADOR'
      })
    })

    it('should deny access to ORGANIZADOR when tournament has NO organization_id (club-owned)', async () => {
      const userId = 'organizador-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'ORGANIZADOR' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: null }, // No organization
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: 'org-789' },
                error: null
              })
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'No tienes acceso a este torneo como organizador',
        userRole: 'ORGANIZADOR'
      })
    })
  })

  describe('checkTournamentPermissions - PLAYER role', () => {
    it('should deny management permissions to PLAYER users', async () => {
      const userId = 'player-id'
      const tournamentId = 'tournament-123'

      // Mock 1: User role query returns PLAYER
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'PLAYER' },
              error: null
            })
          })
        })
      })

      // Mock 2: Tournament query (function ALWAYS queries tournament before checking role)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: null },
              error: null
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'Rol de usuario no autorizado para gestionar torneos',
        userRole: 'PLAYER'
      })
    })
  })

  describe('checkTournamentPermissions - COACH role', () => {
    it('should deny management permissions to COACH users', async () => {
      const userId = 'coach-id'
      const tournamentId = 'tournament-123'

      // Mock 1: User role query returns COACH
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'COACH' },
              error: null
            })
          })
        })
      })

      // Mock 2: Tournament query (function ALWAYS queries tournament before checking role)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: null },
              error: null
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'Rol de usuario no autorizado para gestionar torneos',
        userRole: 'COACH'
      })
    })
  })

  describe('checkTournamentPermissions - Error handling', () => {
    it('should handle user not found error', async () => {
      const userId = 'non-existent-user'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'Error al obtener datos del usuario'
      })
    })

    it('should handle tournament not found error', async () => {
      const userId = 'club-owner-id'
      const tournamentId = 'non-existent-tournament'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'CLUB' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Tournament not found' }
            })
          })
        })
      })

      const result = await checkTournamentPermissions(userId, tournamentId)

      expect(result).toEqual({
        hasPermission: false,
        reason: 'Error al obtener datos del torneo',
        userRole: 'CLUB'
      })
    })
  })

  describe('checkUserTournamentInscription', () => {
    describe('Player as player1', () => {
      it('should detect inscription when user is player1', async () => {
        const userId = 'user-123'
        const tournamentId = 'tournament-456'
        const playerId = 'player-789'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: playerId,
                  is_eliminated: false,
                  couples: {
                    id: 'couple-1',
                    player1_id: playerId,
                    player2_id: 'player-other',
                    player1: { first_name: 'John', last_name: 'Doe' },
                    player2: { first_name: 'Jane', last_name: 'Smith' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(true)
        expect(result.isEliminated).toBe(false)
        expect(result.coupleId).toBe('couple-1')
        expect(result.playerId).toBe(playerId)
        expect(result.reason).toBe('Usuario inscrito correctamente')
      })
    })

    describe('Player as player2', () => {
      it('should detect inscription when user is player2 (NOT just player1)', async () => {
        const userId = 'user-123'
        const tournamentId = 'tournament-456'
        const playerId = 'player-789'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: 'player-other',
                  is_eliminated: false,
                  couples: {
                    id: 'couple-1',
                    player1_id: 'player-other',
                    player2_id: playerId, // User is player2
                    player1: { first_name: 'John', last_name: 'Doe' },
                    player2: { first_name: 'Jane', last_name: 'Smith' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(true)
        expect(result.isEliminated).toBe(false)
        expect(result.coupleId).toBe('couple-1')
        expect(result.playerId).toBe(playerId)
      })
    })

    describe('Eliminated player', () => {
      it('should correctly identify eliminated players', async () => {
        const userId = 'user-123'
        const tournamentId = 'tournament-456'
        const playerId = 'player-789'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: playerId,
                  is_eliminated: true, // ELIMINATED
                  couples: {
                    id: 'couple-1',
                    player1_id: playerId,
                    player2_id: 'player-other',
                    player1: { first_name: 'John', last_name: 'Doe' },
                    player2: { first_name: 'Jane', last_name: 'Smith' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(true)
        expect(result.isEliminated).toBe(true)
        expect(result.reason).toBe('La pareja ha sido eliminada del torneo')
      })
    })

    describe('Player not inscribed', () => {
      it('should return false when player is not inscribed', async () => {
        const userId = 'user-123'
        const tournamentId = 'tournament-456'
        const playerId = 'player-789'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: 'other-player',
                  is_eliminated: false,
                  couples: {
                    id: 'couple-1',
                    player1_id: 'other-player-1',
                    player2_id: 'other-player-2',
                    player1: { first_name: 'Other', last_name: 'Player1' },
                    player2: { first_name: 'Other', last_name: 'Player2' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(false)
        expect(result.reason).toBe('Usuario no está inscrito en este torneo')
      })
    })

    describe('Error handling', () => {
      it('should handle player profile not found', async () => {
        const userId = 'user-no-player'
        const tournamentId = 'tournament-456'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Player not found' }
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(false)
        expect(result.reason).toBe('Perfil de jugador no encontrado')
      })

      it('should handle no inscriptions in tournament', async () => {
        const userId = 'user-123'
        const tournamentId = 'tournament-456'
        const playerId = 'player-789'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })

        const result = await checkUserTournamentInscription(userId, tournamentId)

        expect(result.isInscribed).toBe(false)
        expect(result.reason).toBe('No hay inscripciones para este torneo')
      })
    })
  })

  describe('checkEnhancedTournamentPermissions', () => {
    it('should grant access if user has management permissions (ADMIN)', async () => {
      const userId = 'admin-user-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'ADMIN' },
              error: null
            })
          })
        })
      })

      const result = await checkEnhancedTournamentPermissions(userId, tournamentId)

      expect(result.hasPermission).toBe(true)
      expect(result.source).toBe('admin')
      expect(result.inscriptionResult).toBeUndefined()
    })

    it('should grant access if user is inscribed player (even without management perms)', async () => {
      const userId = 'player-user-id'
      const tournamentId = 'tournament-123'
      const playerId = 'player-789'

      // Mock 1: Check management permissions - user role query (will fail for PLAYER)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'PLAYER' },
              error: null
            })
          })
        })
      })

      // Mock 2: Check management permissions - tournament query (function ALWAYS queries tournament)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { club_id: 'club-456', organization_id: null },
              error: null
            })
          })
        })
      })

      // Mock 3: Check inscription - player profile query (will succeed)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: playerId },
              error: null
            })
          })
        })
      })

      // Mock 4: Check inscription - inscriptions query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{
                id: 'inscription-1',
                created_at: '2024-01-01',
                couple_id: 'couple-1',
                player_id: playerId,
                is_eliminated: false,
                couples: {
                  id: 'couple-1',
                  player1_id: playerId,
                  player2_id: 'player-other',
                  player1: { first_name: 'John', last_name: 'Doe' },
                  player2: { first_name: 'Jane', last_name: 'Smith' }
                }
              }],
              error: null
            })
          })
        })
      })

      const result = await checkEnhancedTournamentPermissions(userId, tournamentId)

      expect(result.hasPermission).toBe(true)
      expect(result.reason).toBe('Acceso como jugador inscrito')
      expect(result.inscriptionResult?.isInscribed).toBe(true)
    })

    it('should deny access if no management perms AND not inscribed', async () => {
      const userId = 'random-user-id'
      const tournamentId = 'tournament-123'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'PLAYER' },
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Player not found' }
            })
          })
        })
      })

      const result = await checkEnhancedTournamentPermissions(userId, tournamentId)

      expect(result.hasPermission).toBe(false)
    })
  })

  describe('checkOrganizationPermissions', () => {
    it('should return true when user belongs to the tournament organization', async () => {
      const userId = 'organizador-id'
      const tournamentOrganizationId = 'org-789'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: tournamentOrganizationId },
                error: null
              })
            })
          })
        })
      })

      const result = await checkOrganizationPermissions(userId, tournamentOrganizationId)

      expect(result).toBe(true)
    })

    it('should return false when user belongs to different organization', async () => {
      const userId = 'organizador-id'
      const tournamentOrganizationId = 'org-789'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: 'org-999' }, // Different organization
                error: null
              })
            })
          })
        })
      })

      const result = await checkOrganizationPermissions(userId, tournamentOrganizationId)

      expect(result).toBe(false)
    })

    it('should return false when tournament has no organization_id', async () => {
      const userId = 'organizador-id'
      const tournamentOrganizationId = undefined

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { organizacion_id: 'org-789' },
                error: null
              })
            })
          })
        })
      })

      const result = await checkOrganizationPermissions(userId, tournamentOrganizationId)

      expect(result).toBe(false)
    })

    it('should return false when user is not in any organization', async () => {
      const userId = 'organizador-id'
      const tournamentOrganizationId = 'org-789'

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      })

      const result = await checkOrganizationPermissions(userId, tournamentOrganizationId)

      expect(result).toBe(false)
    })
  })

  // ==========================================================================
  // NEW FUNCTION TESTS (Sistema V2 - Granular Access Levels)
  // ==========================================================================

  describe('checkTournamentAccess - V2 Granular System', () => {
    describe('GUEST (Usuario no autenticado)', () => {
      it('should return PUBLIC_VIEW for null userId', async () => {
        const result = await checkTournamentAccess(null, 'tournament-123')

        expect(result.accessLevel).toBe('PUBLIC_VIEW')
        expect(result.permissions).toEqual([
          'view_public',
          'view_public_bracket',
          'view_public_zones',
          'view_public_matches'
        ])
        expect(result.metadata.source).toBe('public')
        expect(result.metadata.reason).toContain('no autenticado')
      })
    })

    describe('FULL_MANAGEMENT (ADMIN user)', () => {
      it('should return FULL_MANAGEMENT for ADMIN users', async () => {
        const userId = 'admin-user-id'
        const tournamentId = 'tournament-123'

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'ADMIN' },
                error: null
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('FULL_MANAGEMENT')
        expect(result.permissions).toContain('manage_tournament')
        expect(result.permissions).toContain('update_results')
        expect(result.permissions).toContain('view_own_schedule')
        expect(result.permissions).toContain('view_public')
        expect(result.metadata.userRole).toBe('ADMIN')
        expect(result.metadata.source).toBe('admin')
      })
    })

    describe('FULL_MANAGEMENT (CLUB owner)', () => {
      it('should return FULL_MANAGEMENT for club owners', async () => {
        const userId = 'club-owner-id'
        const tournamentId = 'tournament-123'
        const clubId = 'club-456'

        // Mock user role
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'CLUB' },
                error: null
              })
            })
          })
        })

        // Mock tournament
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { club_id: clubId, organization_id: null },
                error: null
              })
            })
          })
        })

        // Mock club ownership
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: clubId },
                  error: null
                })
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('FULL_MANAGEMENT')
        expect(result.metadata.userRole).toBe('CLUB')
        expect(result.metadata.source).toBe('club_owner')
      })
    })

    describe('PLAYER_ACTIVE', () => {
      it('should return PLAYER_ACTIVE for inscribed active player', async () => {
        const userId = 'player-user-id'
        const tournamentId = 'tournament-123'
        const playerId = 'player-789'

        // Mock 1: Check management perms - user role
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'PLAYER' },
                error: null
              })
            })
          })
        })

        // Mock 2: Check management perms - tournament
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { club_id: 'club-456', organization_id: null },
                error: null
              })
            })
          })
        })

        // Mock 3: Check inscription - player profile
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        // Mock 4: Check inscription - inscriptions
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: playerId,
                  is_eliminated: false,
                  couples: {
                    id: 'couple-1',
                    player1_id: playerId,
                    player2_id: 'player-other',
                    player1: { first_name: 'John', last_name: 'Doe' },
                    player2: { first_name: 'Jane', last_name: 'Smith' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('PLAYER_ACTIVE')
        expect(result.permissions).toContain('view_own_matches')
        expect(result.permissions).toContain('view_own_schedule')
        expect(result.permissions).toContain('view_own_statistics')
        expect(result.permissions).toContain('view_public')
        expect(result.metadata.isInscribed).toBe(true)
        expect(result.metadata.isEliminated).toBe(false)
        expect(result.metadata.coupleId).toBe('couple-1')
        expect(result.metadata.playerId).toBe(playerId)
      })
    })

    describe('PLAYER_ELIMINATED', () => {
      it('should return PLAYER_ELIMINATED for eliminated player', async () => {
        const userId = 'player-user-id'
        const tournamentId = 'tournament-123'
        const playerId = 'player-789'

        // Mock 1: Check management perms - user role
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'PLAYER' },
                error: null
              })
            })
          })
        })

        // Mock 2: Check management perms - tournament
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { club_id: 'club-456', organization_id: null },
                error: null
              })
            })
          })
        })

        // Mock 3: Check inscription - player profile
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        // Mock 4: Check inscription - inscriptions (ELIMINATED)
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{
                  id: 'inscription-1',
                  created_at: '2024-01-01',
                  couple_id: 'couple-1',
                  player_id: playerId,
                  is_eliminated: true, // ELIMINATED
                  couples: {
                    id: 'couple-1',
                    player1_id: playerId,
                    player2_id: 'player-other',
                    player1: { first_name: 'John', last_name: 'Doe' },
                    player2: { first_name: 'Jane', last_name: 'Smith' }
                  }
                }],
                error: null
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('PLAYER_ELIMINATED')
        expect(result.permissions).toContain('view_public')
        expect(result.permissions).not.toContain('view_own_schedule') // NO access to schedules
        expect(result.permissions).not.toContain('view_own_matches') // NO access to matches
        expect(result.metadata.isInscribed).toBe(true)
        expect(result.metadata.isEliminated).toBe(true)
        expect(result.metadata.reason).toContain('eliminado')
      })
    })

    describe('PUBLIC_VIEW (Authenticated users)', () => {
      it('should return PUBLIC_VIEW for ORGANIZADOR not owner', async () => {
        const userId = 'organizador-id'
        const tournamentId = 'tournament-123'

        // Mock 1: User role
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'ORGANIZADOR' },
                error: null
              })
            })
          })
        })

        // Mock 2: Tournament (no organization_id)
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { club_id: 'club-456', organization_id: null },
                error: null
              })
            })
          })
        })

        // Mock 3: Organization check
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { organizacion_id: 'org-789' },
                  error: null
                })
              })
            })
          })
        })

        // Mock 4: Check inscription - player profile (no player)
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('PUBLIC_VIEW')
        expect(result.permissions).toContain('view_public')
        expect(result.permissions).not.toContain('register_couple') // ORGANIZADOR can't register
        expect(result.metadata.userRole).toBe('ORGANIZADOR')
        expect(result.metadata.isInscribed).toBe(false)
      })

      it('should return PUBLIC_VIEW with register_couple for PLAYER not inscribed', async () => {
        const userId = 'player-id'
        const tournamentId = 'tournament-123'
        const playerId = 'player-789'

        // Mock 1: User role
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'PLAYER' },
                error: null
              })
            })
          })
        })

        // Mock 2: Tournament
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { club_id: 'club-456', organization_id: null },
                error: null
              })
            })
          })
        })

        // Mock 3: Check inscription - player profile
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: playerId },
                error: null
              })
            })
          })
        })

        // Mock 4: Check inscription - no inscriptions
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })

        const result = await checkTournamentAccess(userId, tournamentId)

        expect(result.accessLevel).toBe('PUBLIC_VIEW')
        expect(result.permissions).toContain('register_couple') // PLAYER can register
        expect(result.metadata.userRole).toBe('PLAYER')
        expect(result.metadata.isInscribed).toBe(false)
      })
    })
  })

  describe('hasPermission helper', () => {
    it('should return true when user has the permission', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'FULL_MANAGEMENT',
        permissions: ['manage_tournament', 'update_results'],
        metadata: {}
      }

      expect(hasPermission(access, 'manage_tournament')).toBe(true)
    })

    it('should return false when user does not have the permission', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'PUBLIC_VIEW',
        permissions: ['view_public'],
        metadata: {}
      }

      expect(hasPermission(access, 'manage_tournament')).toBe(false)
    })
  })

  describe('hasAnyPermission helper', () => {
    it('should return true when user has at least one permission', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'PLAYER_ACTIVE',
        permissions: ['view_own_schedule', 'view_public'],
        metadata: {}
      }

      expect(hasAnyPermission(access, ['view_own_schedule', 'manage_schedules'])).toBe(true)
    })

    it('should return false when user has none of the permissions', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'PUBLIC_VIEW',
        permissions: ['view_public'],
        metadata: {}
      }

      expect(hasAnyPermission(access, ['manage_tournament', 'update_results'])).toBe(false)
    })
  })

  describe('hasAllPermissions helper', () => {
    it('should return true when user has all permissions', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'FULL_MANAGEMENT',
        permissions: ['manage_tournament', 'update_results', 'view_public'],
        metadata: {}
      }

      expect(hasAllPermissions(access, ['manage_tournament', 'update_results'])).toBe(true)
    })

    it('should return false when user is missing any permission', () => {
      const access: TournamentAccessResult = {
        accessLevel: 'PLAYER_ACTIVE',
        permissions: ['view_own_schedule', 'view_public'],
        metadata: {}
      }

      expect(hasAllPermissions(access, ['view_own_schedule', 'manage_schedules'])).toBe(false)
    })
  })
})
