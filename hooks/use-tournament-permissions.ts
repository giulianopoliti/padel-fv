"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/user-context'

export interface PermissionResult {
  hasPermission: boolean
  reason?: string
  userRole?: string
  source?: 'club_owner' | 'organization_member' | 'admin'
}

interface UseTournamentPermissionsResult {
  permissions: PermissionResult
  isLoading: boolean
  isOwner: boolean
  canManage: boolean
  refetch: () => Promise<void>
}

export function useTournamentPermissions(tournamentId: string): UseTournamentPermissionsResult {
  const { user } = useUser()
  const [permissions, setPermissions] = useState<PermissionResult>({
    hasPermission: false
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchPermissions = async () => {
    if (!user?.id || !tournamentId) {
      setPermissions({ hasPermission: false })
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch(`/api/tournaments/${tournamentId}/permissions`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      setPermissions(result)
    } catch (error) {
      console.error('Error fetching tournament permissions:', error)
      setPermissions({ 
        hasPermission: false, 
        reason: 'Error al verificar permisos' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [user?.id, tournamentId])

  return {
    permissions,
    isLoading,
    isOwner: permissions.hasPermission,
    canManage: permissions.hasPermission,
    refetch: fetchPermissions
  }
}

// Alias to maintain backwards compatibility with components importing `UserPermissions`
export type UserPermissions = PermissionResult;