"use server"

import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"
import {
  isBlocked,
  recordFailedAttempt,
  clearRateLimit,
  getClientIP,
  formatTimeRemaining
} from "@/lib/rate-limit"

export async function adminLogin(formData: FormData) {
  try {
    console.log("[ADMIN LOGIN] Admin login attempt started")

    // Get client IP for rate limiting
    const headersList = await headers()
    const clientIP = getClientIP(headersList)
    console.log("[ADMIN LOGIN] Client IP:", clientIP)

    // Check if IP is blocked
    const blockStatus = isBlocked(clientIP)
    if (blockStatus.blocked) {
      console.log("[ADMIN LOGIN] IP is blocked:", clientIP)
      const timeRemaining = formatTimeRemaining(blockStatus.resetIn || 0)
      return {
        error: `Demasiados intentos fallidos. Tu IP está bloqueada temporalmente. Intenta de nuevo en ${timeRemaining}.`
      }
    }

    const email = formData.get("email") as string
    const password = formData.get("password") as string

    console.log(`[ADMIN LOGIN] Login attempt for email: ${email}`)

    if (!email || !password) {
      console.log("[ADMIN LOGIN] Missing fields in login attempt")
      return { error: "Todos los campos son requeridos" }
    }

    const supabase = await createClient()

    // Attempt authentication
    console.log("[ADMIN LOGIN] Attempting to sign in with password")
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.user) {
      console.error("[ADMIN LOGIN] Auth error:", error?.message)

      // Record failed attempt
      const rateLimitResult = recordFailedAttempt(clientIP)
      console.log("[ADMIN LOGIN] Failed attempt recorded. Attempts left:", rateLimitResult.attemptsLeft)

      if (rateLimitResult.shouldBlock) {
        const timeRemaining = formatTimeRemaining(rateLimitResult.resetIn)
        return {
          error: `Credenciales incorrectas. Has alcanzado el máximo de intentos. Tu IP está bloqueada por ${timeRemaining}.`
        }
      }

      // Return user-friendly error with attempts remaining
      let errorMessage = "Credenciales incorrectas."
      if (rateLimitResult.attemptsLeft > 0) {
        errorMessage += ` Te quedan ${rateLimitResult.attemptsLeft} intento${rateLimitResult.attemptsLeft !== 1 ? 's' : ''}.`
      }

      return { error: errorMessage }
    }

    const user = data.user
    console.log(`[ADMIN LOGIN] Authentication successful for user: ${user.id}`)

    // Verify ADMIN role
    const { data: userData, error: userRoleError } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", user.id)
      .single()

    if (userRoleError || !userData) {
      console.error("[ADMIN LOGIN] Role verification error:", userRoleError?.message)
      await supabase.auth.signOut()
      return { error: "Error al verificar permisos de administrador" }
    }

    // Check if user has ADMIN role
    if (userData.role !== "ADMIN") {
      console.log(`[ADMIN LOGIN] User ${user.id} attempted admin login with role: ${userData.role}`)
      await supabase.auth.signOut()

      // Record failed attempt (wrong role)
      const rateLimitResult = recordFailedAttempt(clientIP)

      if (rateLimitResult.shouldBlock) {
        const timeRemaining = formatTimeRemaining(rateLimitResult.resetIn)
        return {
          error: `Acceso denegado. No tienes permisos de administrador. Tu IP está bloqueada por ${timeRemaining}.`
        }
      }

      let errorMessage = "Acceso denegado. No tienes permisos de administrador."
      if (rateLimitResult.attemptsLeft > 0) {
        errorMessage += ` Intentos restantes: ${rateLimitResult.attemptsLeft}`
      }

      return { error: errorMessage }
    }

    // Success! Clear rate limit for this IP
    clearRateLimit(clientIP)
    console.log("[ADMIN LOGIN] Login successful, rate limit cleared for IP:", clientIP)

    return {
      success: true,
      redirectUrl: "/admin",
      message: "Acceso autorizado"
    }
  } catch (e) {
    console.error("[ADMIN LOGIN] Login failed with exception:", e)
    return {
      error: "Error de red. Por favor intenta de nuevo más tarde."
    }
  }
}
