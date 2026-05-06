import { TournamentsClient } from "./tournaments-client"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getTournaments() {
  const { data: tournaments, error } = await supabaseAdmin
    .from("tournaments")
    .select(`
      id,
      name,
      description,
      price,
      award,
      max_participants,
      category_name,
      gender,
      type,
      start_date,
      end_date,
      status,
      created_at,
      clubes(name),
      organizaciones(name)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching tournaments:", error)
    return []
  }

  return tournaments || []
}

export default async function AdminTournamentsPage() {
  const tournaments = await getTournaments()

  return <TournamentsClient tournaments={tournaments} />
}
