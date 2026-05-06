import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MapPin, Star, ChevronRight, Users, Clock, Search, Filter, Award, Building2 } from "lucide-react"
import { getClubesOptimized, getUserRoleOptimized } from "@/app/api/clubes/actions"
import ClubesClientComponent from "./clubes-client"


interface Club {
  id: string
  name: string
  address: string
  coverImage: string
  rating: number
  reviewCount: number
  courts: number
  opens_at: string
  closes_at: string
  services: { name: string }[]
}

// 🚀 OPTIMIZACIÓN FASE 3.1: Conversión a Server Component
export default async function ClubesPage() {
  // 🚀 PARALELIZACIÓN: Ejecutar ambas queries simultáneamente en el servidor
  const [clubes, userRole] = await Promise.all([
    getClubesOptimized(),
    getUserRoleOptimized()
  ]);

  console.log(`[ClubesPage] Loaded ${clubes.length} clubs on server with user role: ${userRole || 'none'}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-slate-600 to-slate-800 w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-6">Clubes de Pádel</h1>
          <p className="text-slate-600 text-xl max-w-3xl mx-auto leading-relaxed">
            Descubre los mejores clubes de pádel con instalaciones de primera calidad
          </p>
        </div>

        {/* 🚀 OPTIMIZACIÓN: Pasar datos del servidor al componente cliente */}
        <ClubesClientComponent initialClubes={clubes} userRole={userRole} />

        {/* Register Club CTA */}
        {userRole && userRole !== "CLUB" && (
          <div className="flex justify-center mt-16">
            <Link
              href="/clubs/register"
              className="inline-flex items-center bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white rounded-xl shadow-lg px-8 py-4 font-medium transition-all duration-300"
            >
              <Building2 className="mr-3 h-5 w-5" />
              Registrar Mi Club
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
