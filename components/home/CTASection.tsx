import { Button } from "@/components/ui/button"
import { Trophy, Building2 } from "lucide-react"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
      <div className="container mx-auto px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">Creá tu cuenta y empezá a competir</h2>
          <p className="text-xl text-blue-100 mb-12 leading-relaxed">
            Unite a la revolución del pádel amateur. Ranking, torneos y comunidad activa te esperan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg">
              <Link href="/register">
                <Trophy className="mr-2 h-5 w-5" />
                Registrarme como Jugador
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-blue-800 hover:bg-blue-900 text-white px-8 py-6 text-lg">
              <Link href="/register?role=club">
                <Building2 className="mr-2 h-5 w-5" />
                Registrarme como Club
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
} 