import "server-only"

import { getTenantBranding } from "@/config/tenant"
import { createClient } from "@/utils/supabase/server"

export interface TenantOrganizationSummary {
  id: string
  slug: string | null
  name: string
  description: string | null
  logo_url: string | null
}

export async function getTenantOrganization(): Promise<TenantOrganizationSummary | null> {
  const supabase = await createClient()
  const branding = getTenantBranding()
  const configuredOrganizationId = process.env.TENANT_ORGANIZATION_ID?.trim()

  if (configuredOrganizationId) {
    const { data } = await supabase
      .from("organizaciones")
      .select("id, slug, name, description, logo_url")
      .eq("id", configuredOrganizationId)
      .eq("is_active", true)
      .maybeSingle()

    if (data) {
      return data
    }

    console.error(
      `[tenant] TENANT_ORGANIZATION_ID "${configuredOrganizationId}" no coincide con una organizacion activa.`,
    )

    return null
  }

  const configuredSlug = branding.tenantOrganizationSlug?.trim()

  if (configuredSlug) {
    const { data } = await supabase
      .from("organizaciones")
      .select("id, slug, name, description, logo_url")
      .eq("slug", configuredSlug)
      .eq("is_active", true)
      .maybeSingle()

    if (data) {
      return data
    }
  }

  console.error("[tenant] No se pudo resolver la organizacion del tenant. Configura TENANT_ORGANIZATION_ID o un slug valido.")
  return null
}
