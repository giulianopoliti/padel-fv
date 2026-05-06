"use server"

import { supabaseAdmin, verifyAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

/**
 * Obtener todas las organizaciones con sus miembros y usuarios
 */
export async function getOrganizationsWithMembers() {
  try {
    await verifyAdmin()

    const { data: organizations, error } = await supabaseAdmin
      .from("organizaciones")
      .select(`
        id,
        name,
        email,
        phone,
        is_active,
        created_at,
        responsible_first_name,
        responsible_last_name,
        responsible_dni,
        description
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { data: organizations, error: null }
  } catch (error: any) {
    console.error("[Admin] Error fetching organizations:", error)
    return { data: null, error: error.message }
  }
}

/**
 * Obtener miembros de una organización específica con sus datos de usuario
 */
export async function getOrganizationMembers(organizacionId: string) {
  try {
    await verifyAdmin()

    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select(`
        id,
        user_id,
        member_role,
        is_active,
        created_at,
        users!organization_members_user_id_fkey (
          id,
          email,
          role
        )
      `)
      .eq("organizacion_id", organizacionId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { data: members, error: null }
  } catch (error: any) {
    console.error("[Admin] Error fetching organization members:", error)
    return { data: null, error: error.message }
  }
}

/**
 * Actualizar datos de una organización
 */
export async function updateOrganization(
  id: string,
  data: {
    name?: string
    email?: string
    phone?: string
    responsible_first_name?: string
    responsible_last_name?: string
    responsible_dni?: string
    description?: string
  }
) {
  try {
    await verifyAdmin()

    // Validación básica
    if (data.name !== undefined && !data.name.trim()) {
      return { success: false, error: "El nombre es requerido" }
    }

    if (data.email !== undefined && !data.email.trim()) {
      return { success: false, error: "El email es requerido" }
    }

    const { error } = await supabaseAdmin
      .from("organizaciones")
      .update(data)
      .eq("id", id)

    if (error) throw error

    revalidatePath("/admin/organizations")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("[Admin] Error updating organization:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Toggle estado activo/inactivo de una organización
 */
export async function toggleOrganizationActive(id: string) {
  try {
    await verifyAdmin()

    // Obtener estado actual
    const { data: org, error: fetchError } = await supabaseAdmin
      .from("organizaciones")
      .select("is_active")
      .eq("id", id)
      .single()

    if (fetchError) throw fetchError

    // Cambiar estado
    const { error: updateError } = await supabaseAdmin
      .from("organizaciones")
      .update({ is_active: !org.is_active })
      .eq("id", id)

    if (updateError) throw updateError

    revalidatePath("/admin/organizations")
    return { success: true, newState: !org.is_active, error: null }
  } catch (error: any) {
    console.error("[Admin] Error toggling organization active:", error)
    return { success: false, newState: null, error: error.message }
  }
}

/**
 * Toggle estado activo/inactivo de un miembro
 */
export async function toggleMemberActive(memberId: string, organizacionId: string) {
  try {
    await verifyAdmin()

    // Obtener estado actual
    const { data: member, error: fetchError } = await supabaseAdmin
      .from("organization_members")
      .select("is_active")
      .eq("id", memberId)
      .single()

    if (fetchError) throw fetchError

    // Cambiar estado
    const { error: updateError } = await supabaseAdmin
      .from("organization_members")
      .update({ is_active: !member.is_active })
      .eq("id", memberId)

    if (updateError) throw updateError

    revalidatePath("/admin/organizations")
    return { success: true, newState: !member.is_active, error: null }
  } catch (error: any) {
    console.error("[Admin] Error toggling member active:", error)
    return { success: false, newState: null, error: error.message }
  }
}

/**
 * Actualizar rol de un miembro
 */
export async function updateMemberRole(
  memberId: string,
  newRole: "owner" | "admin" | "member"
) {
  try {
    await verifyAdmin()

    // Validar que el rol sea válido
    if (!["owner", "admin", "member"].includes(newRole)) {
      return { success: false, error: "Rol inválido" }
    }

    const { error } = await supabaseAdmin
      .from("organization_members")
      .update({ member_role: newRole })
      .eq("id", memberId)

    if (error) throw error

    revalidatePath("/admin/organizations")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("[Admin] Error updating member role:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtener clubes asociados a una organización específica
 */
export async function getOrganizationClubs(organizacionId: string) {
  try {
    await verifyAdmin()

    const { data: clubs, error } = await supabaseAdmin
      .from("organization_clubs")
      .select(`
        id,
        created_at,
        club_id,
        clubes!organization_clubs_club_id_fkey (
          id,
          name,
          email,
          is_active
        )
      `)
      .eq("organizacion_id", organizacionId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return { data: clubs, error: null }
  } catch (error: any) {
    console.error("[Admin] Error fetching organization clubs:", error)
    return { data: null, error: error.message }
  }
}
