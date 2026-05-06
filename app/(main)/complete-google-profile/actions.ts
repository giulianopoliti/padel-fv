"use server"

import { revalidatePath } from "next/cache"
import { normalizePlayerDni } from "@/lib/utils/player-dni"
import { createClient } from "@/utils/supabase/server"
import { checkPlayerByDNI, linkUserToExistingPlayer, validatePlayerLinking } from "@/utils/player-dni-utils"

interface CompleteProfileResult {
  success: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  existingPlayer?: {
    id: string;
    name: string;
    score: number;
    category: string;
    dni: string;
  };
  redirectUrl?: string;
}

function sanitizeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

function buildCompleteProfileRedirectUrl(formData: FormData, fallback = "/panel"): string {
  return sanitizeNext((formData.get("next") as string | null) || null) || fallback
}

export async function completeGooglePlayerProfile(formData: FormData): Promise<CompleteProfileResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Sesion no valida. Por favor vuelve a ingresar con Google." }
  }

  const dniInput = ((formData.get("dni") as string) || "").trim()
  const normalizedDni = normalizePlayerDni(dniInput)
  const firstName = ((formData.get("firstName") as string) || "").trim()
  const lastName = ((formData.get("lastName") as string) || "").trim()
  const gender = formData.get("gender") as string | null
  const phone = formData.get("phone") as string | null
  const dateOfBirth = formData.get("dateOfBirth") as string | null

  if (dniInput && !/^\d{7,8}$/.test(normalizedDni.dni || "")) {
    return { success: false, error: "El DNI debe tener entre 7 y 8 digitos numericos." }
  }
  if (!firstName) return { success: false, error: "El nombre es requerido." }
  if (!lastName) return { success: false, error: "El apellido es requerido." }
  if (!gender || (gender !== "MALE" && gender !== "FEMALE")) {
    return { success: false, error: "El genero es requerido." }
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()

  if (existingUser) {
    revalidatePath("/", "layout")
    return { success: true, redirectUrl: buildCompleteProfileRedirectUrl(formData) }
  }

  if (normalizedDni.dni) {
    const dniCheck = await checkPlayerByDNI(normalizedDni.dni, supabase)

    if (!dniCheck.success) {
      return { success: false, error: "Error al verificar el DNI. Intenta nuevamente." }
    }

    if (dniCheck.player) {
      const existingPlayer = dniCheck.player

      if (existingPlayer.user_id) {
        return {
          success: false,
          error: "Este DNI ya esta vinculado a otra cuenta. Si es tuyo, contacta al soporte.",
        }
      }

      const validation = validatePlayerLinking(existingPlayer, firstName, lastName)

      if (validation.isValid) {
        return {
          success: false,
          requiresConfirmation: true,
          existingPlayer: {
            id: existingPlayer.id,
            name: `${existingPlayer.first_name || ""} ${existingPlayer.last_name || ""}`.trim(),
            score: existingPlayer.score || 0,
            category: existingPlayer.category_name || "Sin categorizar",
            dni: existingPlayer.dni,
          },
        }
      }

      return {
        success: false,
        error: `Este DNI ya esta registrado con un nombre diferente (${validation.existingName}). Si eres tu, contacta al soporte por WhatsApp para resolver el conflicto.`,
      }
    }
  }

  const { error: userInsertError } = await supabase
    .from("users")
    .insert({ id: user.id, email: user.email, role: "PLAYER" })

  if (userInsertError) {
    console.error("[completeGooglePlayerProfile] Error inserting user:", userInsertError)
    return { success: false, error: "Error al crear tu cuenta. Intenta nuevamente." }
  }

  const { error: playerInsertError } = await supabase
    .from("players")
    .insert({
      first_name: firstName,
      last_name: lastName,
      dni: normalizedDni.dni,
      dni_is_temporary: normalizedDni.dniIsTemporary,
      phone: phone || null,
      gender: gender as "MALE" | "FEMALE",
      date_of_birth: dateOfBirth || null,
      user_id: user.id,
      score: 0,
      is_categorized: false,
    })

  if (playerInsertError) {
    console.error("[completeGooglePlayerProfile] Error inserting player:", playerInsertError)
    await supabase.from("users").delete().eq("id", user.id)
    return { success: false, error: "Error al crear tu perfil de jugador. Intenta nuevamente." }
  }

  revalidatePath("/", "layout")
  return { success: true, redirectUrl: buildCompleteProfileRedirectUrl(formData) }
}

export async function linkGoogleUserToExistingPlayer(
  existingPlayerId: string,
  formData: FormData
): Promise<CompleteProfileResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Sesion no valida. Por favor vuelve a ingresar con Google." }
  }

  const { data: playerCheck, error: checkError } = await supabase
    .from("players")
    .select("id, first_name, last_name, user_id")
    .eq("id", existingPlayerId)
    .single()

  if (checkError || !playerCheck) {
    return { success: false, error: "No se encontro el jugador a vincular." }
  }

  if (playerCheck.user_id) {
    return { success: false, error: "Este jugador ya tiene una cuenta vinculada." }
  }

  const { error: userInsertError } = await supabase
    .from("users")
    .insert({ id: user.id, email: user.email, role: "PLAYER" })

  if (userInsertError) {
    console.error("[linkGoogleUserToExistingPlayer] Error inserting user:", userInsertError)
    return { success: false, error: "Error al crear tu cuenta. Intenta nuevamente." }
  }

  const extraData = {
    phone: formData.get("phone") as string | null,
    gender: formData.get("gender") as string | null,
    dateOfBirth: formData.get("dateOfBirth") as string | null,
  }

  const linkResult = await linkUserToExistingPlayer(existingPlayerId, user.id, supabase, extraData)

  if (!linkResult.success) {
    await supabase.from("users").delete().eq("id", user.id)
    return { success: false, error: `Error al vincular tu cuenta: ${linkResult.error}` }
  }

  revalidatePath("/", "layout")
  return { success: true, redirectUrl: buildCompleteProfileRedirectUrl(formData) }
}
