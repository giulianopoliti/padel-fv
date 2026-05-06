"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Users, ArrowRight, MapPin, Calendar, ChevronRight, Heart, Target } from "lucide-react"

export default function UpcomingTournaments() {
  const featuredTournaments = [
    {
      id: "1",
      name: "Madrid Open 2025",
      date: "15-17 Jun",
      location: "Club Elite Madrid",
      participants: "24/32",
      prize: "€5,000",
      level: "Todos los niveles",
      social: true,
    },
    {
      id: "2",
      name: "Barcelona Championship",
      date: "22-24 Jun",
      location: "Padel Barcelona Pro",
      participants: "18/24",
      prize: "€3,500",
      level: "Intermedio-Avanzado",
      social: false,
    },
    {
      id: "3",
      name: "Valencia Cup",
      date: "29 Jun - 1 Jul",
      location: "Valencia Padel Center",
      participants: "28/32",
      prize: "€4,200",
      level: "Principiantes",
      social: true,
    },
  ]

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Torneos para Todos</h2>
          <p className="text-gray-600">Desde principiantes hasta profesionales, hay un lugar para cada dupla</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredTournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <Badge className="bg-blue-100 text-blue-600 hover:bg-blue-200 border-0">
                      <Calendar className="h-3 w-3 mr-2" />
                      {tournament.date}
                    </Badge>
                    {tournament.social && (
                      <Badge className="bg-gray-100 text-gray-700 border-0">
                        <Heart className="h-3 w-3 mr-1" />
                        Social
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{tournament.prize}</div>
                    <div className="text-xs text-gray-500">Premio</div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">{tournament.name}</h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                    {tournament.location}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Users className="h-4 w-4 mr-2 text-blue-500" />
                    {tournament.participants} duplas
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Target className="h-4 w-4 mr-2 text-blue-500" />
                    {tournament.level}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full justify-between text-blue-600 hover:text-blue-700 hover:bg-blue-50 mt-2"
                >
                  Inscribir dupla
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 px-6 py-3 text-base">
            Ver todos los torneos
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
