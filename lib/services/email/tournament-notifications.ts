import { sendTransactionalEmail } from "./resend-client"
import {
  buildAppUrl,
  detailsList,
  escapeHtml,
  formatCoupleName,
  formatDate,
  formatPlayerName,
  formatTimeRange,
  renderEmailLayout,
} from "./templates"

type SupabaseLike = {
  from: (table: string) => any
}

type Player = {
  id: string
  first_name: string | null
  last_name: string | null
  user_id?: string | null
  users?: { email?: string | null } | Array<{ email?: string | null }> | null
}

const getRelatedEmail = (player: Player | null) => {
  const users = Array.isArray(player?.users) ? player?.users[0] : player?.users
  return users?.email || null
}

const fetchPlayersWithEmails = async (supabase: SupabaseLike, playerIds: string[]) => {
  if (playerIds.length === 0) return []

  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, user_id, users!players_user_id_fkey(email)")
    .in("id", playerIds)

  if (error) {
    console.error("[email] Error fetching players for notification:", error)
    return []
  }

  return (data || []) as Player[]
}

const sendSafely = async (args: Parameters<typeof sendTransactionalEmail>[0], label: string) => {
  const result = await sendTransactionalEmail(args)

  if (result.success === false) {
    console.error(`[email] ${label} failed:`, result.error)
  } else if (result.skipped) {
    console.log(`[email] ${label} skipped: ${result.reason}`)
  }

  return result
}

