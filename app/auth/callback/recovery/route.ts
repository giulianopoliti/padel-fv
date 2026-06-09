import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/forgot-password`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[auth/callback/recovery] Error exchanging recovery code:", error.message)
    return NextResponse.redirect(`${origin}/forgot-password`)
  }

  return NextResponse.redirect(`${origin}/reset-password`)
}
