import { sendTournamentMessage } from "@/lib/services/messages"
import type { SupabaseLike } from "./notification-utils"

export const sendTournamentInscriptionNotification = async ({
  supabase,
  inscriptionId,
}: {
  supabase: SupabaseLike
  inscriptionId: string
}) => {
  const adminResult = await sendTournamentMessage({
    type: "INSCRIPTION_SUBMITTED_ADMIN",
    supabase,
    inscriptionId,
  })

  const playerResult = await sendTournamentMessage({
    type: "INSCRIPTION_APPROVED_PLAYER",
    supabase,
    inscriptionId,
  })

  return [...adminResult, ...playerResult]
}
