import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
    return null
  }

  // Get user data and role from the database
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !userData) {
    await supabase.auth.signOut()
    redirect("/login")
    return null
  }

  // Si llegamos aquí y el rol no es válido, redirigir al inicio de sesión
  if (!["CLUB", "PLAYER", "COACH", "ORGANIZADOR"].includes(userData.role || "")) {
    redirect("/login")
  }

  // Esta página solo se muestra si hay un problema con la configuración de las rutas paralelas
  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Panel de Control</h1>
      <p className="text-gray-600 mb-2">Bienvenido a tu panel de control.</p>
      <p className="text-gray-600">Tu rol es: {userData.role}</p>
    </div>
  )
} 