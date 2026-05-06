"use server"

import { supabaseAdmin, verifyAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

/**
 * Actualizar datos de un club
 */
export async function updateClub(
  id: string,
  data: {
    name?: string
    email?: string
    phone?: string
    phone2?: string
    address?: string
    courts?: number
    opens_at?: string
    closes_at?: string
    instagram?: string
    website?: string
    description?: string
  }
) {
  try {
    await verifyAdmin()

    // Validaciones básicas
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false, error: "El nombre es requerido" }
    }

    if (data.courts !== undefined && data.courts < 0) {
      return { success: false, error: "El número de canchas debe ser positivo" }
    }

    const { error } = await supabaseAdmin
      .from("clubes")
      .update(data)
      .eq("id", id)

    if (error) throw error

    revalidatePath("/admin/clubs")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("[Admin] Error updating club:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Toggle estado activo/inactivo de un club
 */
export async function toggleClubActive(id: string) {
  try {
    await verifyAdmin()

    // Obtener estado actual
    const { data: club, error: fetchError } = await supabaseAdmin
      .from("clubes")
      .select("is_active")
      .eq("id", id)
      .single()

    if (fetchError) throw fetchError

    // Cambiar estado
    const { error: updateError } = await supabaseAdmin
      .from("clubes")
      .update({ is_active: !club.is_active })
      .eq("id", id)

    if (updateError) throw updateError

    revalidatePath("/admin/clubs")
    return { success: true, newState: !club.is_active, error: null }
  } catch (error: any) {
    console.error("[Admin] Error toggling club active:", error)
    return { success: false, newState: null, error: error.message }
  }
}
