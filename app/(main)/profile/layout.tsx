import { ReactNode } from "react"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Navbar from "@/components/navbar"

export default async function ProfileLayout({
  children,
  player,
}: {
  children: ReactNode
  player: ReactNode
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
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-padel-green-600">Mi Perfil</h1>
        {userData.role === "PLAYER" && player}
        {userData.role !== "PLAYER" && children}
      </div>
    </div>
  )
} 