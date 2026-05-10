"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";

import { signout as serverSignout } from "@/app/auth/login/actions";
import { useSupabase } from "@/components/supabase-provider";
import type { DetailedUserDetails } from "@/types";
import { supabase } from "@/utils/supabase/client";

export type AuthState = "guest" | "session-only" | "ready" | "error";

interface UserContextType {
  user: AuthUser | null;
  userDetails: DetailedUserDetails | null;
  authState: AuthState;
  loading: boolean;
  authLoading: boolean;
  error: string | null;
  refreshUserDetails: (targetUser?: AuthUser | null) => Promise<DetailedUserDetails | null>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  userDetails: null,
  authState: "guest",
  loading: false,
  authLoading: false,
  error: null,
  refreshUserDetails: async () => null,
  logout: async () => {},
});

const hasRequiredRoleId = (details: DetailedUserDetails | null) => {
  if (!details?.role) {
    return false;
  }

  const role = details.role as string;

  switch (role) {
    case "PLAYER":
      return !!details.player_id;
    case "CLUB":
      return !!details.club_id;
    case "COACH":
      return !!details.coach_id;
    case "ORGANIZADOR":
      return !!details.organizador_id;
    case "ADMIN":
      return true;
    default:
      return false;
  }
};

const isProfileReady = (authUser: AuthUser | null, details: DetailedUserDetails | null) => {
  if (!authUser || !details) {
    return false;
  }

  if (details.id !== authUser.id) {
    return false;
  }

  return hasRequiredRoleId(details);
};

export const UserProvider = ({
  children,
  initialUserDetails,
}: {
  children: React.ReactNode;
  initialUserDetails: DetailedUserDetails | null;
}) => {
  const { user: serverUser } = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(serverUser);
  const [userDetails, setUserDetails] = useState<DetailedUserDetails | null>(initialUserDetails);
  const [loading, setLoading] = useState(false);
  const [authLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userDetailsRef = useRef<DetailedUserDetails | null>(initialUserDetails);
  const userRef = useRef<AuthUser | null>(serverUser);
  const refreshInFlightRef = useRef<Promise<DetailedUserDetails | null> | null>(null);
  const lastAutoRefreshUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    userDetailsRef.current = userDetails;
  }, [userDetails]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUserDetails = useCallback(async (targetUser?: AuthUser | null) => {
    const currentAuthUser = targetUser ?? userRef.current ?? serverUser ?? null;

    if (!currentAuthUser) {
      setUserDetails(null);
      setError(null);
      lastAutoRefreshUserIdRef.current = null;
      return null;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/user/refresh", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || `HTTP error! status: ${response.status}`);
        }

        lastAutoRefreshUserIdRef.current = currentAuthUser.id;
        setUserDetails(payload.data ?? null);
        return payload.data ?? null;
      } catch (err: any) {
        console.error("[UserContext] Error refreshing user details:", err);
        setUserDetails(null);
        setError(err.message || "No se pudo actualizar tus datos. Intenta refrescar la página.");
        return null;
      } finally {
        setLoading(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [serverUser]);

  const logout = useCallback(async () => {
    console.log("[UserContext] Starting logout process...");
    setError(null);
    setUser(null);
    setUserDetails(null);

    try {
      const result = await serverSignout();

      if (result.success || result.error === "Auth session missing!") {
        return;
      }

      const { error: directLogoutError } = await supabase.auth.signOut({ scope: "local" });

      if (directLogoutError) {
        throw new Error(`Logout failed: ${directLogoutError.message}`);
      }
    } catch (err: any) {
      console.error("[UserContext] Logout error:", err);

      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        return;
      }

      setError(err.message || "Error al cerrar sesión, pero la sesión se cerró localmente.");
    }
  }, []);

  useEffect(() => {
    if (!serverUser) {
      setUser(null);
      setUserDetails(null);
      setError(null);
      lastAutoRefreshUserIdRef.current = null;
      return;
    }

    setUser((previousUser) => {
      if (previousUser?.id === serverUser.id) {
        return previousUser;
      }
      return serverUser;
    });

    const hasDetailsForCurrentUser = userDetailsRef.current?.id === serverUser.id;
    const alreadyAutoRefreshedCurrentUser = lastAutoRefreshUserIdRef.current === serverUser.id;

    if (!hasDetailsForCurrentUser && !alreadyAutoRefreshedCurrentUser) {
      void refreshUserDetails(serverUser);
    }
  }, [refreshUserDetails, serverUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[UserContext] Auth state changed:", event);

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setUserDetails(null);
        setError(null);
        lastAutoRefreshUserIdRef.current = null;
        return;
      }

      if (userDetailsRef.current?.id && userDetailsRef.current.id !== currentUser.id) {
        setUserDetails(null);
        lastAutoRefreshUserIdRef.current = null;
      }

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const hasDetailsForCurrentUser = userDetailsRef.current?.id === currentUser.id;
        const alreadyAutoRefreshedCurrentUser = lastAutoRefreshUserIdRef.current === currentUser.id;

        if (!hasDetailsForCurrentUser && !alreadyAutoRefreshedCurrentUser) {
          await refreshUserDetails(currentUser);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [refreshUserDetails]);

  const authState: AuthState = useMemo(() => {
    if (!user) {
      return "guest";
    }

    if (isProfileReady(user, userDetails)) {
      return "ready";
    }

    if (error) {
      return "error";
    }

    return "session-only";
  }, [error, user, userDetails]);

  const contextValue = useMemo(() => ({
    user,
    userDetails,
    authState,
    loading,
    authLoading,
    error,
    refreshUserDetails,
    logout,
  }), [authLoading, authState, error, loading, logout, refreshUserDetails, user, userDetails]);

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
