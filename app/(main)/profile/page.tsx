import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import UserProfileForm from "@/components/user-profile-form"	

export default async function Profile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user data from the database
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !userData) {
    console.error("Error fetching user data:", error)
    redirect("/dashboard")
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-padel-green-500">
              <AvatarImage src={userData.avatar_url || ''} alt={userData.email} />
              <AvatarFallback>{userData.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{userData.email}</CardTitle>
              <CardDescription>
                Rol: {userData.role === "PLAYER" ? "Jugador" : userData.role === "CLUB" ? "Club" : "Entrenador"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UserProfileForm user={userData} />
        </CardContent>
      </Card>
    </div>
  )
} 