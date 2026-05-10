import type { Gender } from "@/types"

export interface PublicTournamentSummary {
  id: string
  name: string
  status: string
  type?: "LONG" | "AMERICAN" | string | null
  category?: string | null
  categoryName: string | null
  gender: Gender | string | null
  startDate: string | null
  endDate?: string | null
  price?: number | string | null
  award?: string | null
  enablePublicInscriptions?: boolean
  currentParticipants?: number
  maxParticipants?: number | null
  club: {
    id?: string | null
    name: string | null
    address: string | null
  } | null
  enableTransferProof?: boolean
  transferAlias?: string | null
  transferAmount?: number | null
}
