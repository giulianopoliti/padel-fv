import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Trophy, Building2, BookOpen, Info } from "lucide-react"
import Link from "next/link"

export function InfoSection() {
  return (
    <section className="py-24 bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">¿Nuevo en el Circuito de Pádel Amateur?</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Conocé todo lo que necesitás saber para empezar a competir, sumar puntos y subir de categoría
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Sistema de Categorías</h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                9 categorías automáticas basadas en puntos. Desde 9na (0-299 pts) hasta 1ra (2400+ pts).
                Tu categoría se actualiza automáticamente.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/info/categorias">
                  <Info className="mr-2 h-4 w-4" />
                  Ver Categorías
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Tipos de Torneos</h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                Torneos American (1 día) y Long (1-2 meses). Cada tipo tiene un formato único. 
                Ganar suma puntos, perder también.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/info/tournaments">
                  <Trophy className="mr-2 h-4 w-4" />
                  Ver Torneos
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 border-slate-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Para Clubes</h3>
              <p className="text-slate-600 mb-4 leading-relaxed">
                Si tenés un club, podés organizar torneos, gestionar inscripciones automáticamente 
                y ganar visibilidad en la plataforma.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/info/clubes">
                  <Building2 className="mr-2 h-4 w-4" />
                  Ver Beneficios
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Badge className="mb-4 bg-blue-100 text-blue-800 px-4 py-2">
            <BookOpen className="mr-2 h-4 w-4" />
            Guía Completa Disponible
          </Badge>
          <p className="text-slate-600 mb-6">
            ¿Querés conocer todos los detalles del sistema? Tenemos una guía completa para vos.
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href="/info">
              <BookOpen className="mr-2 h-4 w-4" />
              Ver Guía Completa
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
} 