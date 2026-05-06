import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getOrganizationBySlug } from "@/app/api/users"
import { getStorageUrl } from "@/utils/storage-url"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import OrganizationTournamentsSection from "@/components/organization/OrganizationTournamentsSection"
import {
  Building2,
  Network,
  Trophy,
  Users,
  Phone,
  Mail,
  MapPin,
  Clock,
  Star,
  Calendar,
  ChevronRight
} from "lucide-react"

interface OrganizationPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { slug } = await params
  const organization = await getOrganizationBySlug(slug)

  if (!organization) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Full Width */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Cover Image Background */}
        <div className="absolute inset-0">
          <Image
            src={
              getStorageUrl(organization.coverImage) ||
              "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg"
            }
            alt={`${organization.name} - Cover`}
            fill
            className="object-cover"
            priority
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-blue-900/70 to-cyan-900/60"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              {organization.logoUrl ? (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white shadow-2xl border-4 border-white overflow-hidden ring-8 ring-blue-400/50">
                  <Image
                    src={getStorageUrl(organization.logoUrl) || "/placeholder.svg"}
                    alt={`${organization.name} - Logo`}
                    width={160}
                    height={160}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-2xl border-4 border-white flex items-center justify-center ring-8 ring-blue-400/50">
                  <Building2 className="h-20 w-20 text-white" />
                </div>
              )}

              {/* Premium Badge */}
              <div className="absolute -top-3 -right-3">
                <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0 shadow-lg px-3 py-1">
                  <Network className="h-4 w-4 mr-1" />
                  Premium
                </Badge>
              </div>
            </div>
          </div>

          {/* Organization Name */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight">
            {organization.name}
          </h1>

          {/* Description */}
          {organization.description && (
            <p className="text-xl md:text-2xl text-cyan-100 max-w-4xl mx-auto mb-12 leading-relaxed">
              {organization.description}
            </p>
          )}

          {/* Stats Cards - Glass Morphism */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12 max-w-4xl mx-auto">
            {/* Clubs */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl min-w-[140px]">
              <div className="flex items-center justify-center mb-3">
                <Network className="h-8 w-8 text-blue-300" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-white">{organization.clubCount}</div>
                <div className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">Clubes</div>
              </div>
            </div>

            {/* Tournaments */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl min-w-[140px]">
              <div className="flex items-center justify-center mb-3">
                <Trophy className="h-8 w-8 text-cyan-300" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-white">{organization.tournamentCount}</div>
                <div className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">Torneos</div>
              </div>
            </div>

            {/* Players */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl min-w-[140px]">
              <div className="flex items-center justify-center mb-3">
                <Users className="h-8 w-8 text-sky-300" />
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-white">{organization.playersCount}+</div>
                <div className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">Jugadores</div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 px-8"
              asChild
            >
              <a href="#contact">
                Contactar
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="!border-2 !border-white !bg-transparent !text-white hover:!bg-white/20 hover:!text-white px-8 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300"
              asChild
            >
              <a href="#tournaments">
                Ver Torneos
                <Trophy className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white/70 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Sticky Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo Small */}
            <div className="flex items-center gap-3">
              {organization.logoUrl ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden">
                  <Image
                    src={getStorageUrl(organization.logoUrl) || "/placeholder.svg"}
                    alt={organization.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="font-bold text-gray-900 hidden md:block">{organization.name}</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#gallery" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Galería
              </a>
              <a href="#clubs" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Clubes
              </a>
              <a href="#tournaments" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Torneos
              </a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Contacto
              </a>
            </div>

            {/* Contact Button */}
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              asChild
            >
              <a href="#contact">
                Contactar
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Content Sections */}
      <div className="container mx-auto px-6 py-20">
        {/* Gallery Section */}
        {organization.galleryImages && organization.galleryImages.length > 0 && (
          <section id="gallery" className="mb-32">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Galería</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {organization.galleryImages.slice(0, 8).map((imageUrl, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  <Image
                    src={getStorageUrl(imageUrl) || "/placeholder.svg"}
                    alt={`${organization.name} - Galería ${index + 1}`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/30 group-hover:to-cyan-600/30 transition-all duration-300"></div>
                </div>
              ))}
            </div>

            {organization.galleryImages.length > 8 && (
              <div className="text-center mt-8">
                <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  Ver Todas las Fotos ({organization.galleryImages.length})
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Clubs Section */}
        {organization.clubs && organization.clubs.length > 0 && (
          <section id="clubs" className="mb-32">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 mb-4">Nuestros Clubes</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto rounded-full"></div>
            </div>

            {/* Featured Club Spotlight */}
            {organization.featuredClub && (
              <div className="mb-12">
                <Card className="overflow-hidden border-4 border-amber-400 shadow-2xl hover:shadow-amber-500/30 transition-all duration-500">
                  <div className="relative h-64 md:h-80">
                    {/* Club Cover Image */}
                    <Image
                      src={
                        getStorageUrl(organization.featuredClub.coverImage) ||
                        "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg"
                      }
                      alt={organization.featuredClub.name}
                      fill
                      className="object-cover"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/70 via-blue-900/60 to-transparent"></div>

                    {/* Featured Badge */}
                    <div className="absolute top-6 left-6">
                      <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0 shadow-lg px-4 py-2">
                        <Star className="h-4 w-4 mr-2 fill-white" />
                        Club Destacado
                      </Badge>
                    </div>

                    {/* Club Logo Overlay */}
                    {organization.featuredClub.logoUrl && (
                      <div className="absolute bottom-6 left-6">
                        <div className="w-20 h-20 rounded-xl bg-white shadow-xl border-2 border-white overflow-hidden">
                          <Image
                            src={getStorageUrl(organization.featuredClub.logoUrl) || "/placeholder.svg"}
                            alt={organization.featuredClub.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}

                    {/* Club Info */}
                    <div className="absolute bottom-6 right-6 text-right">
                      <h3 className="text-3xl font-black text-white mb-2">{organization.featuredClub.name}</h3>
                      {organization.featuredClub.address && (
                        <div className="flex items-center justify-end gap-2 text-cyan-100">
                          <MapPin className="h-4 w-4" />
                          <span>{organization.featuredClub.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6">
                    <div className="flex flex-wrap items-center gap-6 justify-center md:justify-start">
                      {organization.featuredClub.courts && (
                        <div className="flex items-center gap-2 text-amber-800">
                          <Users className="h-5 w-5" />
                          <span className="font-semibold">{organization.featuredClub.courts} canchas</span>
                        </div>
                      )}
                      {organization.featuredClub.opensAt && organization.featuredClub.closesAt && (
                        <div className="flex items-center gap-2 text-amber-800">
                          <Clock className="h-5 w-5" />
                          <span className="font-semibold">{organization.featuredClub.opensAt} - {organization.featuredClub.closesAt}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* All Clubs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organization.clubs
                .filter((club: any) => club.id !== organization.featuredClub?.id)
                .map((club: any) => (
                <Card
                  key={club.id}
                  className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                >
                  {/* Club Cover */}
                  <div className="relative h-48">
                    <Image
                      src={
                        getStorageUrl(club.cover_image) ||
                        "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg"
                      }
                      alt={club.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 to-transparent"></div>

                    {/* Club Logo */}
                    {club.logo_url && (
                      <div className="absolute bottom-4 left-4">
                        <div className="w-16 h-16 rounded-lg bg-white shadow-xl border-2 border-white overflow-hidden">
                          <Image
                            src={getStorageUrl(club.logo_url) || "/placeholder.svg"}
                            alt={club.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Club Info */}
                  <div className="p-6">
                    <h3 className="text-xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {club.name}
                    </h3>

                    <div className="space-y-2 text-sm text-slate-600">
                      {club.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span>{club.address}</span>
                        </div>
                      )}
                      {club.courts && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span>{club.courts} canchas</span>
                        </div>
                      )}
                      {club.opens_at && club.closes_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span>{club.opens_at} - {club.closes_at}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Tournaments Section */}
        {organization.tournaments && organization.tournaments.length > 0 && (
          <OrganizationTournamentsSection
            tournaments={organization.tournaments}
            clubs={organization.clubs || []}
            organizationLogo={getStorageUrl(organization.logoUrl)}
            organizationName={organization.name}
            coverImageFallback={getStorageUrl(organization.coverImage)}
          />
        )}

        {/* Contact Section */}
        <section id="contact" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Contacto</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Información de Contacto</h3>

                <div className="space-y-4">
                  {organization.email && (
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-500">Email</div>
                        <a href={`mailto:${organization.email}`} className="text-blue-600 hover:underline font-medium">
                          {organization.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {organization.phone && (
                    <div className="flex items-center gap-4 p-4 bg-cyan-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-500">Teléfono</div>
                        <a href={`tel:${organization.phone}`} className="text-cyan-600 hover:underline font-medium">
                          {organization.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {organization.responsibleName && (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-500">
                          {organization.responsiblePosition || 'Responsable'}
                        </div>
                        <div className="text-slate-900 font-medium">{organization.responsibleName}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <Card className="p-6 shadow-xl border-gray-200">
                <h3 className="text-xl font-black text-slate-900 mb-6">Envíanos un Mensaje</h3>

                <form className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                      placeholder="tu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-2">
                      Mensaje
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all resize-none"
                      placeholder="Escribe tu mensaje aquí..."
                    ></textarea>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Enviar Mensaje
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
