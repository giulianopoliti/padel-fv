import { Alert, AlertDescription } from '@/components/ui/alert'
import { Globe2, LayoutTemplate, Lock, XCircle } from 'lucide-react'
import BackFromBracketButton from '../components/BackFromBracketButton'
import BackToNotStartedButton from '../components/BackToNotStartedButton'
import DraftMatchesToggle from '../components/DraftMatchesToggle'
import DraftModeToggle from '../components/DraftModeToggle'
import { getTournamentSettingsData } from '../components/settings-data'
import { SettingsSectionHeader, SettingsShellCard } from '../components/settings-shell'
import CancelTournamentButton from '@/components/tournament/club/cancel-tournament'

interface SettingsOperacionPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SettingsOperacionPage({
  params,
}: SettingsOperacionPageProps) {
  const resolvedParams = await params
  const settingsData = await getTournamentSettingsData(resolvedParams.id)

  if (!settingsData) {
    return null
  }

  const {
    tournament,
    isAmericanTournament,
    cancelTournamentData,
    couplesCount,
    playersCount,
  } = settingsData
  const showRecoveryActions =
    tournament.status === 'BRACKET_PHASE' || tournament.status === 'ZONE_PHASE'

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        eyebrow="Operacion"
        title="Flujo y recuperacion"
        description="Herramientas administrativas para publicar, dejar en borrador y volver sobre fases cuando hace falta."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SettingsShellCard
          icon={<Globe2 className="h-5 w-5 text-slate-700" />}
          title="Visibilidad del torneo"
          description="Controla si el torneo aparece publicado o queda en modo borrador."
        >
          <DraftModeToggle
            tournamentId={tournament.id}
            initialIsDraft={tournament.is_draft ?? false}
          />
        </SettingsShellCard>

        {!isAmericanTournament ? (
          <SettingsShellCard
            icon={<LayoutTemplate className="h-5 w-5 text-slate-700" />}
            title="Partidos en borrador"
            description="Decide cuando los partidos pasan a ser visibles para los jugadores."
          >
            <DraftMatchesToggle
              tournamentId={tournament.id}
              initialEnabled={tournament.enable_draft_matches || false}
            />
          </SettingsShellCard>
        ) : (
          <div className="hidden xl:block" />
        )}
      </div>

      <SettingsShellCard
        icon={<Lock className="h-5 w-5 text-slate-700" />}
        title="Acciones de recuperacion"
        description="Botones administrativos para volver a fases anteriores cuando hace falta."
        badge={isAmericanTournament ? 'Americano' : 'Long'}
      >
        {showRecoveryActions ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {tournament.status === 'BRACKET_PHASE' ? (
              <BackFromBracketButton tournamentId={tournament.id} />
            ) : null}
            {tournament.status === 'ZONE_PHASE' ? (
              <BackToNotStartedButton tournamentId={tournament.id} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No hay acciones de recuperacion disponibles para la fase actual.
          </p>
        )}
      </SettingsShellCard>

      {tournament.status !== 'CANCELED' ? (
        <SettingsShellCard
          icon={<XCircle className="h-5 w-5 text-red-700" />}
          title="Cancelar torneo"
          description="Accion irreversible. Revisa bien el impacto antes de confirmar."
          className="border-red-200 bg-red-50/70"
        >
          <div className="space-y-4">
            <Alert className="border-red-200 bg-white">
              <AlertDescription className="text-red-800">
                Si continuas, se cancelara el torneo para jugadores, parejas e historial
                operativo asociado.
              </AlertDescription>
            </Alert>

            <CancelTournamentButton
              tournamentId={tournament.id}
              tournament={cancelTournamentData}
              couplesCount={couplesCount || 0}
              playersCount={playersCount || 0}
            />
          </div>
        </SettingsShellCard>
      ) : null}
    </div>
  )
}
