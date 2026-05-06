import { supabase } from "./supabase"

/**
 * Verifica si hay una sesión activa y usuario autenticado
 * Útil para componentes que necesitan conocer rápidamente el estado de autenticación
 */
export async function isUserAuthenticated() {
  try {
    // Obtener sesión actual
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error("[Auth] Error al verificar sesión:", sessionError)
      return false
    }
    
    // Verificar si hay sesión activa
    if (!sessionData.session) {
      console.log("[Auth] No hay sesión activa")
      return false
    }
    
    // Obtener información del usuario
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error("[Auth] Error al obtener usuario:", userError)
      return false
    }
    
    // Verificar si hay datos de usuario
    return !!userData.user
  } catch (error) {
    console.error("[Auth] Error inesperado:", error)
    return false
  }
}

/**
 * Obtiene el ID del usuario actualmente autenticado
 * Devuelve null si no hay usuario autenticado
 */
export async function getAuthenticatedUserId() {
  try {
    const { data: userData, error } = await supabase.auth.getUser()
    
    if (error || !userData.user) {
      return null
    }
    
    return userData.user.id
  } catch (error) {
    console.error("[Auth] Error al obtener ID de usuario:", error)
    return null
  }
}

/**
 * Intenta iniciar sesión manualmente
 */
export async function attemptLogin(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error("[Auth] Error al iniciar sesión:", error)
      return { success: false, message: error.message }
    }
    
    // Verificar inmediatamente si la sesión se estableció correctamente
    const isAuthenticated = await isUserAuthenticated()
    
    return { 
      success: isAuthenticated, 
      message: isAuthenticated 
        ? "Inicio de sesión exitoso" 
        : "Error al establecer sesión"
    }
  } catch (error) {
    console.error("[Auth] Error al intentar login:", error)
    return { success: false, message: "Error inesperado" }
  }
} 