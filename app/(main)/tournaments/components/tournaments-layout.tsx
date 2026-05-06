"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search, Trophy, Calendar, Archive, Settings, Plus } from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import TournamentFilters from "./tournament-filters"

interface TournamentsLayoutProps {
  children: React.ReactNode
  categories: Array<{ name: string }>
  organizations: Array<{ id: string; name: string }>
  clubs: Array<{ id: string; name: string }>
}

export default function TournamentsLayout({ children, categories, organizations, clubs }: TournamentsLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userDetails } = useUser()
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")

  // Update search term when URL changes
  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "")
  }, [searchParams])

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }
    params.delete("page") // Reset to page 1 when searching
    router.push(`${pathname}?${params.toString()}`)
  }

  const isActive = (path: string) => pathname.includes(path)

  return (
    <div className="min-h-screen bg-white">
      {/* Club Management Banner */}
      {(userDetails?.role === "CLUB" || userDetails?.role === "ORGANIZADOR") && (
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-6 py-4">
            <div className="flex justify-end">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Link href="/my-tournaments">
                    <Settings className="mr-2 h-4 w-4" />
                    Gestionar Mis Torneos
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Link href="/tournaments/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Nuevo Torneo
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Torneos de Pádel</h1>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Descubre todos los torneos disponibles, filtra por categoría y encuentra el torneo perfecto para ti.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-10">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Buscar torneos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-300 focus:ring-blue-200 text-gray-600 placeholder:text-gray-400"
              />
            </div>

            {/* Filters */}
            <TournamentFilters categories={categories} organizations={organizations} clubs={clubs} />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="w-full border-b border-gray-200 bg-gray-50 p-1">
            <div className="flex">
              <Link
                href={`/tournaments/upcoming?${searchParams.toString()}`}
                className={`flex-1 py-3 flex items-center justify-center transition-colors rounded-md ${
                  isActive("/upcoming")
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Próximos
              </Link>

              <Link
                href={`/tournaments/in-progress?${searchParams.toString()}`}
                className={`flex-1 py-3 flex items-center justify-center transition-colors rounded-md ${
                  isActive("/in-progress")
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Trophy className="mr-2 h-5 w-5" />
                Activos
              </Link>

              <Link
                href={`/tournaments/past?${searchParams.toString()}`}
                className={`flex-1 py-3 flex items-center justify-center transition-colors rounded-md ${
                  isActive("/past")
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Archive className="mr-2 h-5 w-5" />
                Pasados
              </Link>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
