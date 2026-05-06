import { Database } from "@/database.types"
import { createBrowserClient } from "@supabase/ssr"

// Use a singleton pattern to prevent multiple instances
let browserClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClientInstance) {
    return browserClientInstance
  }
  
  browserClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  return browserClientInstance
}