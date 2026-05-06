import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import UserProfileForm from "@/components/user-profile-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function PlayerProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user data from the database
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (userError || !userData) {
    console.error("Error fetching user data:", userError)
    redirect("/dashboard")
  }

  // Get player data from the database
  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", userData.id)
    .single()

  if (playerError && playerError.code !== "PGRST116") {
    console.error("Error fetching player data:", playerError)
  }

  return (
    <div className="grid gap-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">Información General</TabsTrigger>
          <TabsTrigger value="player">Datos de Jugador</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-padel-green-500">
                  <AvatarImage src={userData.avatar_url || ''} alt={userData.email || ''} />
                  <AvatarFallback>{userData.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{userData.email}</CardTitle>
                  <CardDescription>
                    Rol: Jugador
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <UserProfileForm user={userData} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="player" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de Jugador</CardTitle>
              <CardDescription>
                Detalles específicos de tu perfil como jugador
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playerData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium">Nombre</h3>
                      <p className="text-base">{playerData.first_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Apellido</h3>
                      <p className="text-base">{playerData.last_name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Puntaje</h3>
                      <p className="text-base">{playerData.score}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Categoría</h3>
                      <p className="text-base">{playerData.category}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Mano hábil</h3>
                      <p className="text-base">{playerData.preferred_hand === "LEFT" ? "Izquierda" : "Derecha"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">Lado preferido</h3>
                      <p className="text-base">{playerData.preferred_side === "DRIVE" ? "Derecha" : "Revés"}</p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button asChild>
                      <Link href={`/dashboard/player`}>Editar datos de jugador</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-4">No has completado tu perfil de jugador</p>
                  <Button asChild>
                    <Link href={`/dashboard/player`}>Configurar perfil de jugador</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
