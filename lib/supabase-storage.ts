import { getTenantBranding } from "@/config/tenant"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const STORAGE_URL = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public` : ""
const branding = getTenantBranding()

export function getStorageUrl(bucket: string, path: string): string {
  if (!STORAGE_URL) {
    return path
  }

  return `${STORAGE_URL}/${bucket}/${path}`
}

export const LOGOS = {
  navbar: branding.logo.navbar,
  home: branding.logo.hero,
} as const

export const ASSETS = {
  placeholder: branding.assets.placeholderLogo,
  placeholderUser: branding.assets.placeholderUser,
} as const
