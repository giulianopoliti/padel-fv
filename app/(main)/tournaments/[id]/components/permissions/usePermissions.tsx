import { useMemo, useEffect, useState } from 'react';
import { useUser } from '@/contexts/user-context';
import { Database } from '@/database.types';
import type {
  UserRole,
  TournamentAccess,
  TournamentPermission
} from './types';

type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];

/**
 * Hook centralizado para gestionar permisos de torneos
 * ACTUALIZADO: Usa API route para verificar permisos (soporta CLUB + ORGANIZADOR + ADMIN)
 */
export const usePermissions = (tournament: Tournament | null) => {
  const { user, userDetails } = useUser();
  const [serverPermissions, setServerPermissions] = useState<{
    hasPermission: boolean;
    userRole?: string;
    source?: 'club_owner' | 'organization_member' | 'admin';
  } | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);

  // Verificar permisos usando API route (evita error de serialización)
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !tournament) {
        setServerPermissions(null);
        return;
      }

      // Evitar múltiples llamadas simultáneas
      if (isCheckingPermissions) return;

      try {
        setIsCheckingPermissions(true);
        const response = await fetch(`/api/tournaments/${tournament.id}/permissions`);

        if (!response.ok) {
          console.error('Error checking permissions:', response.status);
          setServerPermissions({ hasPermission: false });
          return;
        }

        const result = await response.json();
        setServerPermissions(result);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setServerPermissions({ hasPermission: false });
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, [user, tournament?.id]);

  return useMemo((): TournamentAccess => {
    // Usuario no autenticado = GUEST
    if (!user || !userDetails) {
      return {
        role: 'GUEST',
        isOwner: false,
        isParticipant: false,
        permissions: ['view_public']
      };
    }

    const role = userDetails.role as UserRole;

    // Determinar si es owner basado en permisos del servidor
    const isOwner = serverPermissions?.hasPermission || false;

    // TODO: Implementar lógica para verificar si es participante
    const isParticipant = false;

    // Definir permisos por rol
    const permissions: TournamentPermission[] = [];

    // Permisos base para todos los usuarios autenticados
    permissions.push('view_public');

    // Permisos específicos por rol
    switch (role) {
      case 'PLAYER':
        permissions.push('register_individual', 'register_couple');
        break;

      case 'CLUB':
        // Verificar ownership vía checkTournamentPermissions
        if (isOwner) {
          permissions.push(
            'manage_tournament',
            'update_results',
            'manage_inscriptions',
            'upload_images',
            'start_tournament',
            'cancel_tournament'
          );
        }
        break;

      case 'ORGANIZADOR':
        // Organizadores tienen los mismos permisos que clubs owners
        if (isOwner) {
          permissions.push(
            'manage_tournament',
            'update_results',
            'manage_inscriptions',
            'upload_images',
            'start_tournament',
            'cancel_tournament'
          );
        }
        break;

      case 'COACH':
        permissions.push('register_individual', 'register_couple');
        break;

      case 'ADMIN':
        permissions.push(
          'manage_tournament',
          'update_results',
          'manage_inscriptions',
          'upload_images',
          'start_tournament',
          'cancel_tournament'
        );
        break;
    }

    return {
      role,
      isOwner,
      isParticipant,
      permissions
    };
  }, [user, userDetails, serverPermissions, tournament]);
};

/**
 * Hook para verificar permisos específicos
 */
export const useHasPermission = (
  tournament: Tournament | null,
  permission: TournamentPermission
): boolean => {
  const access = usePermissions(tournament);
  return access.permissions.includes(permission);
};

/**
 * Hook para verificar múltiples permisos
 */
export const useHasAnyPermission = (
  tournament: Tournament | null,
  permissions: TournamentPermission[]
): boolean => {
  const access = usePermissions(tournament);
  return permissions.some(permission => 
    access.permissions.includes(permission)
  );
}; 