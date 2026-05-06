import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getWeeklyWinners } from "@/app/api/tournaments"
import WeeklyWinnersCarousel from "@/components/weekly-winners-carousel"

export async function WeeklyWinnersSection() {
  const weeklyWinners = await getWeeklyWinners()

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-700 border-amber-200 px-4 py-2">
            <Trophy className="mr-2 h-4 w-4" />
            Ganadores de la Semana
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">¡Felicitaciones a Nuestros Campeones!</h2>
          <p className="text-slate-600">
            Conocé a las parejas que se coronaron esta semana en los torneos más competitivos
          </p>
        </div>

        {weeklyWinners.length > 0 ? (
          <WeeklyWinnersCarousel weeklyWinners={weeklyWinners} />
        ) : (
          <div className="text-center py-12">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-700 mb-2">No hay ganadores esta semana</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              No se han completado torneos con fotos de ganadores en los últimos 7 días. ¡Vuelve pronto para ver a los
              nuevos campeones!
            </p>
          </div>
        )}

        {weeklyWinners.length > 6 && (
          <div className="text-center mt-12">
            <Button asChild variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 px-6 py-3">
              <Link href="/ganadores">
                Ver Todos los Ganadores
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
} 