"use server"

import { supabaseAdmin, verifyAdmin } from "@/lib/supabase-admin"

/**
 * Filtros para búsqueda y exportación de usuarios
 */
export interface SearchUsersFilters {
  searchEmail?: string
  role?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * Buscar usuarios con paginación y filtros
 */
export async function searchUsers(
  filters: SearchUsersFilters = {},
  page: number = 1,
  pageSize: number = 50
) {
  try {
    await verifyAdmin()

    const offset = (page - 1) * pageSize

    // Construir query base
    let query = supabaseAdmin
      .from("users")
      .select("id, email, role, created_at", { count: "exact" })

    // Aplicar filtro de búsqueda por email
    if (filters.searchEmail && filters.searchEmail.trim()) {
      query = query.ilike("email", `%${filters.searchEmail.trim()}%`)
    }

    // Aplicar filtro por rol
    if (filters.role && filters.role !== "all") {
      query = query.eq("role", filters.role)
    }

    // Aplicar filtro por rango de fechas
    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom)
    }
    if (filters.dateTo) {
      // Agregar 1 día para incluir todo el día seleccionado
      const endDate = new Date(filters.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("created_at", endDate.toISOString())
    }

    // Ordenar por fecha de creación descendente
    query = query.order("created_at", { ascending: false })

    // Aplicar paginación
    query = query.range(offset, offset + pageSize - 1)

    // Ejecutar query
    const { data: users, error, count } = await query

    if (error) {
      console.error("[Admin] Error searching users:", error)
      throw error
    }

    return {
      data: users || [],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page,
      error: null
    }
  } catch (error: any) {
    console.error("[Admin] Error searching users:", error)
    return {
      data: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: page,
      error: error.message
    }
  }
}

/**
 * Exportar usuarios con filtros
 * Retorna TODOS los usuarios que cumplen los filtros (sin paginación)
 */
export async function exportUsersAction(filters: SearchUsersFilters = {}) {
  try {
    await verifyAdmin()

    console.log("[Admin Export] Starting user export with filters:", filters)

    // Construir query base
    let query = supabaseAdmin
      .from("users")
      .select("id, email, role, created_at")

    // Aplicar filtro de búsqueda por email
    if (filters.searchEmail && filters.searchEmail.trim()) {
      query = query.ilike("email", `%${filters.searchEmail.trim()}%`)
    }

    // Aplicar filtro por rol
    if (filters.role && filters.role !== "all") {
      query = query.eq("role", filters.role)
    }

    // Aplicar filtro por rango de fechas
    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom)
    }
    if (filters.dateTo) {
      // Agregar 1 día para incluir todo el día seleccionado
      const endDate = new Date(filters.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("created_at", endDate.toISOString())
    }

    // Ordenar por fecha de creación descendente
    query = query.order("created_at", { ascending: false })

    // Ejecutar query
    const { data: users, error } = await query

    if (error) {
      console.error("[Admin Export] Error fetching users:", error)
      throw error
    }

    console.log("[Admin Export] Found", users?.length || 0, "users to export")

    // Mapear datos al formato de exportación
    const exportData = (users || []).map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    }))

    return {
      success: true,
      data: exportData,
      count: exportData.length,
      error: null
    }
  } catch (error: any) {
    console.error("[Admin Export] Error exporting users:", error)
    return {
      success: false,
      data: [],
      count: 0,
      error: error.message
    }
  }
}
