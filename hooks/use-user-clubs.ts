import { useState, useEffect } from 'react';
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
  const userRole = userDetails?.role;
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultClubId, setDefaultClubId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchClubs() {
      if (isUserLoading) return;
      
      if (!user || !userRole) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        if (userRole === 'ORGANIZADOR') {
          console.log('🏢 [useUserClubs] Loading clubs for ORGANIZADOR, user:', user?.id);
          
          // Get organization clubs for the user - query through organizacion_id
          const { data: orgMembers, error: memberError } = await supabase
            .from('organization_members')
            .select('organizacion_id')
            .eq('user_id', user.id)
            .eq('is_active', true);

          console.log('🏢 [useUserClubs] User organizations:', { orgMembers, memberError });

          if (memberError) {
            throw new Error(`Error al cargar organizaciones del usuario: ${memberError.message}`);
          }

          if (!orgMembers || orgMembers.length === 0) {
            console.log('🏢 [useUserClubs] No organizations found for user');
            setClubs([]);
            setError('No perteneces a ninguna organización');
            return;
          }

          const organizationIds = orgMembers.map(member => member.organizacion_id);

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

          console.log('🏢 [useUserClubs] Organization query result:', { orgClubs, orgError });

          if (orgError) {
            throw new Error(`Error al cargar clubes de organización: ${orgError.message}`);
          }

          // Transform the data to match our Club interface
          const managedClubs = orgClubs?.map(oc => ({
            id: oc.clubes.id,
            name: oc.clubes.name,
            source: 'organization' as const
          })) || [];

          console.log('🏢 [useUserClubs] Managed clubs result:', managedClubs);
          
          if (managedClubs && managedClubs.length > 0) {
            setClubs(managedClubs);
            // Don't auto-select for organizers - they must choose
            setDefaultClubId(null);
          } else {
            setClubs([]);
            setError('No tienes clubes asociados a tu organización');
          }
        } else if (userRole === 'CLUB') {
          console.log('🏠 [useUserClubs] Loading club for CLUB user');
          const supabase = createClient();
          
          const { data: clubData, error: clubError } = await supabase
            .from('clubes')
            .select('id, name')
            .eq('user_id', user.id)
            .single();

          if (!clubError && clubData) {
            const clubsList = [{ 
              id: clubData.id, 
              name: clubData.name, 
              source: 'owned' as const 
            }];
            setClubs(clubsList);
            // Auto-select for club users
            setDefaultClubId(clubData.id);
            console.log('🏠 [useUserClubs] Loaded club:', clubData);
          } else {
            setClubs([]);
            setError('No se pudo encontrar tu club');
          }
        }
      } catch (err: any) {
        console.error('❌ [useUserClubs] Error loading clubs:', err);
        setError(err.message || 'Error al cargar clubes');
        setClubs([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchClubs();
  }, [user, userRole, isUserLoading]);

  return {
    clubs,
    isLoading,
    error,
    defaultClubId,
  };
}