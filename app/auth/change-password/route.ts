import { getPasswordErrorMessage, MIN_PASSWORD_LENGTH } from "@/lib/auth-password-errors"
import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

type ChangePasswordBody = {
  confirmPassword?: string
  currentPassword?: string
  newPassword?: string
}

export async function POST(request: Request) {
  let body: ChangePasswordBody

  try {
    body = (await request.json()) as ChangePasswordBody
  } catch {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 })
  }

  const { confirmPassword, currentPassword, newPassword } = body

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "Completa todos los campos." }, { status: 400 })
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 },
    )
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Las nuevas contraseñas no coinciden." }, { status: 400 })
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser diferente de la contraseña anterior." },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const email = userData.user?.email

  if (userError || !userData.user || !email) {
    console.error("[auth/change-password] Missing session:", userError?.message)
    return NextResponse.json(
      { error: "Tu sesión venció. Inicia sesión nuevamente para cambiar la contraseña." },
      { status: 401 },
    )
  }

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })

  if (verificationError) {
    console.warn("[auth/change-password] Current password verification failed:", {
      code: verificationError.code,
      status: verificationError.status,
      userId: userData.user.id,
    })
    return NextResponse.json(
      { error: getPasswordErrorMessage(verificationError, "current-password") },
      { status: verificationError.status === 429 ? 429 : 400 },
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

  if (updateError) {
    console.error("[auth/change-password] Password update failed:", {
      code: updateError.code,
      status: updateError.status,
      userId: userData.user.id,
    })
    return NextResponse.json(
      { error: getPasswordErrorMessage(updateError, "change") },
      { status: updateError.status || 400 },
    )
  }

  return NextResponse.json({ success: true })
}
