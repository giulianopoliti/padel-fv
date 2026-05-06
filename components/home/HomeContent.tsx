import Link from "next/link"
import { Building2, CalendarDays, ChevronRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import BrandLogo from "@/components/ui/brand-logo"
import { getTenantBranding } from "@/config/tenant"
import { getTenantHomeData } from "@/lib/services/tenant-home.service"
import { HomeTournamentTabs } from "@/components/tournaments/home-tournament-tabs"

export async function HomeContent() {
  const branding = getTenantBranding()
  const { organization, tournaments, clubs } = await getTenantHomeData()

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f7_0%,#ffffff_32%,#f4f7fb_100%)]">
      <section className="border-b border-brand-100 bg-white/95">
        <div className="container mx-auto px-6 py-10 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6">
              <div className="max-w-xs">
                <BrandLogo variant="hero" surface="light" className="h-auto w-full max-w-[320px]" />
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">
                  {organization?.name || branding.siteName}
                </p>
                <h1 className="text-4xl font-black tracking-tight text-brand-900 lg:text-6xl">
                  Proximos torneos claros, simples y listos para inscribirte.
                </h1>
                <p className="max-w-3xl text-lg text-slate-600">
                  {organization?.description || branding.home.subtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-brand-600 px-7 text-base font-semibold text-white hover:bg-brand-700">
                  <Link href="/tournaments">
                    <CalendarDays className="mr-2 h-5 w-5" />
                    {branding.home.ctaPrimary}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 border-brand-200 px-7 text-base font-semibold text-brand-700 hover:bg-brand-50">
                  <Link href="/clubes">
                    <MapPin className="mr-2 h-5 w-5" />
                    {branding.home.ctaSecondary}
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="border-brand-800 bg-brand-900 text-white shadow-xl">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-court-300">
                    Lo importante primero
                  </p>
                  <h2 className="mt-3 text-2xl font-black">Inscribite mas rapido</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-court-200">Categorias y formato</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Separado en Ligas y Americanos para ubicar cada torneo al instante.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-court-200">Sede y horario</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Cada card muestra club, fecha y horario sin depender de imagenes.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-court-500/40 bg-court-500/10 p-4 text-sm text-court-50">
                  Boton principal: <span className="font-semibold">Inscribirme</span>. Si el torneo ya tiene inscripcion
                  publica, te lleva directo; si no, te abre el detalle.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="proximos-torneos" className="container mx-auto px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Torneos</p>
            <h2 className="text-3xl font-black text-brand-900">Proximos torneos</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Toda la informacion importante en una sola vista: categoria, formato, horario, club y acceso rapido a la
              inscripcion.
            </p>
          </div>
          <Button asChild variant="ghost" className="text-brand-700 hover:bg-brand-50 hover:text-brand-800">
            <Link href="/tournaments">
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <SetupEmptyState
            title="Todavia no hay torneos publicados"
            description="En cuanto Padel FV cargue nuevos torneos, van a aparecer aca automaticamente con su informacion principal."
          />
        ) : (
          <HomeTournamentTabs tournaments={tournaments} />
        )}
      </section>

      <section className="border-y border-brand-100 bg-brand-50/60 py-16">
        <div className="container mx-auto px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">Sedes</p>
              <h2 className="text-3xl font-black text-brand-900">Clubes donde organiza</h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Referencias rapidas para ubicar cada sede del circuito Padel FV.
              </p>
            </div>
            <Button asChild variant="ghost" className="text-brand-700 hover:bg-brand-100 hover:text-brand-800">
              <Link href="/clubes">
                Ver clubes
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {clubs.length === 0 ? (
            <SetupEmptyState
              title="No hay clubes asociados"
              description="Cuando Padel FV vincule clubes a la organizacion, apareceran aca automaticamente."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clubs.map((club) => (
                <Card key={club.id} className="border-brand-100 bg-white shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-brand-900">{club.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{club.address || "Direccion no informada"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm text-slate-600">
                      <span>Canchas disponibles</span>
                      <span className="font-semibold text-brand-900">{club.courts || 0}</span>
                    </div>

                    <Button asChild variant="outline" className="w-full border-brand-200 text-brand-700 hover:bg-brand-50">
                      <Link href={`/clubes/${club.id}`}>Ver club</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="bg-brand-900 py-10 text-slate-300">
        <div className="container mx-auto flex flex-col gap-4 px-6 text-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <BrandLogo variant="navbar" surface="dark" className="h-10 w-auto" priority={false} />
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
    <div className="rounded-3xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center shadow-sm">
      <h3 className="text-xl font-bold text-brand-900">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-slate-500">{description}</p>
    </div>
  )
}
