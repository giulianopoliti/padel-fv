"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Users, ArrowRight, Star, MapPin, Calendar, ChevronRight } from "lucide-react"

export default function FeaturedClubs() {
  const featuredClubs = [
    {
      id: "1",
      name: "Club Elite Madrid",
      location: "Madrid",
      courts: 12,
      rating: 4.8,
      image: "/placeholder.svg?height=200&width=300",
      community: "850+ miembros",
      events: "3 eventos/semana",
      vibe: "Competitivo y social",
    },
    {
      id: "2",
      name: "Padel Barcelona Pro",
      location: "Barcelona",
      courts: 8,
      rating: 4.7,
      image: "/placeholder.svg?height=200&width=300",
      community: "620+ miembros",
      events: "2 eventos/semana",
      vibe: "Familiar y acogedor",
    },
    {
      id: "3",
      name: "Valencia Padel Center",
      location: "Valencia",
      courts: 10,
      rating: 4.6,
      image: "/placeholder.svg?height=200&width=300",
      community: "740+ miembros",
      events: "4 eventos/semana",
      vibe: "Diversión garantizada",
    },
  ]

  return (
    <section className="py-24 bg-blue-50/50">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Clubes con Alma</h2>
          <p className="text-gray-600">Más que instalaciones, son el corazón de la comunidad del pádel</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredClubs.map((club) => (
            <Card
              key={club.id}
              className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="relative">
                <img
                  src={club.image || "/placeholder.svg"}
                  alt={club.name}
                  className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-white/90 backdrop-blur-sm text-gray-700 border-0">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {club.rating}
                  </Badge>
                </div>
                <div className="absolute bottom-4 left-4">
                  <Badge className="bg-blue-600/80 text-white border-0 backdrop-blur-sm">{club.vibe}</Badge>
                </div>
              </div>

              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{club.name}</h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                    {club.location}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Users className="h-4 w-4 mr-2 text-blue-500" />
                    {club.community}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                    {club.events}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-2"
                >
                  Unirse a la comunidad
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6 py-3 text-base">
            Explorar todos los clubes
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
