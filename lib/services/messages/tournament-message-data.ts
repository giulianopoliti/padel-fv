import {
  fetchPlayersWithEmails,
  getNotificationSupabase,
  getRelatedEmail,
  resolveTournamentNotificationRecipients,
  SupabaseLike,
  TournamentEmailContext,
  uniqueEmails,
} from "@/lib/services/email/notification-utils"
import { formatCoupleName, formatPlayerName } from "@/lib/services/email/templates"

export type InscriptionMessageData = {
  inscription: {
    id: string
    tournament_id: string
    couple_id: string | null
    player_id: string | null
    is_pending: boolean
    created_at: string | null
  }
  tournament: TournamentEmailContext & {
    messages_enabled?: boolean | null
  }
  participantName: string
  playerEmails: string[]
  adminEmails: string[]
}

export type CancelledInscriptionMessageData = {
  tournament: TournamentEmailContext & {
    messages_enabled?: boolean | null
  }
  participantName: string
  adminEmails: string[]
}

export type LongMatchMessageData = {
  match: {
    id: string
    tournament_id: string
    couple1_id: string | null
    couple2_id: string | null
    status: string | null
  }
  tournament: TournamentEmailContext & {
    messages_enabled?: boolean | null
  }
  fechaMatch: {
    scheduled_date: string | null
    scheduled_start_time: string | null
    scheduled_end_time: string | null
    court_assignment: string | null
  }
  matchSummary: string
  playerEmails: string[]
  adminEmails: string[]
}

const TOURNAMENT_SELECT =
  "id, name, type, category_name, start_date, end_date, club_id, organization_id, organizador_id, messages_enabled"

export const isTournamentMessagesEnabled = (tournament: { messages_enabled?: boolean | null }) =>
  tournament.messages_enabled !== false

const resolveInscriptionParticipant = async (
  supabase: SupabaseLike,
  inscription: { couple_id: string | null; player_id: string | null },
) => {
  const { data: couple } = inscription.couple_id
    ? await supabase.from("couples").select("id, player1_id, player2_id").eq("id", inscription.couple_id).single()
    : { data: null }

  const playerIds = couple
    ? [couple.player1_id, couple.player2_id].filter(Boolean)
    : [inscription.player_id].filter(Boolean)

  const players = await fetchPlayersWithEmails(supabase, playerIds)
  const participantName = couple
    ? formatCoupleName(
        players.find((player) => player.id === couple.player1_id) || null,
        players.find((player) => player.id === couple.player2_id) || null,
      )
    : formatPlayerName(players[0] || null)

  return {
    participantName,
    playerEmails: uniqueEmails(players.map(getRelatedEmail)),
  }
}

export const loadInscriptionMessageData = async (
  fallbackSupabase: SupabaseLike,
  inscriptionId: string,
): Promise<InscriptionMessageData | null> => {
  const supabase = await getNotificationSupabase(fallbackSupabase)

  const { data: inscription, error: inscriptionError } = await supabase
    .from("inscriptions")
    .select("id, tournament_id, couple_id, player_id, is_pending, created_at")
    .eq("id", inscriptionId)
    .single()

  if (inscriptionError || !inscription) {
    console.error("[messages] Inscription message skipped, inscription not found:", inscriptionError)
    return null
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("id", inscription.tournament_id)
    .single()

  if (tournamentError || !tournament) {
    console.error("[messages] Inscription message skipped, tournament not found:", tournamentError)
    return null
  }

  const participant = await resolveInscriptionParticipant(supabase, inscription)
  const recipients = await resolveTournamentNotificationRecipients(supabase, tournament)

  return {
    inscription,
    tournament,
    participantName: participant.participantName,
    playerEmails: participant.playerEmails,
    adminEmails: uniqueEmails(recipients.adminEmails.filter((email) => !participant.playerEmails.includes(email))),
  }
}

export const loadCancelledInscriptionMessageData = async ({
  fallbackSupabase,
  tournamentId,
  inscriptionId,
  coupleId,
  playerId,
}: {
  fallbackSupabase: SupabaseLike
  tournamentId: string
  inscriptionId?: string
  coupleId?: string | null
  playerId?: string | null
}): Promise<CancelledInscriptionMessageData | null> => {
  const supabase = await getNotificationSupabase(fallbackSupabase)

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    console.error("[messages] Cancellation message skipped, tournament not found:", tournamentError)
    return null
  }

  let effectiveCoupleId = coupleId || null
  let effectivePlayerId = playerId || null

  if (inscriptionId && (!effectiveCoupleId || !effectivePlayerId)) {
    const { data: inscription } = await supabase
      .from("inscriptions")
      .select("couple_id, player_id")
      .eq("id", inscriptionId)
      .maybeSingle()

    effectiveCoupleId = effectiveCoupleId || inscription?.couple_id || null
    effectivePlayerId = effectivePlayerId || inscription?.player_id || null
  }

  const participant = await resolveInscriptionParticipant(supabase, {
    couple_id: effectiveCoupleId,
    player_id: effectivePlayerId,
  })
  const recipients = await resolveTournamentNotificationRecipients(supabase, tournament)

  return {
    tournament,
    participantName: participant.participantName,
    adminEmails: uniqueEmails(recipients.adminEmails.filter((email) => !participant.playerEmails.includes(email))),
  }
}

export const loadLongMatchMessageData = async (
  fallbackSupabase: SupabaseLike,
  matchId: string,
): Promise<LongMatchMessageData | null> => {
  const supabase = await getNotificationSupabase(fallbackSupabase)

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, tournament_id, couple1_id, couple2_id, status")
    .eq("id", matchId)
    .single()

  if (matchError || !match) {
    console.error("[messages] Match message skipped, match not found:", matchError)
    return null
  }

  const { data: fechaMatch } = await supabase
    .from("fecha_matches")
    .select("scheduled_date, scheduled_start_time, scheduled_end_time, court_assignment")
    .eq("match_id", matchId)
    .maybeSingle()

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("id", match.tournament_id)
    .single()

  if (tournamentError || !tournament) {
    console.error("[messages] Match message skipped, tournament not found:", tournamentError)
    return null
  }

  const { data: couples } = await supabase
    .from("couples")
    .select("id, player1_id, player2_id")
    .in("id", [match.couple1_id, match.couple2_id].filter(Boolean))

  const playerIds = (couples || []).flatMap((couple: any) => [couple.player1_id, couple.player2_id]).filter(Boolean)
  const players = await fetchPlayersWithEmails(supabase, playerIds)
  const couple1 = (couples || []).find((couple: any) => couple.id === match.couple1_id)
  const couple2 = (couples || []).find((couple: any) => couple.id === match.couple2_id)
  const couple1Name = formatCoupleName(
    players.find((player) => player.id === couple1?.player1_id) || null,
    players.find((player) => player.id === couple1?.player2_id) || null,
  )
  const couple2Name = formatCoupleName(
    players.find((player) => player.id === couple2?.player1_id) || null,
    players.find((player) => player.id === couple2?.player2_id) || null,
  )
  const recipients = await resolveTournamentNotificationRecipients(supabase, tournament)
  const playerEmails = uniqueEmails(players.map(getRelatedEmail))

  return {
    match,
    tournament,
    fechaMatch: fechaMatch || {
      scheduled_date: null,
      scheduled_start_time: null,
      scheduled_end_time: null,
      court_assignment: null,
    },
    matchSummary: `${couple1Name} vs ${couple2Name}`,
    playerEmails,
    adminEmails: uniqueEmails(recipients.adminEmails.filter((email) => !playerEmails.includes(email))),
  }
}
