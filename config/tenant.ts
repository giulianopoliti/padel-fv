export interface TenantBranding {
  siteName: string
  shortName: string
  siteDomain: string
  supportEmail: string
  tenantOrganizationSlug: string
  logo: {
    onLight: string
    onDark: string
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
  siteName: "Padel FV",
  shortName: "Padel FV",
  siteDomain: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supportEmail: "hola@padelfv.com",
  tenantOrganizationSlug: process.env.NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG || "padel-fv",
  logo: {
    // These SVGs wrap embedded raster artwork, so we use them as fixed brand assets.
    onLight: "/FV%20-%20LOGO%20SIN%20FONDO%20-%20LETRA%20AZUL.svg",
    onDark: "/FV%20-%20LOGO%20SIN%20FONDO%20-%20LETRA%20BLANCA.svg",
  },
  assets: {
    favicon: "/favicon.ico",
    appleTouchIcon: "/apple-touch-icon.png",
    manifest: "/site.webmanifest",
    placeholderLogo: "/placeholder-logo.svg",
    placeholderUser: "/placeholder-user.jpg",
  },
  seo: {
    title: "Padel FV",
    description: "Proximos torneos, sedes y registro simple para el circuito de Padel FV.",
  },
  home: {
    title: "Padel FV",
    subtitle: "Todos los proximos torneos del circuito en una vista simple, clara y lista para inscribirte.",
    ctaPrimary: "Ver proximos torneos",
    ctaSecondary: "Ver clubes",
  },
}

export function getTenantBranding(): TenantBranding {
  return defaultBranding
}

export const TENANT_CONFIG = getTenantBranding()
