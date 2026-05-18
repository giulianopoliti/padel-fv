import { existsSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"

type CliOptions = {
  envFile: string
  organizationId?: string
  userId?: string
  email?: string
  memberRole: "owner" | "admin" | "member"
  help: boolean
}

type PublicUser = {
  id: string
  email: string | null
  role: string | null
}

type Organization = {
  id: string
  slug: string | null
  name: string
  is_active: boolean | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

const usage = `Usage:
  npx tsx scripts/assign-local-organizer.ts \\
    --organization-id "UUID" \\
    --email "organizador@test.local"

Options:
  --organization-id      Existing public.organizaciones.id to link. Required.
  --email                Existing public.users.email to link. Required unless --user-id is provided.
  --user-id              Existing public.users.id to link. Required unless --email is provided.
  --member-role          owner | admin | member. Defaults to owner.
  --env-file             Env file to load. Defaults to .env.local.
  --help                 Show this help.

Safety:
  The script aborts unless NEXT_PUBLIC_SUPABASE_URL points to localhost/127.0.0.1/::1.

Behavior:
  This script does not create users or organizations.
  It only validates existing rows and upserts public.organization_members.
`

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    envFile: ".env.local",
    memberRole: "owner",
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Argumento inesperado: ${arg}`)
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2)
    const value = inlineValue ?? argv[index + 1]

    if (!inlineValue) {
      index += 1
    }

    if (!value || value.startsWith("--")) {
      throw new Error(`Falta valor para --${rawKey}`)
    }

    switch (rawKey) {
      case "env-file":
        options.envFile = value
        break
      case "organization-id":
        options.organizationId = value
        break
      case "user-id":
        options.userId = value
        break
      case "email":
        options.email = value
        break
      case "member-role":
        if (!["owner", "admin", "member"].includes(value)) {
          throw new Error("--member-role debe ser owner, admin o member")
        }
        options.memberRole = value as CliOptions["memberRole"]
        break
      default:
        throw new Error(`Opcion desconocida: --${rawKey}`)
    }
  }

  return options
}

const requireOption = (value: string | undefined, name: string) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(`Falta ${name}`)
  }

  return trimmed
}

const assertLocalSupabaseUrl = (rawUrl: string) => {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL no es una URL valida: ${rawUrl}`)
  }

  if (!LOCAL_SUPABASE_HOSTS.has(url.hostname)) {
    throw new Error(
      `Guard de seguridad: NEXT_PUBLIC_SUPABASE_URL debe apuntar a Supabase local, pero apunta a ${url.hostname}.`,
    )
  }

  if (url.protocol !== "http:") {
    throw new Error(
      `Guard de seguridad: Supabase local debe usar http:, pero se detecto ${url.protocol}.`,
    )
  }
}

const loadEnv = (envFile: string) => {
  const envPath = path.resolve(process.cwd(), envFile)

  if (!existsSync(envPath)) {
    throw new Error(`No existe el archivo de entorno: ${envPath}`)
  }

  const result = dotenv.config({ path: envPath, override: true, quiet: true } as any)

  if (result.error) {
    throw result.error
  }
}

const findExistingPublicUser = async (
  supabase: any,
  filters: { userId?: string; email?: string },
): Promise<PublicUser> => {
  let query = supabase.from("users").select("id, email, role")

  if (filters.userId) {
    query = query.eq("id", filters.userId)
  } else if (filters.email) {
    query = query.ilike("email", filters.email)
  } else {
    throw new Error("Falta --email o --user-id")
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(`Error buscando public.users: ${error.message}`)
  }

  if (!data) {
    const label = filters.userId ? `id ${filters.userId}` : `email ${filters.email}`
    throw new Error(`No existe public.users con ${label}. Crea el usuario antes de vincularlo.`)
  }

  return data as PublicUser
}

const findExistingOrganization = async (
  supabase: any,
  organizationId: string,
): Promise<Organization> => {
  const { data, error } = await supabase
    .from("organizaciones")
    .select("id, slug, name, is_active")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(`Error buscando organizacion: ${error.message}`)
  }

  if (!data) {
    throw new Error(
      `No existe public.organizaciones con id ${organizationId}. Crea la organizacion antes de vincular usuarios.`,
    )
  }

  return data as Organization
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    console.log(usage)
    return
  }

  const organizationId = requireOption(options.organizationId, "--organization-id")
  const userId = options.userId?.trim()
  const email = options.email?.trim().toLowerCase()

  if (!UUID_PATTERN.test(organizationId)) {
    throw new Error("--organization-id debe ser un UUID valido")
  }

  if (userId && !UUID_PATTERN.test(userId)) {
    throw new Error("--user-id debe ser un UUID valido")
  }

  if (!userId && !email) {
    throw new Error("Falta --email o --user-id")
  }

  loadEnv(options.envFile)

  const supabaseUrl = requireOption(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL en el env file",
  )
  const serviceRoleKey = requireOption(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY en el env file",
  )

  assertLocalSupabaseUrl(supabaseUrl)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const organization = await findExistingOrganization(supabase, organizationId)
  const user = await findExistingPublicUser(supabase, { userId, email })

  const { error: memberError } = await supabase.from("organization_members").upsert(
    {
      organizacion_id: organizationId,
      user_id: user.id,
      member_role: options.memberRole,
      is_active: true,
    },
    { onConflict: "organizacion_id,user_id" },
  )

  if (memberError) {
    throw new Error(`Error creando/actualizando organization_members: ${memberError.message}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        supabase_url: supabaseUrl,
        action: "linked_existing_user_to_existing_organization",
        user_id: user.id,
        email: user.email,
        user_role: user.role,
        organizacion_id: organizationId,
        organization_slug: organization.slug,
        organization_name: organization.name,
        organization_is_active: organization.is_active,
        member_role: options.memberRole,
        membership_is_active: true,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(`\n[assign-local-organizer] ${error.message}`)
  process.exit(1)
})
