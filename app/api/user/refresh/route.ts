import { NextResponse } from "next/server"

import { getUserDetails } from "@/utils/db/getUserDetails"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ data: null }, { status: 200 })
    }

    const data = await getUserDetails()

    return NextResponse.json({ data }, { status: 200 })
  } catch (error: any) {
    console.error("[api/user/refresh] Unexpected error:", error)
    return NextResponse.json(
      { error: error?.message || "No se pudieron refrescar los datos del usuario." },
      { status: 500 }
    )
  }
}
