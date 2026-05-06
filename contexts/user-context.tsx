"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { useSupabase } from "@/components/supabase-provider";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { DetailedUserDetails } from "@/types";
import { signout as serverSignout } from "@/app/auth/login/actions";

interface UserContextType {
  user: AuthUser | null;      
  userDetails: DetailedUserDetails | null;
  loading: boolean;           // Para operaciones de refresh
  authLoading: boolean;       // Estado de carga de autenticación (por ahora simple)
  error: string | null;
  refreshUserDetails: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null, 
  userDetails: null,
  loading: false,
  authLoading: false,
  error: null,
  refreshUserDetails: async () => {},
  logout: async () => {},
});

export const UserProvider = ({ 
  children, 
  initialUserDetails 
}: { 
  children: React.ReactNode;
  initialUserDetails: DetailedUserDetails | null;
}) => {
  // 🚀 OPTIMIZACIÓN FASE 2: Usar initialUser del servidor
  const { user: serverUser } = useSupabase();
  
  const [user, setUser] = useState<AuthUser | null>(serverUser);
  const [userDetails, setUserDetails] = useState<DetailedUserDetails | null>(initialUserDetails);
  const [loading, setLoading] = useState(false);
  const [authLoading] = useState(false); // Placeholder, ajustar si se implementa un loader real
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 🚀 OPTIMIZACIÓN FASE 2: Función para refrescar detalles del usuario (para updates futuros)
  const refreshUserDetails = useCallback(async () => {
    if (!user) {
      setUserDetails(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Llamar a una API route que use getUserDetails
      const response = await fetch('/api/user/refresh', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const latest = await response.json();
      
      if (latest.error) {
        throw new Error(latest.error);
      }
      
      setUserDetails(latest.data);
      console.log('[UserContext] User details refreshed successfully');
    } catch (err: any) {
      console.error('[UserContext] Error refreshing user details:', err);
      setError("No se pudo actualizar tus datos. Intenta refrescar la página.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 🔧 OPTIMIZACIÓN FASE 2: Logout simplificado
  const logout = useCallback(async () => {
    console.log("[UserContext] Starting logout process...");
    setError(null);
    
    const previousUser = user;
    const previousUserDetails = userDetails;
    
    console.log("[UserContext] Clearing state optimistically...");
    setUser(null);
    setUserDetails(null);
    
    try {
      console.log("[UserContext] Calling server signout...");
      const result = await serverSignout(); 
      
      console.log("[UserContext] Server signout result:", result);
      
      if (result.success) {
        console.log("[UserContext] Logout completed successfully");
        return;
      } else {
        console.warn("[UserContext] Server signout failed:", result.error);
        
        if (result.error === 'Auth session missing!') {
          console.log("[UserContext] Session already missing, logout successful");
          return;
        }
        
        console.log("[UserContext] Attempting direct Supabase logout...");
        const { error: directLogoutError } = await supabase.auth.signOut({ scope: 'local' });
        
        if (directLogoutError) {
          console.error("[UserContext] Direct logout also failed:", directLogoutError);
          throw new Error(`Logout failed: ${directLogoutError.message}`);
        }
        
        console.log("[UserContext] Direct logout successful");
      }
    } catch (err: any) {
      console.error("[UserContext] Logout error:", err);
      
      console.log("[UserContext] Keeping optimistic logout despite error");
      
      if (typeof window !== 'undefined') {
        console.log("[UserContext] Force redirecting to login due to error...");
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
        return;
      }
      
      setError(err.message || "Error al cerrar sesión, pero la sesión se cerró localmente.");
    } 
  }, [user, userDetails, router]);

  // 🚀 OPTIMIZACIÓN FASE 2: Effect simplificado para manejar cambios de autenticación
  useEffect(() => {
    let isMounted = true;
    
    // 🔧 Sincronizar usuario con el servidor
    if (serverUser && isMounted) {
      setUser(serverUser);
      // Si no tenemos detalles y tenemos usuario, pero el servidor no envió detalles,
      // puede ser que necesitemos refrescar
      if (!userDetails && serverUser) {
        console.log("[UserContext] Server user detected but no details, keeping null for now");
      }
    } else if (!serverUser && isMounted) {
      setUser(null);
      setUserDetails(null);
    }

    // 🔧 Auth state listener simplificado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log("[UserContext] Auth state changed:", event);
        
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          if (event === 'SIGNED_IN') {
            console.log("[UserContext] User signed in, will need to refresh page for server-side details");
            // En lugar de hacer fetch aquí, dejamos que el servidor maneje los detalles
            // en el próximo refresh de página
          }
        } else {
          setUserDetails(null);
          setError(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [serverUser, userDetails]);

  // 🔧 OPTIMIZACIÓN FASE 2: Memoización mejorada
  const contextValue = useMemo(() => ({ 
    user,
    userDetails,
    loading,
    authLoading,
    error,
    refreshUserDetails,
    logout
  }), [user, userDetails, loading, authLoading, error, refreshUserDetails, logout]);

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}; 

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
