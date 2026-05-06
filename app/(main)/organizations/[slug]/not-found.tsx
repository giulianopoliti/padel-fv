import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Building2, ArrowLeft } from "lucide-react"

export default function OrganizationNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 flex items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full border-4 border-white/20 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-black text-white mb-6">404</h1>
        <h2 className="text-3xl font-bold text-cyan-100 mb-4">Organización No Encontrada</h2>

        {/* Description */}
        <p className="text-xl text-cyan-200 mb-8 leading-relaxed">
          La organización que buscas no existe o no está disponible en este momento.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-white text-blue-900 hover:bg-cyan-50"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Volver al Inicio
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
            asChild
          >
            <Link href="/#organizadores">
              Ver Todas las Organizaciones
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
