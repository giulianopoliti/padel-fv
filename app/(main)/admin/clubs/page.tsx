import { ClubsClient } from "./clubs-client"
import { supabaseAdmin } from "@/lib/supabase-admin"

async function getClubs() {
  const { data: clubs, error } = await supabaseAdmin
    .from("clubes")
    .select(`
      id,
      name,
      email,
      phone,
      phone2,
      address,
      courts,
      opens_at,
      closes_at,
      instagram,
      website,
      description,
      is_active,
      created_at,
      user_id,
      users(email)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching clubs:", error)
    return []
  }

  return clubs || []
}

export default async function AdminClubsPage() {
  const clubs = await getClubs()

  return <ClubsClient clubs={clubs} />
}
