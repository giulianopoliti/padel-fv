import "server-only"

import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import { cache } from "react"
import { getTenantBranding } from "@/config/tenant"
import type { Database } from "@/database.types"

export interface TenantOrganizationSummary {
  id: string
  slug: string | null
  name: string
  description: string | null
  logo_url: string | null
}

type TenantOrganizationRow = TenantOrganizationSummary & {
  is_active: boolean | null
}

const ORGANIZATION_SELECT = "id, slug, name, description, logo_url, is_active"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const loggedTenantIssues = new Set<string>()

function logTenantIssue(key: string, message: string) {
  if (loggedTenantIssues.has(key)) {
    return
  }

  loggedTenantIssues.add(key)
  console.error(message)
}

function getSupabaseProjectLabel() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()

  if (!supabaseUrl) {
    return "sin NEXT_PUBLIC_SUPABASE_URL"
  }

  try {
    return new URL(supabaseUrl).hostname
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL invalida"
  }
}

function toTenantOrganizationSummary(row: TenantOrganizationRow): TenantOrganizationSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logo_url: row.logo_url,
  }
}

function getConfiguredTenantOrganizationSlug() {
  const branding = getTenantBranding()
  return (
    process.env.TENANT_ORGANIZATION_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG?.trim() ||
    branding.tenantOrganizationSlug?.trim()
  )
}

async function getTenantOrganizationUncached(): Promise<TenantOrganizationSummary | null> {
  const configuredOrganizationId = process.env.TENANT_ORGANIZATION_ID?.trim()
  const configuredSlug = getConfiguredTenantOrganizationSlug()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const projectLabel = getSupabaseProjectLabel()

  if (!supabaseUrl || !serviceRoleKey) {
    logTenantIssue(
      "missing-supabase-env",
      `[tenant] Faltan variables Supabase server-side para resolver el tenant (${projectLabel}). Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.`,
    )
    return null
  }

  try {
    new URL(supabaseUrl)
  } catch {
    logTenantIssue(
      "invalid-supabase-url",
      `[tenant] NEXT_PUBLIC_SUPABASE_URL no es una URL valida. Valor detectado: ${projectLabel}.`,
    )
    return null
  }

  const supabase = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  if (configuredOrganizationId) {
    if (!UUID_PATTERN.test(configuredOrganizationId)) {
      logTenantIssue(
        `invalid-id:${configuredOrganizationId}`,
        `[tenant] TENANT_ORGANIZATION_ID "${configuredOrganizationId}" no tiene formato UUID valido. Proyecto Supabase: ${projectLabel}.`,
      )
    } else {
      const { data, error } = await supabase
        .from("organizaciones")
        .select(ORGANIZATION_SELECT)
        .eq("id", configuredOrganizationId)
        .maybeSingle()

      if (error) {
        logTenantIssue(
          `id-query-error:${configuredOrganizationId}:${error.code}`,
          `[tenant] Error consultando TENANT_ORGANIZATION_ID "${configuredOrganizationId}" en ${projectLabel}: ${error.message}`,
        )
      }

      if (data?.is_active) {
        return toTenantOrganizationSummary(data as TenantOrganizationRow)
      }

      if (data && !data.is_active) {
        logTenantIssue(
          `inactive-id:${configuredOrganizationId}`,
          `[tenant] TENANT_ORGANIZATION_ID "${configuredOrganizationId}" existe en ${projectLabel}, pero la organizacion esta inactiva.`,
        )
      } else if (!error) {
        logTenantIssue(
          `missing-id:${configuredOrganizationId}`,
          `[tenant] TENANT_ORGANIZATION_ID "${configuredOrganizationId}" no existe en ${projectLabel}. Revisa que la URL/key de Supabase correspondan al mismo tenant que ese ID.`,
        )
      }
    }
  }

  if (configuredSlug) {
    const { data, error } = await supabase
      .from("organizaciones")
      .select(ORGANIZATION_SELECT)
      .eq("slug", configuredSlug)
      .eq("is_active", true)
      .maybeSingle()

    if (data) {
      if (configuredOrganizationId && data.id !== configuredOrganizationId) {
        logTenantIssue(
          `id-slug-mismatch:${configuredOrganizationId}:${configuredSlug}:${data.id}`,
          `[tenant] TENANT_ORGANIZATION_ID "${configuredOrganizationId}" no coincide con el slug "${configuredSlug}". Usando organizacion activa "${data.name}" (${data.id}) encontrada por slug en ${projectLabel}.`,
        )
      }

      return toTenantOrganizationSummary(data as TenantOrganizationRow)
    }

    if (error) {
      logTenantIssue(
        `slug-query-error:${configuredSlug}:${error.code}`,
        `[tenant] Error consultando slug "${configuredSlug}" en ${projectLabel}: ${error.message}`,
      )
    } else {
      logTenantIssue(
        `missing-slug:${configuredSlug}`,
        `[tenant] No existe una organizacion activa con slug "${configuredSlug}" en ${projectLabel}.`,
      )
    }
  }

  logTenantIssue(
    "unresolved-tenant",
    "[tenant] No se pudo resolver la organizacion del tenant. Configura TENANT_ORGANIZATION_ID o TENANT_ORGANIZATION_SLUG/NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG con una organizacion activa.",
  )
  return null
}

export const getTenantOrganization = cache(getTenantOrganizationUncached)
