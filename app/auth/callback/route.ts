import { createClient } from "@/utils/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

const GOOGLE_OAUTH_NEXT_COOKIE = "google_oauth_next"

function sanitizeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null
  }

  return next
}

function getStoredNext(request: NextRequest): string | null {
  const storedNext = request.cookies.get(GOOGLE_OAUTH_NEXT_COOKIE)?.value

  if (!storedNext) {
    return null
  }

  try {
    return sanitizeNext(decodeURIComponent(storedNext))
  } catch {
    return sanitizeNext(storedNext)
  }
}

function redirectAndClearOAuthNext(url: string) {
  const response = NextResponse.redirect(url)
  response.cookies.delete(GOOGLE_OAUTH_NEXT_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const type = requestUrl.searchParams.get("type")
  const next = sanitizeNext(requestUrl.searchParams.get("next")) || getStoredNext(request)
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("[auth/callback] Error exchanging OAuth code:", error.message)
      return redirectAndClearOAuthNext(`${origin}/login`)
    }

    if (type === "recovery") {
      return redirectAndClearOAuthNext(`${origin}/reset-password`)
    }

    const user = data.user || data.session?.user

    if (user) {
      const { data: existingUser } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle()

      if (!existingUser) {
        return redirectAndClearOAuthNext(
          `${origin}/complete-google-profile${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        )
      }

      if (next) {
        return redirectAndClearOAuthNext(`${origin}${next}`)
      }

      return redirectAndClearOAuthNext(`${origin}/panel`)
    }
  }

  if (type === "recovery") {
    return redirectAndClearOAuthNext(`${origin}/reset-password`)
  }

  if (next) {
    return redirectAndClearOAuthNext(`${origin}${next}`)
  }

  return redirectAndClearOAuthNext(`${origin}/panel`)
}
