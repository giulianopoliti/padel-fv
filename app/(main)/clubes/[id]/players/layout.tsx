import { ReactNode } from "react"
import { createClient } from "@/utils/supabase/server"
import { getUser, getUserRole } from "@/app/api/users"

export default async function ClubPlayersLayout({
  children,
  club,
  params
}: {
  children: ReactNode
  club: ReactNode
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser()
  const userRole = await getUserRole()

  // Check if the current user is the owner of this specific club
  let isOwner = false
  
  if (user && userRole === "CLUB") {
    const { data: clubData, error } = await supabase
      .from("clubes")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", params.id)
      .single()

    isOwner = !error && !!clubData
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {isOwner ? club : children}
    </div>
  )
} 