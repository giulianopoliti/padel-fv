import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MapPin,
  Star,
  ChevronLeft,
  Users,
  Clock,
  Phone,
  Globe,
  Mail,
  Calendar,
  User,
  MessageSquare,
  CheckCircle,
  Trophy,
  Instagram,
  BarChart3,
  Crown,
  Award,
  ArrowRight,
} from "lucide-react"
import { getClubDetails, getClubPlayersForRanking } from "@/app/api/users"
import { notFound } from "next/navigation"
import PlayerAvatar from "@/components/player-avatar"
import ContactButton from "./contact-button"

const ClubGallery = ({ images }: { images: string[] }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {images.map((image, index) => (
      <div key={index} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
        <img
          src={image || "/placeholder.svg"}
          alt={`Imagen ${index + 1}`}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
    ))}
  </div>
)

export default async function ClubDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  
  // Fetch club details and players data in parallel
  const [club, playersData] = await Promise.all([
    getClubDetails(id),
    getClubPlayersForRanking(id)
  ])

  if (!club) {
    notFound()
  }

  // Calculate club statistics
  const totalPlayers = playersData.length
  const totalScore = playersData.reduce((sum, player) => sum + (player.score || 0), 0)
  const topPlayers = playersData.slice(0, 3) // Get top 3 players

  const defaultImages = [
    "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg?height=400&width=600",
    "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg?height=400&width=600",
    "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg?height=400&width=600",
    "https://vulusxqgknaejdxnhiex.supabase.co/storage/v1/object/public/imagenes/prueba/cancha%20prueba.jpg?height=400&width=600",
  ]

  const galleryImages = club.galleryImages && club.galleryImages.length > 0 ? club.galleryImages : defaultImages

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-4 w-4 text-amber-500" />
      case 1:
        return <Trophy className="h-4 w-4 text-slate-500" />
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/clubes"
            className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors group"
          >
            <ChevronLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
            Volver a clubes
          </Link>
        </div>

        {/* Main Club Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-8">
          <div className="relative h-64 md:h-80">
            <img
              src={club.coverImage || defaultImages[0]}
              alt={club.name || "Club"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6">
              <Badge className="mb-3 bg-white/90 text-slate-700 backdrop-blur-sm shadow-md border-0">
                <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                {club.rating > 0 ? club.rating : "Nuevo"} ({club.reviewCount} opiniones)
              </Badge>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{club.name}</h1>
              <div className="flex items-center text-white/90">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="font-medium">{club.address}</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Sobre el club</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">{club.description || "Descripción del club por completar"}</p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center text-slate-600 mb-2">
                      <Users className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Pistas</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{club.courts || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center text-slate-600 mb-2">
                      <Clock className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Horario</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800">
                      {club.opens_at && club.closes_at
                        ? `${club.opens_at.slice(0, 5)} - ${club.closes_at.slice(0, 5)}`
                        : "8:00 - 22:00"}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center text-slate-600 mb-2">
                      <Phone className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Teléfono</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800">{club.phone}</p>
                  </div>
                  {club.instagram && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center text-slate-600 mb-2">
                        <Instagram className="h-5 w-5 mr-2" />
                        <span className="font-semibold">Instagram</span>
                      </div>
                      <a
                        href={`https://instagram.com/${club.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-slate-800 hover:text-blue-600 transition-colors"
                      >
                        @{club.instagram}
                      </a>
                    </div>
                  )}
                </div>

                {/* Club Players Section */}
                <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-6 mb-8 border border-blue-100">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Jugadores del Club</h2>
                    <Button
                      asChild
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm"
                    >
                      <Link href={`/clubes/${id}/players`} className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Ver todos los jugadores
                      </Link>
                    </Button>
                  </div>

                  {/* Club Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center text-slate-600 mb-2">
                        <Users className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="font-semibold">Total Jugadores</span>
                      </div>
                      <p className="text-2xl font-black text-slate-800">{totalPlayers}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center text-slate-600 mb-2">
                        <BarChart3 className="h-5 w-5 mr-2 text-emerald-600" />
                        <span className="font-semibold">Puntos Totales</span>
                      </div>
                      <p className="text-2xl font-black text-slate-800">{totalScore.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center text-slate-600 mb-2">
                        <Trophy className="h-5 w-5 mr-2 text-amber-600" />
                        <span className="font-semibold">Promedio</span>
                      </div>
                      <p className="text-2xl font-black text-slate-800">
                        {totalPlayers > 0 ? Math.round(totalScore / totalPlayers).toLocaleString() : '0'}
                      </p>
                    </div>
                  </div>

                  {/* Top 3 Players */}
                  {topPlayers.length > 0 ? (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4">Top 3 Jugadores</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {topPlayers.map((player, index) => (
                          <Link
                            key={player.id}
                            href={`/ranking/${player.id}`}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 group"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="relative">
                                <PlayerAvatar
                                  src={player.profileImage}
                                  alt={`${player.firstName} ${player.lastName}`}
                                  size={48}
                                />
                                <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                                  {getMedalIcon(index)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                  {player.firstName} {player.lastName}
                                </p>
                                <Badge className="bg-blue-100 text-blue-800 text-xs mt-1">
                                  {player.category}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold text-slate-800">{player.score.toLocaleString()}</div>
                              <div className="text-xs text-slate-500">puntos</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                      <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">Sin jugadores registrados</h3>
                      <p className="text-slate-600">Este club aún no tiene jugadores registrados en el sistema.</p>
                    </div>
                  )}
                </div>

                {/* Upcoming Tournaments - Moved from sidebar */}
                {club.upcomingTournaments && club.upcomingTournaments.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 mb-8 border border-slate-200 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Próximos torneos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {club.upcomingTournaments.map((tournament: any) => (
                        <div
                          key={tournament.id}
                          className="bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition-all duration-300 group"
                        >
                          {/* Tournament Image */}
                          {tournament.image ? (
                            <div className="relative h-48 overflow-hidden">
                              <img 
                                src={tournament.image} 
                                alt={tournament.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                              <div className="absolute top-3 right-3">
                                <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 shadow-md">
                                  {tournament.category}
                                </Badge>
                              </div>
                              <div className="absolute bottom-3 left-3 right-3">
                                <h4 className="text-lg font-bold text-white mb-1">{tournament.name}</h4>
                                <div className="flex items-center gap-2 text-white/90">
                                  <Calendar className="h-4 w-4" />
                                  <span className="text-sm">{tournament.date}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gradient-to-br from-slate-100 to-slate-200 h-48 flex items-center justify-center">
                              <Trophy className="h-16 w-16 text-slate-400" />
                            </div>
                          )}
                          
                          {/* Tournament Info */}
                          <div className="p-5">
                            {!tournament.image && (
                              <>
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="text-lg font-bold text-slate-800">{tournament.name}</h4>
                                  <Badge className="bg-gradient-to-r from-slate-600 to-slate-800 text-white">
                                    {tournament.category}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 mb-4">
                                  <Calendar className="h-4 w-4" />
                                  <span className="text-sm">{tournament.date}</span>
                                </div>
                              </>
                            )}
                            
                            {/* Tournament Details Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {/* Registrations */}
                              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                                <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                                  <Users className="h-4 w-4" />
                                  <span className="text-xs font-medium">Inscriptos</span>
                                </div>
                                <div className="text-lg font-bold text-slate-800">
                                  {tournament.currentParticipants || 0}
                                  <span className="text-sm text-slate-500">/{tournament.maxParticipants || '∞'}</span>
                                </div>
                              </div>
                              
                              {/* Price or Status */}
                              {tournament.price ? (
                                <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                                  <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                                    <span className="text-xs font-medium">Precio</span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-800">
                                    ${tournament.price}
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                                  <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
                                    <Trophy className="h-4 w-4" />
                                    <span className="text-xs font-medium">Estado</span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-800">
                                    {tournament.status === 'NOT_STARTED' ? 'Próximo' : tournament.status}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {tournament.description && (
                              <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                                {tournament.description}
                              </p>
                            )}
                            
                            {/* Registration Progress */}
                            {tournament.maxParticipants && tournament.maxParticipants > 0 && (
                              <div className="mb-4">
                                <div className="flex justify-between text-xs text-slate-500 mb-2">
                                  <span>Disponibilidad</span>
                                  <span>{tournament.currentParticipants || 0}/{tournament.maxParticipants}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ 
                                      width: `${Math.min((tournament.currentParticipants || 0) / tournament.maxParticipants * 100, 100)}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            <Button 
                              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-md"
                              size="sm"
                            >
                              Ver detalles del torneo
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 text-center">
                      <Button
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl px-6"
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        Ver todos los torneos
                      </Button>
                    </div>
                  </div>
                )}

                {/* Gallery */}
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Galería de fotos</h2>
                <ClubGallery images={galleryImages} />
              </div>

              {/* Sidebar */}
              <div>
                <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Información de contacto</h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 mr-3 text-slate-500 flex-shrink-0 mt-1" />
                      <span className="text-slate-600 font-medium">{club.address}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-3 text-slate-500" />
                      <span className="text-slate-600 font-medium">{club.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-3 text-slate-500" />
                      <span className="text-slate-600 font-medium">{club.email}</span>
                    </div>
                    {club.website && (
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 mr-3 text-slate-500" />
                        <a
                          href={`https://${club.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-800 font-medium hover:underline transition-colors"
                        >
                          {club.website}
                        </a>
                      </div>
                    )}
                    {club.instagram && (
                      <div className="flex items-center">
                        <Instagram className="h-5 w-5 mr-3 text-slate-500" />
                        <a
                          href={`https://instagram.com/${club.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-800 font-medium hover:underline transition-colors"
                        >
                          @{club.instagram}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <ContactButton club={club} />
                  </div>
                </div>

                {/* Services - Moved from main content */}
                <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">Servicios y características</h3>
                  <div className="space-y-3">
                    {club.services && club.services.length > 0 ? (
                      club.services.map((service: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center text-slate-600 bg-white p-3 rounded-xl border border-slate-200"
                        >
                          <CheckCircle className="h-4 w-4 mr-3 text-emerald-500 flex-shrink-0" />
                          <span className="font-medium text-sm">{service.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 text-center py-6 bg-white rounded-xl border border-slate-200">
                        <p className="text-sm">No hay servicios especificados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Opiniones de usuarios</h2>
            <Badge className="bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg">
              <Star className="h-4 w-4 mr-1 fill-white" />
              {club.rating > 0 ? club.rating : "Sin calificar"} ({club.reviewCount})
            </Badge>
          </div>

          <div className="space-y-6 mb-8">
            {club.reviews && club.reviews.length > 0 ? (
              club.reviews.map((review: any, index: number) => (
                <div key={index} className="border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center">
                      <div className="bg-gradient-to-r from-slate-600 to-slate-800 rounded-full w-10 h-10 flex items-center justify-center mr-4">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{review.playerName}</div>
                        <div className="text-sm text-slate-500">
                          {new Date(review.date).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < review.score ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{review.description}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-lg">No hay opiniones aún. ¡Sé el primero en dejar una reseña!</p>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <Button className="bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white rounded-xl shadow-lg px-8">
              <MessageSquare className="h-4 w-4 mr-2" />
              Escribir una opinión
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
