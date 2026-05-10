import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUser } from '@/contexts/user-context';

interface Club {
  id: string;
  name: string;
  source: 'owned' | 'organization';
}

interface UseUserClubsReturn {
  clubs: Club[];
  isLoading: boolean;
  error: string | null;
  defaultClubId: string | null;
}

export function useUserClubs(): UseUserClubsReturn {
  const { user, userDetails, loading: isUserLoading } = useUser();
  const userId = user?.id ?? null;
  const userRole = userDetails?.role;
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultClubId, setDefaultClubId] = useState<string | null>(null);
  const lastLoadedKeyRef = useRef<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const loadKey = userId && userRole ? `${userId}:${userRole}` : null;

    if (isUserLoading) {
      return;
    }

    if (!loadKey) {
      lastLoadedKeyRef.current = null;
      setClubs([]);
      setDefaultClubId(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (lastLoadedKeyRef.current === loadKey) {
      return;
    }

    let isCancelled = false;

    async function fetchClubs() {
      try {
        setIsLoading(true);
        setError(null);

        if (userRole === 'ORGANIZADOR') {
          console.log('[useUserClubs] Loading clubs for ORGANIZADOR, user:', userId);

          const { data: orgMembers, error: memberError } = await supabase
            .from('organization_members')
            .select('organizacion_id')
            .eq('user_id', userId)
            .eq('is_active', true);

          if (isCancelled) return;

          console.log('[useUserClubs] User organizations:', { orgMembers, memberError });

          if (memberError) {
            throw new Error(`Error al cargar organizaciones del usuario: ${memberError.message}`);
          }

          if (!orgMembers || orgMembers.length === 0) {
            lastLoadedKeyRef.current = loadKey;
            setClubs([]);
            setDefaultClubId(null);
            setError('No perteneces a ninguna organización');
            return;
          }

          const organizationIds = orgMembers.map((member) => member.organizacion_id);

          const { data: orgClubs, error: orgError } = await supabase
            .from('organization_clubs')
            .select(`
              club_id,
              clubes!inner(
                id,
                name
              )
            `)
            .in('organizacion_id', organizationIds);

          if (isCancelled) return;

          console.log('[useUserClubs] Organization query result:', { orgClubs, orgError });

          if (orgError) {
            throw new Error(`Error al cargar clubes de organización: ${orgError.message}`);
          }

          const managedClubs = orgClubs?.map((organizationClub) => ({
            id: organizationClub.clubes.id,
            name: organizationClub.clubes.name,
            source: 'organization' as const,
          })) || [];

          console.log('[useUserClubs] Managed clubs result:', managedClubs);

          lastLoadedKeyRef.current = loadKey;

          if (managedClubs.length > 0) {
            setClubs(managedClubs);
            setDefaultClubId(null);
            return;
          }

          setClubs([]);
          setDefaultClubId(null);
          setError('No tienes clubes asociados a tu organización');
          return;
        }

        if (userRole === 'CLUB') {
          console.log('[useUserClubs] Loading club for CLUB user');

          const { data: clubData, error: clubError } = await supabase
            .from('clubes')
            .select('id, name')
            .eq('user_id', userId)
            .single();

          if (isCancelled) return;

          lastLoadedKeyRef.current = loadKey;

          if (!clubError && clubData) {
            setClubs([
              {
                id: clubData.id,
                name: clubData.name,
                source: 'owned' as const,
              },
            ]);
            setDefaultClubId(clubData.id);
            console.log('[useUserClubs] Loaded club:', clubData);
            return;
          }

          setClubs([]);
          setDefaultClubId(null);
          setError('No se pudo encontrar tu club');
          return;
        }

        lastLoadedKeyRef.current = loadKey;
        setClubs([]);
        setDefaultClubId(null);
      } catch (err: any) {
        if (isCancelled) return;

        console.error('[useUserClubs] Error loading clubs:', err);
        setError(err.message || 'Error al cargar clubes');
        setClubs([]);
        setDefaultClubId(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchClubs();

    return () => {
      isCancelled = true;
    };
  }, [isUserLoading, supabase, userId, userRole]);

  return {
    clubs,
    isLoading,
    error,
    defaultClubId,
  };
}