export const sendTournamentInscriptionNotification = async ({
  supabase,
  inscriptionId,
}: {
  supabase: SupabaseLike
  inscriptionId: string
}) => {
  const { data: inscription, error: inscriptionError } = await supabase
    .from("inscriptions")
    .select("id, tournament_id, couple_id, player_id, is_pending, created_at")
    .eq("id", inscriptionId)
    .single()

  if (inscriptionError || !inscription) {
    console.error("[email] Inscription notification skipped, inscription not found:", inscriptionError)
    return
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, type, category_name, start_date, end_date")
    .eq("id", inscription.tournament_id)
    .single()

  if (tournamentError || !tournament) {
    console.error("[email] Inscription notification skipped, tournament not found:", tournamentError)
    return
  }

  const { data: couple } = inscription.couple_id
    ? await supabase.from("couples").select("id, player1_id, player2_id").eq("id", inscription.couple_id).single()
    : { data: null }

  const playerIds = couple
    ? [couple.player1_id, couple.player2_id].filter(Boolean)
    : [inscription.player_id].filter(Boolean)

  const players = await fetchPlayersWithEmails(supabase, playerIds)
  const recipients = players.map(getRelatedEmail).filter(Boolean) as string[]

  if (recipients.length === 0) {
    console.log(`[email] Inscription ${inscriptionId} has no linked player emails`)
    return
  }

  const coupleName = couple
    ? formatCoupleName(
        players.find((player) => player.id === couple.player1_id) || null,
        players.find((player) => player.id === couple.player2_id) || null,
      )
    : formatPlayerName(players[0] || null)

  const isPending = Boolean(inscription.is_pending)
  const title = isPending ? "Recibimos tu solicitud de inscripción" : "Inscripción confirmada"
  const subject = `${title}: ${tournament.name}`
  const tournamentUrl = buildAppUrl(`/tournaments/${tournament.id}`)
  const body = `
    <p style="margin:0 0 14px;">Hola,</p>
    <p style="margin:0 0 14px;">
      ${isPending ? "Tu solicitud quedó pendiente de revisión por el organizador." : "Tu inscripción quedó confirmada correctamente."}
    </p>
    ${detailsList([
      { label: "Torneo", value: tournament.name },
      { label: "Pareja/Jugador", value: coupleName },
      { label: "Formato", value: tournament.type },
      { label: "Categoría", value: tournament.category_name },
      { label: "Inicio", value: tournament.start_date ? formatDate(tournament.start_date) : null },
      { label: "Estado", value: isPending ? "Pendiente de revisión" : "Confirmada" },
    ])}
    <p style="margin:14px 0 0;">Te vamos a avisar por este medio cuando haya novedades importantes del torneo.</p>
  `

  return sendSafely(
    {
      to: recipients,
      subject,
      html: renderEmailLayout({
        title,
        preview: `${escapeHtml(tournament.name)} - ${isPending ? "pendiente" : "confirmada"}`,
        body,
        cta: { label: "Ver torneo", href: tournamentUrl },
      }),
      text: `${title}\nTorneo: ${tournament.name}\nPareja/Jugador: ${coupleName}\nEstado: ${
        isPending ? "Pendiente de revisión" : "Confirmada"
      }\n${tournamentUrl}`,
      idempotencyKey: `inscription-${inscription.id}-${isPending ? "pending" : "confirmed"}`,
      tags: [
        { name: "type", value: "tournament_inscription" },
        { name: "tenant", value: process.env.NEXT_PUBLIC_TENANT_KEY || "unknown" },
      ],
    },
    "tournament inscription notification",
  )
}

export const sendLongMatchScheduledNotification = async ({
  supabase,
  matchId,
}: {
  supabase: SupabaseLike
  matchId: string
}) => {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, tournament_id, couple1_id, couple2_id, status, round")
    .eq("id", matchId)
    .single()

  if (matchError || !match) {
    console.error("[email] Match notification skipped, match not found:", matchError)
    return
  }

  if (match.status === "DRAFT") {
    console.log(`[email] Match ${matchId} notification skipped because it is DRAFT`)
    return
  }

  const { data: fechaMatch } = await supabase
    .from("fecha_matches")
    .select("scheduled_date, scheduled_start_time, scheduled_end_time, court_assignment")
    .eq("match_id", matchId)
    .maybeSingle()

  if (!fechaMatch?.scheduled_date || !fechaMatch?.scheduled_start_time) {
    console.log(`[email] Match ${matchId} notification skipped because schedule is incomplete`)
    return
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, type, category_name")
    .eq("id", match.tournament_id)
    .single()

  if (tournamentError || !tournament) {
    console.error("[email] Match notification skipped, tournament not found:", tournamentError)
    return
  }

  const { data: couples } = await supabase
    .from("couples")
    .select("id, player1_id, player2_id")
    .in("id", [match.couple1_id, match.couple2_id].filter(Boolean))

  const playerIds = (couples || []).flatMap((couple: any) => [couple.player1_id, couple.player2_id]).filter(Boolean)
  const players = await fetchPlayersWithEmails(supabase, playerIds)
  const recipients = players.map(getRelatedEmail).filter(Boolean) as string[]

  if (recipients.length === 0) {
    console.log(`[email] Match ${matchId} has no linked player emails`)
    return
  }

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

  const title = "Nuevo partido programado"
  const tournamentUrl = buildAppUrl(`/tournaments/${tournament.id}/match-scheduling`)
  const body = `
    <p style="margin:0 0 14px;">Hola,</p>
    <p style="margin:0 0 14px;">Se programó un partido de tu torneo.</p>
    ${detailsList([
      { label: "Torneo", value: tournament.name },
      { label: "Partido", value: `${couple1Name} vs ${couple2Name}` },
      { label: "Fecha", value: formatDate(fechaMatch.scheduled_date) },
      { label: "Horario", value: formatTimeRange(fechaMatch.scheduled_start_time, fechaMatch.scheduled_end_time) },
      { label: "Cancha", value: fechaMatch.court_assignment },
      { label: "Categoría", value: tournament.category_name },
    ])}
    <p style="margin:14px 0 0;">Si el organizador modifica el horario, vas a ver el cambio actualizado en el torneo.</p>
  `

  return sendSafely(
    {
      to: recipients,
      subject: `${title}: ${tournament.name}`,
      html: renderEmailLayout({
        title,
        preview: `${tournament.name} - ${formatDate(fechaMatch.scheduled_date)} ${formatTimeRange(
          fechaMatch.scheduled_start_time,
          fechaMatch.scheduled_end_time,
        )}`,
        body,
        cta: { label: "Ver partido", href: tournamentUrl },
      }),
      text: `${title}\nTorneo: ${tournament.name}\nPartido: ${couple1Name} vs ${couple2Name}\nFecha: ${formatDate(
        fechaMatch.scheduled_date,
      )}\nHorario: ${formatTimeRange(fechaMatch.scheduled_start_time, fechaMatch.scheduled_end_time)}\n${tournamentUrl}`,
      idempotencyKey: `match-scheduled-${match.id}-${fechaMatch.scheduled_date}-${fechaMatch.scheduled_start_time}`,
      tags: [
        { name: "type", value: "long_match_scheduled" },
        { name: "tenant", value: process.env.NEXT_PUBLIC_TENANT_KEY || "unknown" },
      ],
    },
    "long match scheduled notification",
  )
}
