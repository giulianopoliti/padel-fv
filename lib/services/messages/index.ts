import { emailMessageAdapter } from "./email-adapter"
import type { TournamentMessageAdapter, TournamentMessageEvent, TournamentMessageResult } from "./types"

const adapters: TournamentMessageAdapter[] = [emailMessageAdapter]

export const sendTournamentMessage = async (
  event: TournamentMessageEvent,
): Promise<TournamentMessageResult[]> => {
  const results = await Promise.allSettled(adapters.map((adapter) => adapter.send(event)))

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value
    }

    const error = result.reason instanceof Error ? result.reason.message : "Unexpected message error"
    console.error("[messages] Adapter failed:", error)
    return { success: false, error }
  })
}

export type {
  TournamentMessageAdapter,
  TournamentMessageChannel,
  TournamentMessageEvent,
  TournamentMessageResult,
  TournamentMessageType,
} from "./types"
