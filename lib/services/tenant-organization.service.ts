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

  const { data } = await supabase
    .from("organizaciones")
    .select("id, slug, name, description, logo_url")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return data
}
