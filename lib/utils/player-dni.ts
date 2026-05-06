export interface NormalizedPlayerDni {
  dni: string | null
  dniIsTemporary: boolean
}

export function sanitizeDniInput(value?: string | null): string {
  if (!value) return ""
  return value.replace(/\D/g, "").trim()
}

export function hasRealDni(value?: string | null): boolean {
  return sanitizeDniInput(value).length > 0
}

export function normalizePlayerDni(value?: string | null): NormalizedPlayerDni {
  const sanitizedDni = sanitizeDniInput(value)

  if (!sanitizedDni) {
    return {
      dni: null,
      dniIsTemporary: true,
    }
  }

  return {
    dni: sanitizedDni,
    dniIsTemporary: false,
  }
}

export function formatPlayerDni(value?: string | null): string {
  const sanitizedDni = sanitizeDniInput(value)
  if (!sanitizedDni) return "-"
  return sanitizedDni.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
