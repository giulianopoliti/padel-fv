/**
 * 📋 TIPOS PARA CONSENTIMIENTO DE ORGANIZADOR
 *
 * Tipos compartidos para el flujo de consentimiento cuando
 * un jugador se inscribe en un torneo con organizador.
 */

export interface OrganizerInfo {
  id: string
  name: string
  description?: string
}

export interface ConsentDialogProps {
  open: boolean
  organizador: OrganizerInfo
  tournamentName: string
  onAccept: () => void
  onReject: () => void
  isLoading?: boolean
}

export interface ConsentResult {
  accepted: boolean
  organizadorId: string
  timestamp: string
}

export interface PlayerRegistrationWithConsent {
  tournamentId: string
  phone?: string
  consent?: ConsentResult
}

export interface ConsentContext {
  showConsent: boolean
  organizador: OrganizerInfo | null
  consentGiven: boolean
  consentResult: ConsentResult | null
}