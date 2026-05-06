import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

function sanitizeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null
  }

  return next
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const type = requestUrl.searchParams.get("type")
  const next = sanitizeNext(requestUrl.searchParams.get("next"))
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: existingUser } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle()

      if (!existingUser) {
        return NextResponse.redirect(`${origin}/complete-google-profile${next ? `?next=${encodeURIComponent(next)}` : ""}`)
      }

      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      return NextResponse.redirect(`${origin}/panel`)
    }
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/panel`)
}
