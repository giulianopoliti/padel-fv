import type { ReactNode } from "react"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
  club,
  player,
  coach,
  organizador,
}: {
  children: ReactNode
  club: ReactNode
  player: ReactNode
  coach: ReactNode
  organizador: ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !userData) {
    await supabase.auth.signOut()
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {userData.role === "CLUB" && club}
      {userData.role === "PLAYER" && player}
      {userData.role === "COACH" && coach}
      {userData.role === "ORGANIZADOR" && organizador}
      {!["CLUB", "PLAYER", "COACH", "ORGANIZADOR"].includes(userData.role || "") && children}
    </div>
  )
}
