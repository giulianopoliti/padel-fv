import Image from "next/image"
import Link from "next/link"
import { CalendarDays, ChevronRight, MapPin, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import BrandLogo from "@/components/ui/brand-logo"
import { getTenantBranding } from "@/config/tenant"
import { getTenantHomeData } from "@/lib/services/tenant-home.service"
import { getStorageUrl } from "@/utils/storage-url"

export async function HomeContent() {
  const branding = getTenantBranding()
  const { organization, tournaments, clubs, ranking } = await getTenantHomeData()

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_45%)]" />
        <div className="relative container mx-auto px-6 py-20 lg:py-28">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="mb-8 rounded-3xl bg-white/8 p-6 backdrop-blur">
              {organization?.logo_url ? (
                <Image
                  src={getStorageUrl(organization.logo_url) || organization.logo_url}
                  alt={organization.name}
                  width={320}
                  height={120}
                  className="h-24 w-auto"
                  priority
                />
              ) : (
                <BrandLogo variant="hero" />
              )}
            </div>

            <h1 className="mb-6 text-4xl font-black tracking-tight lg:text-6xl">
              {organization?.name || branding.home.title}
            </h1>
            <p className="mb-10 max-w-3xl text-lg text-slate-200 lg:text-xl">
              {organization?.description || branding.home.subtitle}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="bg-blue-600 px-8 py-6 text-lg hover:bg-blue-700">
                <Link href="/tournaments">
                  <CalendarDays className="mr-2 h-5 w-5" />
                  {branding.home.ctaPrimary}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/5 px-8 py-6 text-lg text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/ranking">
                  <Trophy className="mr-2 h-5 w-5" />
                  {branding.home.ctaSecondary}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Inicio</p>
            <h2 className="text-3xl font-black text-slate-900">Próximos torneos</h2>
          </div>
          <Button asChild variant="ghost" className="text-blue-700 hover:bg-blue-50 hover:text-blue-800">
            <Link href="/tournaments">
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <SetupEmptyState
            title="Todavía no hay torneos publicados"
            description="Cuando el tenant tenga torneos cargados, esta sección mostrará automáticamente los próximos eventos de la organización."
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => (
              <Card key={tournament.id} className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
                <div className="relative h-48 bg-slate-100">
                  {tournament.pre_tournament_image_url ? (
                    <Image
                      src={getStorageUrl(tournament.pre_tournament_image_url) || tournament.pre_tournament_image_url}
                      alt={tournament.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-blue-950 text-white">
                      <Trophy className="h-10 w-10 opacity-70" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {tournament.status}
                    </span>
                    {tournament.category_name ? (
                      <span className="text-xs font-semibold text-slate-500">{tournament.category_name}</span>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{tournament.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {tournament.club_name || "Club por definir"}
                      {tournament.start_date ? ` · ${new Date(tournament.start_date).toLocaleDateString("es-AR")}` : ""}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/tournaments/${tournament.id}`}>Ver torneo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Sedes</p>
              <h2 className="text-3xl font-black text-slate-900">Clubes donde organiza</h2>
            </div>
            <Button asChild variant="ghost" className="text-blue-700 hover:bg-blue-100 hover:text-blue-800">
              <Link href="/clubes">
                Ver clubes
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {clubs.length === 0 ? (
            <SetupEmptyState
              title="No hay clubes asociados"
              description="Asociá clubes a la organización y aparecerán acá como parte del home público del tenant."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club) => (
                <Card key={club.id} className="overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
                  <div className="relative h-44 bg-slate-200">
                    {club.cover_image_url ? (
                      <Image
                        src={getStorageUrl(club.cover_image_url) || club.cover_image_url}
                        alt={club.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                        <MapPin className="h-10 w-10 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-3 p-5">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{club.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{club.address || "Dirección no informada"}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>{club.courts || 0} canchas</span>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/clubes/${club.id}`}>Ver club</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Competencia</p>
            <h2 className="text-3xl font-black text-slate-900">Ranking de jugadores</h2>
          </div>
          <Button asChild variant="ghost" className="text-blue-700 hover:bg-blue-50 hover:text-blue-800">
            <Link href="/ranking">
              Ver ranking completo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {ranking.length === 0 ? (
          <SetupEmptyState
            title="Todavía no hay jugadores rankeados"
            description="Cuando los jugadores tengan puntaje dentro de esta organización, el ranking local aparecerá aquí."
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {ranking.map((player, index) => (
              <Link
                key={player.id}
                href={`/ranking/${player.id}`}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 transition-colors hover:bg-slate-50 last:border-b-0"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100">
                    {player.profile_image_url ? (
                      <Image
                        src={getStorageUrl(player.profile_image_url) || player.profile_image_url}
                        alt={`${player.first_name || ""} ${player.last_name || ""}`.trim()}
                        width={48}
                        height={48}
                        className="h-12 w-12 object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        <Users className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {`${player.first_name || ""} ${player.last_name || ""}`.trim() || "Jugador sin nombre"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {player.club_name || "Sin club"}
                      {player.category_name ? ` · ${player.category_name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{player.score || 0}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">puntos</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 py-10 text-slate-300">
        <div className="container mx-auto flex flex-col gap-4 px-6 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-white">{organization?.name || branding.siteName}</p>
            <p>{branding.seo.description}</p>
          </div>
          <div className="text-slate-400">
            <p>{branding.supportEmail}</p>
            <p>{branding.siteDomain}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SetupEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-slate-500">{description}</p>
    </div>
  )
}
