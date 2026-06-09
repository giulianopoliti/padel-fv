import { unlinkSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

const DEFAULT_DEST_CONTAINER = "supabase_db_padel-base"

const argv = process.argv.slice(2)
const argSet = new Set(argv)
const getArg = (name, fallback = "") => {
  const prefix = `${name}=`
  const match = argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}
const getArgs = (name) => {
  const prefix = `${name}=`
  return argv.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length))
}

const APPLY = argSet.has("--apply")
const INCLUDE_AUTH_ONLY = argSet.has("--include-auth-only")
const SOURCE_DB_URL = getArg("--source-db-url", process.env.SOURCE_DATABASE_URL || "")
const DEST_DB_URL = getArg("--dest-db-url", process.env.DEST_DATABASE_URL || "")
const DEST_KIND = getArg("--dest-kind", DEST_DB_URL ? "remote" : "local")
const DEST_CONTAINER = getArg("--dest-container", DEFAULT_DEST_CONTAINER)
const EMAIL_FILTERS = getArgs("--email").map((email) => email.trim().toLowerCase()).filter(Boolean)

if (!SOURCE_DB_URL) {
  throw new Error("SOURCE_DATABASE_URL is required. Use the old project's Postgres connection string.")
}

if (DEST_KIND === "remote" && !DEST_DB_URL) {
  throw new Error("DEST_DATABASE_URL is required for remote destination.")
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const sqlString = (value) => {
  if (value === null || value === undefined) {
    return "null"
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-")

const runDockerPsql = (dbUrl, sql, options = {}) => {
  const args = ["exec", DEST_CONTAINER, "psql", dbUrl, "-v", "ON_ERROR_STOP=1"]
  if (options.tuplesOnly !== false) {
    args.push("-At")
  }
  if (options.quiet !== false) {
    args.push("-q")
  }
  args.push("-c", sql)

  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || result.stdout)
  }
  return result.stdout.trim()
}

const runDockerPsqlFile = (dbUrl, sql) => {
  const stamp = timestamp()
  const localSqlPath = `./tmp_auth_password_hash_repair_${stamp}.sql`
  const containerSqlPath = `/tmp/auth_password_hash_repair_${stamp}.sql`

  writeFileSync(localSqlPath, sql)
  try {
    const copy = spawnSync("docker", ["cp", localSqlPath, `${DEST_CONTAINER}:${containerSqlPath}`], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
    if (copy.status !== 0) {
      throw new Error(copy.error?.message || copy.stderr || copy.stdout)
    }

    const run = spawnSync(
      "docker",
      ["exec", DEST_CONTAINER, "psql", dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", containerSqlPath],
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
    )
    if (run.status !== 0) {
      throw new Error(run.error?.message || run.stderr || run.stdout)
    }

    spawnSync("docker", ["exec", DEST_CONTAINER, "rm", "-f", containerSqlPath], {
      encoding: "utf8",
    })

    return { stdout: run.stdout, stderr: run.stderr }
  } finally {
    try {
      unlinkSync(localSqlPath)
    } catch {
      // Best-effort cleanup.
    }
  }
}

const rowsFromUrl = (dbUrl, sql) => {
  const json = runDockerPsql(
    dbUrl,
    `select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${sql}) t`
  )
  return JSON.parse(json || "[]")
}

const destDbUrl = () => {
  if (DEST_KIND === "remote") {
    return DEST_DB_URL
  }
  return "postgresql://postgres@localhost/postgres"
}

const destRows = (sql) => {
  if (DEST_KIND === "remote") {
    return rowsFromUrl(DEST_DB_URL, sql)
  }

  const json = spawnSync(
    "docker",
    [
      "exec",
      DEST_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-q",
      "-c",
      `select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${sql}) t`,
    ],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
  )
  if (json.status !== 0) {
    throw new Error(json.error?.message || json.stderr || json.stdout)
  }
  return JSON.parse(json.stdout.trim() || "[]")
}

const executeDestSql = (sql) => {
  if (DEST_KIND === "remote") {
    return runDockerPsqlFile(DEST_DB_URL, sql)
  }

  const stamp = timestamp()
  const localSqlPath = `./tmp_auth_password_hash_repair_${stamp}.sql`
  const containerSqlPath = `/tmp/auth_password_hash_repair_${stamp}.sql`

  writeFileSync(localSqlPath, sql)
  try {
    const copy = spawnSync("docker", ["cp", localSqlPath, `${DEST_CONTAINER}:${containerSqlPath}`], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
    if (copy.status !== 0) {
      throw new Error(copy.error?.message || copy.stderr || copy.stdout)
    }

    const run = spawnSync(
      "docker",
      [
        "exec",
        DEST_CONTAINER,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-f",
        containerSqlPath,
      ],
      { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
    )
    if (run.status !== 0) {
      throw new Error(run.error?.message || run.stderr || run.stdout)
    }

    spawnSync("docker", ["exec", DEST_CONTAINER, "rm", "-f", containerSqlPath], {
      encoding: "utf8",
    })

    return { stdout: run.stdout, stderr: run.stderr }
  } finally {
    try {
      unlinkSync(localSqlPath)
    } catch {
      // Best-effort cleanup.
    }
  }
}

const emailFilterSql = EMAIL_FILTERS.length
  ? `and lower(email) in (${EMAIL_FILTERS.map(sqlString).join(",")})`
  : ""

const destEmailFilterSql = EMAIL_FILTERS.length
  ? `and lower(au.email) in (${EMAIL_FILTERS.map(sqlString).join(",")})`
  : ""

const sourceUsers = rowsFromUrl(
  SOURCE_DB_URL,
  `
    select
      id::text,
      email,
      lower(email) as email_key,
      encrypted_password
    from auth.users
    where email is not null
      and encrypted_password is not null
      ${emailFilterSql}
  `
)

const duplicateSourceEmails = new Set()
const sourceByEmail = new Map()
for (const user of sourceUsers) {
  if (sourceByEmail.has(user.email_key)) {
    duplicateSourceEmails.add(user.email_key)
    continue
  }
  sourceByEmail.set(user.email_key, user)
}
for (const email of duplicateSourceEmails) {
  sourceByEmail.delete(email)
}

const destinationUsers = destRows(`
  select
    au.id::text,
    au.email,
    lower(au.email) as email_key,
    exists(select 1 from public.users pu where pu.id = au.id) as has_public_user,
    exists(select 1 from public.players p where p.user_id = au.id) as has_player,
    (
      select p.dni
      from public.players p
      where p.user_id = au.id
      order by p.created_at nulls last, p.id
      limit 1
    ) as dni
  from auth.users au
  where au.email is not null
    and au.encrypted_password is null
    ${destEmailFilterSql}
`)

const toUpdate = []
const skipped = {
  auth_only: 0,
  missing_source_hash: 0,
  duplicate_source_email: duplicateSourceEmails.size,
}

for (const user of destinationUsers) {
  if (!INCLUDE_AUTH_ONLY && !user.has_public_user) {
    skipped.auth_only += 1
    continue
  }

  const sourceUser = sourceByEmail.get(user.email_key)
  if (!sourceUser) {
    skipped.missing_source_hash += 1
    continue
  }

  toUpdate.push({
    id: user.id,
    email: user.email,
    encrypted_password: sourceUser.encrypted_password,
    has_player: user.has_player,
    dni: user.dni,
  })
}

const sample = toUpdate.slice(0, 20).map(({ encrypted_password, ...row }) => row)

console.log("[password-repair] Source: old Postgres via SOURCE_DATABASE_URL")
console.log(
  `[password-repair] Destination: ${DEST_KIND === "remote" ? "remote Postgres via DEST_DATABASE_URL" : DEST_CONTAINER}`
)
console.log(`[password-repair] Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`)
console.log("[password-repair] Prepared rows:")
console.log(
  JSON.stringify(
    {
      source_users_with_password_hash: sourceUsers.length,
      destination_users_without_password: destinationUsers.length,
      destination_passwords_to_update: toUpdate.length,
      skipped,
      filtered_emails: EMAIL_FILTERS.length,
      include_auth_only: INCLUDE_AUTH_ONLY,
      sample_to_update: sample,
    },
    null,
    2
  )
)

if (!APPLY) {
  console.log("[password-repair] Dry-run complete. Re-run with --apply to copy password hashes.")
  process.exit(0)
}

if (toUpdate.length === 0) {
  console.log("[password-repair] Nothing to update.")
  process.exit(0)
}

const valuesSql = toUpdate
  .map((row) => `(${sqlString(row.id)}::uuid, ${sqlString(row.email)}, ${sqlString(row.encrypted_password)})`)
  .join(",\n")

const updateSql = `
begin;

create temporary table password_hash_repair (
  id uuid primary key,
  email text not null,
  encrypted_password text not null
) on commit drop;

insert into password_hash_repair (id, email, encrypted_password)
values
${valuesSql};

update auth.users au
set encrypted_password = r.encrypted_password,
    updated_at = now()
from password_hash_repair r
where au.id = r.id
  and lower(au.email) = lower(r.email)
  and au.encrypted_password is null;

commit;
`

executeDestSql(updateSql)

let remaining = 0
for (const idChunk of chunk(toUpdate.map((row) => row.id), 500)) {
  const [{ count }] = destRows(`
    select count(*)::int as count
    from auth.users
    where id in (${idChunk.map((id) => `${sqlString(id)}::uuid`).join(",")})
      and encrypted_password is null
  `)
  remaining += count ?? 0
}

console.log("[password-repair] Apply complete.")
console.log(
  JSON.stringify(
    {
      attempted_updates: toUpdate.length,
      remaining_without_password_in_attempted_set: remaining,
    },
    null,
    2
  )
)
