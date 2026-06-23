export const MIN_PASSWORD_LENGTH = 8

type AuthErrorLike = {
  code?: string
  message?: string
}

type PasswordErrorContext = "change" | "current-password" | "recovery"

const SESSION_ERROR_CODES = new Set([
  "session_expired",
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
])

export const getPasswordErrorMessage = (
  error: AuthErrorLike,
  context: PasswordErrorContext,
): string => {
  const code = error.code?.toLowerCase()
  const normalizedMessage = error.message?.toLowerCase() ?? ""

  if (
    code === "same_password" ||
    normalizedMessage.includes("different from the old password") ||
    normalizedMessage.includes("same password")
  ) {
    return "La nueva contraseña debe ser diferente de la contraseña anterior."
  }

  if (context === "current-password" && code === "invalid_credentials") {
    return "La contraseña actual es incorrecta."
  }

  if (code === "weak_password" || normalizedMessage.includes("password should be")) {
    return "La nueva contraseña no cumple los requisitos de seguridad. Usa al menos 8 caracteres y evita claves fáciles de adivinar."
  }

  if (
    (code && SESSION_ERROR_CODES.has(code)) ||
    normalizedMessage.includes("session expired") ||
    normalizedMessage.includes("session is missing")
  ) {
    return context === "recovery"
      ? "La sesión de recuperación venció. Solicita un enlace nuevo."
      : "Tu sesión venció. Inicia sesión nuevamente para cambiar la contraseña."
  }

  if (context === "current-password") {
    return "No pudimos verificar tu contraseña actual. Revisa el dato e intenta nuevamente."
  }

  return context === "recovery"
    ? "No se pudo actualizar la contraseña. Solicita un enlace nuevo si el problema continúa."
    : "No se pudo cambiar la contraseña. Intenta nuevamente."
}
