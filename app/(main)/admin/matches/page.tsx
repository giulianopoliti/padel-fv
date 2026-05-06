import { createClient } from "@/utils/supabase/server"
import { MatchesClient } from "./matches-client"

async function getMatches() {
  const supabase = await createClient()

  const { data: matches, error } = await supabase
    .from("matches")
    .select(`
      id,
      status,
      round,
      court,
      result_couple1,
      result_couple2,
      created_at,
      tournaments(name),
      couple1:couples!matches_couple1_id_fkey(
        player1:players!couples_player1_id_fkey(first_name, last_name),
        player2:players!couples_player2_id_fkey(first_name, last_name)
      ),
      couple2:couples!matches_couple2_id_fkey(
        player1:players!couples_player1_id_fkey(first_name, last_name),
        player2:players!couples_player2_id_fkey(first_name, last_name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching matches:", error)
    return []
  }

  return matches || []
}

export default async function AdminMatchesPage() {
  const matches = await getMatches()

  return <MatchesClient matches={matches} />
}
