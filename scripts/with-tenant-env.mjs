import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

const TENANTS = {
  "padel-fv": {
    siteUrl: "http://localhost:3000",
    organizationSlug: "padel-fv",
  },
  "padel-elite": {
    siteUrl: "http://localhost:3000",
    organizationSlug: "padel-elite",
  },
}

const COMMANDS = {
  dev: ["next", ["dev"]],
  build: ["next", ["build"]],
  start: ["next", ["start"]],
}

const [tenantKey, commandName = "dev", ...extraArgs] = process.argv.slice(2)

if (!tenantKey || !TENANTS[tenantKey]) {
  console.error(`Tenant invalido. Usa uno de: ${Object.keys(TENANTS).join(", ")}`)
  process.exit(1)
}

if (!COMMANDS[commandName]) {
  console.error(`Comando invalido. Usa uno de: ${Object.keys(COMMANDS).join(", ")}`)
  process.exit(1)
}

const rootDir = process.cwd()
const envPath = path.join(rootDir, `.env.${tenantKey}.local`)

if (!existsSync(envPath)) {
  console.error(`No existe ${path.basename(envPath)}. Crea ese archivo con las credenciales del tenant.`)
  process.exit(1)
}

const parsed = dotenv.parse(readFileSync(envPath))
const tenantDefaults = TENANTS[tenantKey]
const env = {
  ...process.env,
  ...parsed,
  NEXT_PUBLIC_TENANT_KEY: tenantKey,
  NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG:
    parsed.NEXT_PUBLIC_TENANT_ORGANIZATION_SLUG || tenantDefaults.organizationSlug,
  NEXT_PUBLIC_SITE_URL: parsed.NEXT_PUBLIC_SITE_URL || tenantDefaults.siteUrl,
}

const [command, commandArgs] = COMMANDS[commandName]
const child = spawn(command, [...commandArgs, ...extraArgs], {
  cwd: rootDir,
  env,
  shell: true,
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
