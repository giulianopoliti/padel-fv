import { createClient } from "@/utils/supabase/server"
import { getPasswordErrorMessage, MIN_PASSWORD_LENGTH } from "@/lib/auth-password-errors"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    console.error("[auth/reset-password] Missing session:", userError?.message)
    return NextResponse.json(
      { error: "La sesion de recuperacion no esta activa. Pedi un link nuevo." },
      { status: 401 },
    )
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    console.error("[auth/reset-password] Error updating password:", {
      userId: userData.user.id,
      error: error.message,
      status: error.status,
    })

    return NextResponse.json(
      { error: getPasswordErrorMessage(error, "recovery") },
      { status: error.status || 400 },
    )
  }

  await supabase.auth.signOut({ scope: "local" })

  return NextResponse.json({ success: true })
}
