import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "La contrasena debe tener al menos 6 caracteres." },
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

    const normalizedMessage = error.message.toLowerCase()
    const message = normalizedMessage.includes("different from the old password")
      ? "La nueva contrasena tiene que ser distinta a la anterior."
      : normalizedMessage.includes("session")
      ? "La sesion de recuperacion expiro. Pedi un link nuevo."
      : `No se pudo actualizar la contrasena: ${error.message}`

    return NextResponse.json({ error: message }, { status: error.status || 400 })
  }

  await supabase.auth.signOut({ scope: "local" })

  return NextResponse.json({ success: true })
}
