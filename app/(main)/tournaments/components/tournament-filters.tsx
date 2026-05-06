"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Filter, X, ChevronDown } from "lucide-react"

interface TournamentFiltersProps {
  categories: Array<{ name: string }>
  organizations: Array<{ id: string; name: string }>
  clubs: Array<{ id: string; name: string }>
}

export default function TournamentFilters({ categories, organizations, clubs }: TournamentFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const categoryFilter = searchParams.get("category") || "all"
  const organizationFilter = searchParams.get("organization") || "all"
  const clubFilter = searchParams.get("club") || "all"

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      setIsOpen(window.innerWidth >= 768) // Open by default on desktop
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("category")
    } else {
      params.set("category", value)
    }
    params.delete("page") // Reset to page 1 when filtering
    router.push(`?${params.toString()}`)
  }

  const handleOrganizationChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("organization")
    } else {
      params.set("organization", value)
    }
    params.delete("page") // Reset to page 1 when filtering
    router.push(`?${params.toString()}`)
  }

  const handleClubChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("club")
    } else {
      params.set("club", value)
    }
    params.delete("page") // Reset to page 1 when filtering
    router.push(`?${params.toString()}`)
  }

  const handleClearFilters = () => {
    const params = new URLSearchParams()
    // Keep only the search param if it exists
    const search = searchParams.get("search")
    if (search) {
      params.set("search", search)
    }
    router.push(`?${params.toString()}`)
  }

  const hasActiveFilters = categoryFilter !== "all" || organizationFilter !== "all" || clubFilter !== "all"

  // Count active filters
  const activeFiltersCount = [
    categoryFilter !== "all",
    organizationFilter !== "all",
    clubFilter !== "all"
  ].filter(Boolean).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 hover:bg-gray-50 rounded-md transition-colors border border-gray-200">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-gray-700">
          Filtros
          {hasActiveFilters && (
            <span className="ml-1 text-sm text-blue-600">
              ({activeFiltersCount} aplicado{activeFiltersCount > 1 ? 's' : ''})
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 ml-auto text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-wrap">
      <div className="w-full md:w-56">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="pl-10 border-gray-200 focus:border-blue-300 focus:ring-blue-200 text-gray-600 placeholder:text-gray-400">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.name} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full md:w-56">
        <Select value={organizationFilter} onValueChange={handleOrganizationChange}>
          <SelectTrigger className="border-gray-200 focus:border-blue-300 focus:ring-blue-200 text-gray-600 placeholder:text-gray-400">
            <SelectValue placeholder="Organizador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los organizadores</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full md:w-56">
        <Select value={clubFilter} onValueChange={handleClubChange}>
          <SelectTrigger className="border-gray-200 focus:border-blue-300 focus:ring-blue-200 text-gray-600 placeholder:text-gray-400">
            <SelectValue placeholder="Club" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clubes</SelectItem>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="w-full md:w-auto border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
