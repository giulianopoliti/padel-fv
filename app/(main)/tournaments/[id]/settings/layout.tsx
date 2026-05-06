import React from 'react'
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { checkTournamentPermissions } from "@/utils/tournament-permissions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface SettingsLayoutProps {
  children: React.ReactNode
  params: {
    id: string
  }
}

export default async function SettingsLayout({
  children,
  params
}: SettingsLayoutProps) {
  const resolvedParams = await params
  const supabase = await createClient()

  // Basic auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check tournament permissions (only CLUB + ORGANIZADOR can access)
  const permissions = await checkTournamentPermissions(user.id, resolvedParams.id)

  if (!permissions.hasPermission) {
    // Get tournament name for error display
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name')
      .eq('id', resolvedParams.id)
      .single()

    // Show access denied page
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="container mx-auto px-4 py-4 lg:py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 lg:mb-6">
                <Button asChild variant="outline" className="border-gray-300 w-fit">
                  <Link href={`/tournaments/${resolvedParams.id}`} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Volver al Torneo</span>
                  </Link>
                </Button>

                <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  Acceso Denegado
                </div>
              </div>

              <div className="flex items-start gap-3 lg:gap-4">
                <div className="bg-red-100 p-2 lg:p-3 rounded-xl">
                  <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2 truncate">
                    Configuración - {tournament?.name || 'Torneo'}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Solo organizadores y clubes pueden acceder a esta sección
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Acceso restringido:</strong> Solo los organizadores del torneo y clubes pueden modificar la configuración.
                <br />
                <span className="text-sm">
                  Razón: {permissions.reason || 'No tienes permisos suficientes'}
                </span>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    )
  }

  // User has permission, render settings without wrapper
  // The parent TournamentLongLayout already handles the layout
  return <>{children}</>
}