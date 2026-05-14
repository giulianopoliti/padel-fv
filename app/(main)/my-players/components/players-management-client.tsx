"use client"

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Loader2 } from 'lucide-react'
import { searchPlayersOrganization } from '@/lib/api/supabase-edge'
import { PaginationControl } from '@/components/ui/pagination'
import PlayersTableWithActions from '@/components/players/players-table-with-actions'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from '@/components/ui/use-toast'

interface PlayerData {
  id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string | null
  score: number | null
  profile_image_url: string | null
  category_name: string | null
  email?: string | null
  users?: { email: string | null } | Array<{ email: string | null }>
}

interface Category {
  name: string
  lower_range: number
  upper_range: number | null
}

interface PlayersManagementClientProps {
  initialPlayers: PlayerData[]
  initialCategories: Category[]
  initialTotal: number
  initialPage: number
  organizationId: string
}

export default function PlayersManagementClient({
  initialPlayers,
  initialCategories,
  initialTotal,
  initialPage,
  organizationId
}: PlayersManagementClientProps) {
  const [players, setPlayers] = useState(initialPlayers)
  const [total, setTotal] = useState(initialTotal)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isSearching, setIsSearching] = useState(false)
  const { toast } = useToast()

  // Debounce del searchTerm (300ms)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Función de búsqueda via Edge Function
  const performSearch = useCallback(async (
    search: string,
    page: number,
    category: string
  ) => {
    try {
      setIsSearching(true)

      const result = await searchPlayersOrganization({
        searchTerm: search,
        page,
        pageSize: 20,
        categoryFilter: category,
        organizationId
      })

      if (result.success) {
        setPlayers(result.players || [])
        setTotal(result.total || 0)
        setCurrentPage(page)
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudieron cargar los jugadores',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error searching players:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los jugadores',
        variant: 'destructive'
      })
    } finally {
      setIsSearching(false)
    }
  }, [organizationId, toast])

  // Effect para búsqueda en tiempo real
  useEffect(() => {
    performSearch(debouncedSearch, 1, categoryFilter)
  }, [debouncedSearch, categoryFilter, performSearch])

  const handlePageChange = (page: number) => {
    performSearch(searchTerm, page, categoryFilter)
  }

  const handlePlayerUpdate = (updatedPlayer: PlayerData) => {
    setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p))
  }

  const handlePlayerDelete = (playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId))
    setTotal(prev => prev - 1)
  }

  return (
    <div className="space-y-6">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Jugadores</h1>
          <p className="text-muted-foreground mt-1">
            {isSearching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </span>
            ) : (
              `${total} jugador${total !== 1 ? 'es' : ''} en total`
            )}
          </p>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, apellido o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            disabled={isSearching}
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          disabled={isSearching}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {initialCategories.map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla con loading overlay */}
      <div className="relative">
        {isSearching && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <PlayersTableWithActions
          players={players}
          categories={initialCategories}
          onPlayerUpdate={handlePlayerUpdate}
          onPlayerDelete={handlePlayerDelete}
        />
      </div>

      {/* Paginación */}
      {total > 20 && (
        <div className="flex justify-center">
          <PaginationControl
            total={total}
            pageSize={20}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            disabled={isSearching}
          />
        </div>
      )}
    </div>
  )
}
