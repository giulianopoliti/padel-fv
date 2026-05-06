import { Button } from "@/components/ui/button"
import { Calendar, Building2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { LOGOS } from "@/lib/supabase-storage"

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 overflow-hidden pt-6 text-white h-dvh">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.05),transparent_50%)]"></div>

      <div className="relative container mx-auto px-6 py-12 lg:py-20 h-full flex items-center">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo Figma */}
          <div className="mb-12 flex justify-center">
            <Image
              src={LOGOS.home}
              alt="Circuito de Pádel Amateur - Logo Principal"
              width={450}
              height={170}
              className="h-36 w-auto drop-shadow-2xl"
              priority
            />
          </div>

          <h1 className="text-4xl lg:text-7xl font-black mb-8 tracking-tight text-white">
            Competi, sumá puntos, 
            <span className="block text-blue-400">subí de categoría</span>
          </h1>

          <p className="text-xl text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
          El Circuito de Pádel Amateur organiza el juego. <br />
          Clasificaciones reales, torneos por nivel, y un sistema de puntos que te motiva a mejorar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
              <Link href="/ranking">
                <Calendar className="mr-2 h-5 w-5" />
                Ver Ranking de jugadores
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
              <Link href="/register?role=club">
                <Building2 className="mr-2 h-5 w-5" />
                Organizá un torneo como club
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
} 