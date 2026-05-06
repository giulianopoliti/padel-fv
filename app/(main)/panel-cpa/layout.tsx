import { ReactNode } from "react"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Navbar from "@/components/navbar"

export const dynamic = 'force-dynamic'

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

  // Get user data and role from the database
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !userData) {
    // If there's an error or user doesn't exist, sign out and redirect to login
    await supabase.auth.signOut()
    redirect("/login")
  }

  // Return the appropriate slot based on the user's role
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