import { sendTournamentMessage } from "@/lib/services/messages"
import type { SupabaseLike } from "./notification-utils"

export const sendLongMatchScheduledNotification = async ({
  supabase,
  matchId,
}: {
  supabase: SupabaseLike
  matchId: string
}) =>
  sendTournamentMessage({
    type: "LONG_MATCH_CONFIRMED_PLAYER",
    supabase,
    matchId,
  })
