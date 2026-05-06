export interface TenantBranding {
  siteName: string
  shortName: string
  siteDomain: string
  supportEmail: string
  tenantOrganizationSlug: string
  logo: {
    navbar: string
    hero: string
  }
  assets: {
    favicon: string
    appleTouchIcon: string
    manifest: string
    placeholderLogo: string
    placeholderUser: string
  }
  seo: {
    title: string
    description: string
  }
  home: {
    title: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
  }
}

const defaultBranding: TenantBranding = {
  siteName: "Padel Base",
  shortName: "Padel Base",
  siteDomain: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supportEmail: "soporte@example.com",
  tenantOrganizationSlug: process.env.NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG || "organizacion-demo",
  logo: {
    navbar: "/placeholder-logo.svg",
    hero: "/placeholder-logo.svg",
  },
  assets: {
    favicon: "/favicon.ico",
    appleTouchIcon: "/apple-touch-icon.png",
    manifest: "/site.webmanifest",
    placeholderLogo: "/placeholder-logo.svg",
    placeholderUser: "/placeholder-user.jpg",
  },
  seo: {
    title: "Padel Base",
    description: "Base single-tenant para gestionar torneos, clubes y ranking de padel.",
  },
  home: {
    title: "Gestiona tu circuito desde una sola plataforma",
    subtitle: "Muestra tus proximos torneos, los clubes donde organizas y el ranking de jugadores desde una instalacion dedicada.",
    ctaPrimary: "Ver proximos torneos",
    ctaSecondary: "Ver ranking",
  },
}

export function getTenantBranding(): TenantBranding {
  return defaultBranding
}

export const TENANT_CONFIG = getTenantBranding()
