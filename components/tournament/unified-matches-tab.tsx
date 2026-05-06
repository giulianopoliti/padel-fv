"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Users, Plus, Trophy, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Import existing components that we'll reuse
import MatchCreationSection from "./match-creation-section"
import ExistingMatchesSection from "./existing-matches-section"
import ReadOnlyMatchesTabNew from "./read-only-matches-tab-new"

interface UnifiedMatchesTabProps {
  tournamentId: string
  clubCourts: number
  isOwner?: boolean
  isPublicView?: boolean
  onDataRefresh?: () => void
  tournamentStatus?: string
}

export default function UnifiedMatchesTab({
  tournamentId,
  clubCourts,
  isOwner = false,
  isPublicView = false,
  onDataRefresh,
  tournamentStatus = "UNKNOWN"
}: UnifiedMatchesTabProps) {
  const [activeView, setActiveView] = useState<'create' | 'manage'>('manage')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { toast } = useToast()

  // Handler for when matches are created - refresh both views
  const handleMatchesCreated = () => {
    setRefreshTrigger(prev => prev + 1)
    if (onDataRefresh) {
      onDataRefresh()
    }
    // Switch to manage view to see the newly created matches
    setActiveView('manage')
    toast({
      title: "Partidos creados",
      description: "Los partidos se han creado exitosamente",
      variant: "default"
    })
  }

  // Handler for when match results are updated
  const handleMatchUpdated = () => {
    setRefreshTrigger(prev => prev + 1)
    if (onDataRefresh) {
      onDataRefresh()
    }
  }

  // Si no es owner, mostrar vista pública (read-only)
  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Partidos del Torneo</h2>
          <Badge variant="secondary" className="text-sm">
            {isPublicView ? 'Vista Pública' : 'Vista de Jugador'}
          </Badge>
        </div>
        <ReadOnlyMatchesTabNew
          tournamentId={tournamentId}
          tournamentStatus={tournamentStatus}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Gestión de Partidos</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabbed interface for create vs manage */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as 'create' | 'manage')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="manage" className="gap-2">
            <Trophy className="h-4 w-4" />
            Gestionar Partidos
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            Crear Partidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="mt-6">
          <ExistingMatchesSection
            tournamentId={tournamentId}
            isOwner={isOwner}
            isPublicView={false}
            refreshTrigger={refreshTrigger}
            onMatchUpdated={handleMatchUpdated}
            tournamentStatus={tournamentStatus}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <MatchCreationSection
            tournamentId={tournamentId}
            clubCourts={clubCourts}
            isOwner={isOwner}
            onMatchesCreated={handleMatchesCreated}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}