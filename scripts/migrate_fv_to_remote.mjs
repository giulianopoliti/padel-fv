const hasArg = (name) => process.argv.some((arg) => arg === name || arg.startsWith(`${name}=`))

if (!process.env.DEST_DATABASE_URL && !hasArg("--dest-db-url")) {
  throw new Error(
    "Set DEST_DATABASE_URL or pass --dest-db-url=postgresql://... before running remote migration"
  )
}

if (!hasArg("--dest-kind")) {
  process.argv.push("--dest-kind=remote")
}

if (!hasArg("--dest-org-id")) {
  process.argv.push("--dest-org-id=202b95d4-1b99-4d04-b089-58ea63f9218f")
}

await import("./migrate_fv_to_local.mjs")
