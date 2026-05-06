import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Building2,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Shield,
  Star,
  Trophy,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import TournamentBasicInfoForm from './components/TournamentBasicInfoForm'
import TournamentImageSection from './components/TournamentImageSection'
import RegistrationControlForm from './components/RegistrationControlForm'
import InscriptionAutomationForm from './components/InscriptionAutomationForm'
import QualifyingAdvancementForm from './components/QualifyingAdvancementForm'
import DraftMatchesToggle from './components/DraftMatchesToggle'
import DraftModeToggle from './components/DraftModeToggle'
import TournamentFormatConfigForm from './components/TournamentFormatConfigForm'
import { addTournamentClubsAction, removeTournamentClubsAction } from './actions'
import BackToNotStartedButton from './components/BackToNotStartedButton'
import BackFromBracketButton from './components/BackFromBracketButton'
import CancelTournamentButton from '@/components/tournament/club/cancel-tournament'
import { shouldUseLegacyQualifying } from '@/lib/services/tournament-format-policy'

interface SettingsPageProps {
  params: { id: string }
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  )
}

function ShellCard({
  icon,
  title,
  description,
  children,
  className = '',
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
            <CardDescription className="text-sm text-slate-600">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100/70">{label}</p>
          <p className="text-sm leading-5 text-slate-200/90">{helper}</p>
        </div>
        <p className="max-w-[9rem] text-right text-lg font-semibold leading-tight text-white sm:text-xl">{value}</p>
      </div>
    </div>
  )
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const supabase = await createClient()
  const resolvedParams = await params

  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(`
      id,
      name,
      description,
      max_participants,
      category_name,
      type,
      format_type,
      format_config,
      status,
      registration_locked,
      bracket_status,
      enable_public_inscriptions,
      enable_payment_checkboxes,
      enable_transfer_proof,
      transfer_alias,
      transfer_amount,
      pre_tournament_image_url,
      enable_draft_matches,
      is_draft,
      club_id,
      start_date,
      end_date,
      clubes (
        name,
        cover_image_url
      )
    `)
    .eq('id', resolvedParams.id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  const { count: inscriptionsCount } = await supabase
    .from('inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', resolvedParams.id)
    .eq('es_prueba', false)

  const { data: rankingConfig } = await supabase
    .from('tournament_ranking_config')
    .select('*')
    .eq('tournament_id', resolvedParams.id)
    .eq('is_active', true)
    .single()

  const { count: couplesCount } = await supabase
    .from('inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', resolvedParams.id)
    .eq('es_prueba', false)
    .eq('inscription_type', 'couple')

  const { count: playersCount } = await supabase
    .from('inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', resolvedParams.id)
    .eq('es_prueba', false)
    .eq('inscription_type', 'individual')

  const { data: currentClubs } = await supabase
    .from('clubes_tournament')
    .select(`
      club_id,
      clubes:club_id ( id, name )
    `)
    .eq('tournament_id', resolvedParams.id)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organizacion_id')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .maybeSingle()

  let manageableClubs: { id: string; name: string }[] = []
  if (orgMember?.organizacion_id) {
    const { data: orgClubs } = await supabase
      .from('organization_clubs')
      .select(`clubes:club_id ( id, name )`)
      .eq('organizacion_id', orgMember.organizacion_id)

    manageableClubs = (orgClubs || []).map((clubLink: any) => ({
      id: clubLink.clubes.id,
      name: clubLink.clubes.name,
    }))
  }

  const imageSectionTournament = {
    id: tournament.id as string,
    name: tournament.name as string,
    pre_tournament_image_url: (tournament as any).pre_tournament_image_url ?? null,
    clubes: (() => {
      const clubes = (tournament as any).clubes
      if (!clubes) return null
      const club = Array.isArray(clubes) ? clubes[0] : clubes
      return club ? { cover_image_url: club.cover_image_url ?? null } : null
    })(),
  }

  const cancelTournamentData = {
    id: tournament.id as string,
    name: tournament.name as string,
    description: tournament.description ?? undefined,
    start_date: (tournament as any).start_date ?? undefined,
    end_date: (tournament as any).end_date ?? undefined,
    status: tournament.status ?? 'NOT_STARTED',
    type: tournament.type ?? 'AMERICANO',
    gender: tournament.category_name ?? 'MIXTO',
    max_participants: tournament.max_participants ?? undefined,
    clubes: (() => {
      const clubes = (tournament as any).clubes
      if (!clubes) return undefined
      const club = Array.isArray(clubes) ? clubes[0] : clubes
      return club ? { name: club.name ?? undefined } : undefined
    })(),
  }

  const isAmericanTournament = tournament.type === 'AMERICANO' || tournament.type === 'AMERICAN'
  const showLegacyQualifying = !isAmericanTournament && shouldUseLegacyQualifying(tournament as any)
  const tournamentTypeLabel = isAmericanTournament ? 'Americano' : 'Largo'
  const publicInscriptionsLabel = tournament.enable_public_inscriptions ? 'Publicas' : 'Privadas'
  const publicationLabel = tournament.is_draft ? 'Borrador' : 'Publicado'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="bg-white">
            <Link href={`/tournaments/${tournament.id}`} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al torneo
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.28),_transparent_34%),linear-gradient(135deg,_rgb(15,23,42),_rgb(30,41,59)_56%,_rgb(29,78,216))] px-6 py-8 text-white sm:px-8 sm:py-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="flex-1 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15">
                  {tournamentTypeLabel}
                </Badge>
                  <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15">
                    {publicationLabel}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/15 text-white hover:bg-white/15">
                    {publicInscriptionsLabel}
                  </Badge>
                </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/90">
                  Panel de configuracion
                </p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {tournament.name}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                  Organiza la informacion base, las inscripciones, la visibilidad y las reglas del torneo desde un solo lugar.
                </p>
              </div>
            </div>

            <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-md sm:p-5 lg:max-w-md">
              <div className="mb-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100/70">
                  Resumen rapido
                </p>
                <p className="text-sm text-slate-200/90">
                  Lo esencial del torneo y de las inscripciones en un solo vistazo.
                </p>
              </div>

              <div className="space-y-3">
              <MetricCard
                label="Tipo"
                helper={tournament.category_name || 'Sin categoria'}
                value={tournamentTypeLabel}
              />
                <MetricCard
                  label="Inscripciones"
                  helper="Registradas"
                  value={String(inscriptionsCount || 0)}
                />
                <MetricCard
                label="Cobro"
                helper={tournament.enable_payment_checkboxes ? 'Con checkboxes' : 'Sin checkboxes'}
                value={tournament.enable_transfer_proof ? 'Comprobante' : 'Libre'}
              />
              </div>
            </div>
          </div>
        </div>
      </Card>

        <section className="space-y-4">
          <SectionIntro
            eyebrow="Base"
            title="Informacion general"
            description="Datos principales del torneo, portada y clubes vinculados."
          />

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <ShellCard
              icon={<FileText className="h-5 w-5 text-emerald-600" />}
              title="Informacion basica"
              description="Edita nombre, descripcion y capacidad maxima sin salir del panel."
            >
              <TournamentBasicInfoForm
                tournamentId={tournament.id}
                initialData={{
                  name: tournament.name,
                  description: tournament.description,
                  max_participants: tournament.max_participants,
                }}
                inscriptionsCount={inscriptionsCount || 0}
              />
            </ShellCard>

            <ShellCard
              icon={<ImageIcon className="h-5 w-5 text-indigo-600" />}
              title="Portada del torneo"
              description="Sube o reemplaza la imagen que acompaña la presentacion publica."
            >
              <TournamentImageSection tournament={imageSectionTournament} />
            </ShellCard>
          </div>

          {!isAmericanTournament && (
            <ShellCard
              icon={<Building2 className="h-5 w-5 text-slate-700" />}
              title="Clubes del torneo"
              description="Gestiona los clubes asociados. El club principal queda protegido."
            >
              <div className="space-y-5">
                {tournament.club_id && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900">Club principal protegido</AlertTitle>
                    <AlertDescription className="text-blue-800">
                      El club principal no se puede quitar porque sostiene permisos, horarios y partidos del torneo.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Clubes actualmente vinculados</p>
                  <div className="flex flex-wrap gap-2">
                    {(currentClubs || []).map((clubLink: any) => {
                      const isMainClub = tournament.club_id === clubLink.club_id
                      return (
                        <Badge
                          key={clubLink.club_id}
                          variant="outline"
                          className={`gap-2 px-3 py-1.5 ${
                            isMainClub
                              ? 'border-blue-300 bg-blue-50 text-blue-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {isMainClub && <Star className="h-3 w-3 fill-blue-600 text-blue-600" />}
                            {clubLink.clubes?.name || clubLink.club_id}
                            {isMainClub && ' (Principal)'}
                          </span>
                          {!isMainClub && (
                            <form
                              action={async () => {
                                'use server'
                                await removeTournamentClubsAction(tournament.id, [clubLink.club_id])
                              }}
                            >
                              <button
                                aria-label={`Quitar ${clubLink.clubes?.name || ''}`}
                                className="inline-flex items-center text-slate-500 transition-colors hover:text-red-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                        </Badge>
                      )
                    })}

                    {(currentClubs || []).length === 0 && (
                      <p className="text-sm text-slate-500">Aun no hay clubes asociados.</p>
                    )}
                  </div>
                </div>

                <Separator />

                {manageableClubs.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-900">Agregar clubes gestionables</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="bg-white">
                          <Building2 className="mr-2 h-4 w-4" />
                          Buscar y agregar clubes
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar club..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No se encontraron clubes</CommandEmpty>
                            <CommandGroup>
                              {manageableClubs.map((club) => {
                                const alreadyLinked = (currentClubs || []).some((current: any) => current.club_id === club.id)
                                return (
                                  <form
                                    key={club.id}
                                    action={async () => {
                                      'use server'
                                      await addTournamentClubsAction(tournament.id, [club.id])
                                    }}
                                  >
                                    <CommandItem className="flex items-center gap-3">
                                      <Checkbox checked={alreadyLinked} disabled={alreadyLinked} />
                                      <span className="flex-1">{club.name}</span>
                                      <Button type="submit" variant="ghost" size="sm" disabled={alreadyLinked}>
                                        Agregar
                                      </Button>
                                    </CommandItem>
                                  </form>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </ShellCard>
          )}
        </section>

        <section className="space-y-4">
          <SectionIntro
            eyebrow="Inscripciones"
            title="Acceso y cobro"
            description="Define como entra la gente al torneo y como vas a organizar los pagos."
          />

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ShellCard
              icon={<Users className="h-5 w-5 text-blue-600" />}
              title="Control de inscripciones"
              description="Abre o cierra nuevas inscripciones segun la etapa del torneo."
            >
              <RegistrationControlForm
                tournamentId={tournament.id}
                initialRegistrationLocked={tournament.registration_locked || false}
                initialBracketStatus={tournament.bracket_status || 'NOT_STARTED'}
                currentStatus={tournament.status || 'NOT_STARTED'}
              />
            </ShellCard>

            <ShellCard
              icon={<Eye className="h-5 w-5 text-amber-600" />}
              title="Vista publica y herramientas de pago"
              description="Configura privacidad, seguimiento manual y transferencia con comprobante."
            >
              <InscriptionAutomationForm
                tournamentId={tournament.id}
                initialEnablePublicInscriptions={tournament.enable_public_inscriptions ?? true}
                initialEnablePaymentCheckboxes={tournament.enable_payment_checkboxes ?? false}
                initialEnableTransferProof={tournament.enable_transfer_proof ?? false}
                initialTransferAlias={tournament.transfer_alias ?? null}
                initialTransferAmount={tournament.transfer_amount ?? null}
              />
            </ShellCard>
          </div>
        </section>

        <section className="space-y-4">
          <SectionIntro
            eyebrow="Operacion"
            title="Flujo del torneo"
            description="Herramientas para administrar visibilidad, llaves y avance de competencia."
          />

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <ShellCard
              icon={<Globe2 className="h-5 w-5 text-slate-700" />}
              title="Visibilidad del torneo"
              description="Controla si el torneo aparece publicado o queda en modo borrador."
            >
              <DraftModeToggle
                tournamentId={tournament.id}
                initialIsDraft={tournament.is_draft ?? false}
              />
            </ShellCard>

            <ShellCard
              icon={<Trophy className="h-5 w-5 text-amber-600" />}
              title="Formato del torneo"
              description="Define si juega por zonas, zona unica, campeon directo o copas Oro y Plata."
            >
              <TournamentFormatConfigForm
                tournamentId={tournament.id}
                tournamentType={tournament.type === 'LONG' ? 'LONG' : 'AMERICAN'}
                tournamentStatus={tournament.status}
                formatConfig={(tournament as any).format_config ?? null}
                registeredCouplesCount={couplesCount || inscriptionsCount || 0}
              />
            </ShellCard>

            {isAmericanTournament ? (
              <ShellCard
                icon={<LayoutTemplate className="h-5 w-5 text-blue-600" />}
                title="Acciones de fase"
                description="Atajos operativos para volver a estados anteriores del torneo."
              >
                <div className="space-y-3">
                  {tournament.status === 'BRACKET_PHASE' && (
                    <BackFromBracketButton tournamentId={tournament.id} />
                  )}
                  {tournament.status === 'ZONE_PHASE' && (
                    <BackToNotStartedButton tournamentId={tournament.id} />
                  )}
                  {tournament.status !== 'BRACKET_PHASE' && tournament.status !== 'ZONE_PHASE' && (
                    <p className="text-sm text-slate-500">
                      No hay acciones de retroceso disponibles para la fase actual.
                    </p>
                  )}
                </div>
              </ShellCard>
            ) : showLegacyQualifying ? (
              <ShellCard
                icon={<LayoutTemplate className="h-5 w-5 text-blue-600" />}
                title="Compatibilidad legacy"
                description="El limite viejo de clasificacion se mantiene mientras migramos todos los flujos."
              >
                <QualifyingAdvancementForm
                  tournamentId={tournament.id}
                  rankingConfig={rankingConfig}
                />
              </ShellCard>
            ) : null}
          </div>

          {!isAmericanTournament && (
            <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
              <ShellCard
                icon={<LayoutTemplate className="h-5 w-5 text-slate-700" />}
                title="Partidos en borrador"
                description="Decide cuando los partidos pasan a ser visibles para los jugadores."
              >
                <DraftMatchesToggle
                  tournamentId={tournament.id}
                  initialEnabled={tournament.enable_draft_matches || false}
                />
              </ShellCard>

              {(tournament.status === 'BRACKET_PHASE' || tournament.status === 'ZONE_PHASE') && (
                <ShellCard
                  icon={<Lock className="h-5 w-5 text-slate-700" />}
                  title="Acciones de recuperacion"
                  description="Botones administrativos para volver a fases anteriores cuando hace falta."
                >
                  <div className="flex flex-col gap-3">
                    {tournament.status === 'BRACKET_PHASE' && (
                      <BackFromBracketButton tournamentId={tournament.id} />
                    )}
                    {tournament.status === 'ZONE_PHASE' && (
                      <BackToNotStartedButton tournamentId={tournament.id} />
                    )}
                  </div>
                </ShellCard>
              )}
            </div>
          )}
        </section>

        {tournament.status !== 'CANCELED' && (
          <section className="space-y-4">
            <SectionIntro
              eyebrow="Peligro"
              title="Zona delicada"
              description="Acciones irreversibles. Revisa bien antes de confirmar."
            />

            <Card className="border-red-200 bg-red-50/70 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-red-100 p-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-red-900">Cancelar torneo</CardTitle>
                    <CardDescription className="text-red-800">
                      Esta accion es permanente y afecta la operacion del torneo.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-red-200 bg-white">
                  <AlertDescription className="text-red-800">
                    Si continuas, se cancelara el torneo para jugadores, parejas e historial operativo asociado.
                  </AlertDescription>
                </Alert>

                <CancelTournamentButton
                  tournamentId={tournament.id}
                  tournament={cancelTournamentData}
                  couplesCount={couplesCount || 0}
                  playersCount={playersCount || 0}
                />
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
