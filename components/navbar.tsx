"use client"

import { useUser } from "@/contexts/user-context"
import { Suspense, useMemo, useEffect, useState } from "react"
import { getLinksForRole } from "@/config/permissions"
import type { User as AuthUser } from "@supabase/supabase-js"

type Role = "PLAYER" | "CLUB" | "COACH" | "ADMIN" | "ORGANIZADOR"

import NavbarClient from "./navbar-client"
import SkeletonNavbar from "./skeleton-navbar"

const publicLinks = [
  {
    path: "/",
    label: "Inicio",
    icon: "Home" as const,
  },
  {
    path: "/tournaments",
    label: "Torneos",
    icon: "Trophy" as const,
  },
  {
    path: "/ranking",
    label: "Ranking",
    icon: "BarChart" as const,
  },
  {
    path: "/clubes",
    label: "Clubes",
    icon: "MapPin" as const,
  },
]

const profileLinkPaths = ["/edit-profile", "/panel"]

interface NavbarClientProps {
  mainLinks: { label: string; icon: string; path: string }[]
  profileLinks: { label: string; icon: string; path: string }[]
  user: AuthUser | null
}

const useNavbarLinks = (userRole: Role | null) => {
  return useMemo(() => {
    const allAuthLinks = userRole ? getLinksForRole(userRole) : []

    const mainLinks = userRole ? allAuthLinks.filter((link) => !profileLinkPaths.includes(link.path)) : publicLinks

    const profileLinks = userRole ? allAuthLinks.filter((link) => profileLinkPaths.includes(link.path)) : []

    return { mainLinks, profileLinks }
  }, [userRole])
}

export default function Navbar() {
  const { user, userDetails, loading, authLoading, error } = useUser()
  const [forceShowNavbar, setForceShowNavbar] = useState(false)

  useEffect(() => {
    const maxWaitTime = 15000
    const timer = setTimeout(() => {
      if ((authLoading || loading) && !forceShowNavbar) {
        setForceShowNavbar(true)
      }
    }, maxWaitTime)

    if (!authLoading && !loading) {
      setForceShowNavbar(false)
    }

    return () => clearTimeout(timer)
  }, [authLoading, loading, forceShowNavbar])

  const showSkeleton = useMemo(() => {
    if (error || forceShowNavbar) {
      return false
    }

    return authLoading || (!!user && loading)
  }, [authLoading, user, loading, error, forceShowNavbar])

  const userRole = userDetails?.role as Role | null
  const { mainLinks, profileLinks } = useNavbarLinks(userRole)

  return (
    <Suspense fallback={<SkeletonNavbar />}>
      {showSkeleton ? <SkeletonNavbar /> : <NavbarClient mainLinks={mainLinks} profileLinks={profileLinks} user={user} />}
    </Suspense>
  )
}
