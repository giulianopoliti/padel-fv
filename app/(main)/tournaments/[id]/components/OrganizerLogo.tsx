"use client"

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ChevronRight } from 'lucide-react'
import { getStorageUrl } from '@/utils/storage-url'

interface OrganizerLogoProps {
  organization?: {
    name: string
    logo_url?: string | null
    slug?: string
  } | null
  club?: {
    name: string
    logo_url?: string | null
  } | null
  collapsed?: boolean
}

export default function OrganizerLogo({
  organization,
  club,
  collapsed = false
}: OrganizerLogoProps) {
  // Determinar qué logo y nombre usar según la jerarquía
  const rawLogoUrl = organization?.logo_url || club?.logo_url
  const logoUrl = getStorageUrl(rawLogoUrl)
  const organizerName = organization?.name || club?.name
  const useCPAFallback = !logoUrl

  if (collapsed) {
    return null
  }

  // Si hay organización con slug, hacer el contenido clickeable
  const organizationSlug = organization?.slug
  const isClickable = !!organizationSlug

  const logoElement = (
    <div className="relative group">
      {/* Glow ring effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/0 to-purple-400/0 group-hover:from-blue-400/20 group-hover:to-purple-400/20 blur-xl transition-all duration-500 scale-150" />

      <Avatar className="h-16 w-16 transition-all duration-300 relative z-10 group-hover:scale-105 border-2 border-border/50 group-hover:border-primary/30 shadow-lg">
        <AvatarImage
          src={logoUrl || ''}
          alt={organizerName ? `Logo ${organizerName}` : 'CPA Logo'}
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-muted via-muted to-muted/80">
          <Image
            src="/Frame 10 (1).png"
            alt="CPA Logo"
            width={48}
            height={48}
            className="object-contain"
          />
        </AvatarFallback>
      </Avatar>

      {/* Clickable indicator */}
      {isClickable && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <ChevronRight className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Logo with conditional link wrapper */}
      {isClickable ? (
        <Link
          href={`/organizations/${organizationSlug}`}
          className="group"
        >
          {logoElement}
        </Link>
      ) : (
        logoElement
      )}

      {/* Organizer name - only if NOT fallback */}
      {!useCPAFallback && organizerName && (
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground leading-tight">
            {organizerName}
          </p>
          {isClickable && (
            <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors duration-200">
              Ver perfil
            </p>
          )}
        </div>
      )}
    </div>
  )
}
