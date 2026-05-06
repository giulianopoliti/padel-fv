"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Users, Search, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { ExportUsersModal } from "@/components/admin/ExportUsersModal"
import { searchUsers, type SearchUsersFilters } from "@/app/api/admin/users/actions"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

interface UsersClientProps {
  initialUsers: User[]
  initialTotalCount: number
  initialTotalPages: number
  initialPage: number
}

const getRoleBadgeColor = (role: string) => {
  const colors: Record<string, string> = {
    PLAYER: "bg-blue-100 text-blue-800 border-blue-300",
    CLUB: "bg-green-100 text-green-800 border-green-300",
    COACH: "bg-purple-100 text-purple-800 border-purple-300",
    ORGANIZADOR: "bg-orange-100 text-orange-800 border-orange-300",
    ADMIN: "bg-red-100 text-red-800 border-red-300"
  }
  return colors[role] || "bg-gray-100 text-gray-800 border-gray-300"
}

export const UsersClient = ({
  initialUsers,
  initialTotalCount,
  initialTotalPages,
  initialPage
}: UsersClientProps) => {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [isSearching, setIsSearching] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Filtros
  const [searchEmail, setSearchEmail] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  const buildFilters = (): SearchUsersFilters => {
    const filters: SearchUsersFilters = {}
    if (searchEmail.trim()) filters.searchEmail = searchEmail
    if (selectedRole !== "all") filters.role = selectedRole
    if (dateFrom) filters.dateFrom = new Date(dateFrom).toISOString()
    if (dateTo) filters.dateTo = new Date(dateTo).toISOString()
    return filters
  }

  const handleSearch = async () => {
    setIsSearching(true)
    try {
      const filters = buildFilters()
      const result = await searchUsers(filters, 1, 50)

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        setUsers(result.data)
        setTotalCount(result.totalCount)
        setTotalPages(result.totalPages)
        setCurrentPage(1)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al buscar usuarios",
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return

    setIsSearching(true)
    try {
      const filters = buildFilters()
      const result = await searchUsers(filters, newPage, 50)

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        setUsers(result.data)
        setCurrentPage(newPage)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cambiar de página",
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-8 w-8" />
            Usuarios
          </h1>
          <p className="text-slate-600 mt-2">Gestión de usuarios de la plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setExportModalOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar a CSV
          </Button>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {totalCount} usuarios
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search by email */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por email... (presiona Enter)"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                  disabled={isSearching}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            {/* Role and Date filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="role-filter">Rol</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role-filter">
                    <SelectValue placeholder="Todos los roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="CLUB">Club</SelectItem>
                    <SelectItem value="COACH">Entrenador</SelectItem>
                    <SelectItem value="PLAYER">Jugador</SelectItem>
                    <SelectItem value="ORGANIZADOR">Organizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-from">Fecha desde</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-to">Fecha hasta</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Listado de Usuarios</CardTitle>
          <CardDescription>
            Página {currentPage} de {totalPages} ({totalCount} usuarios totales)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Rol</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">
                    Fecha de Creación
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      {searchEmail || selectedRole !== "all" || dateFrom || dateTo
                        ? "No se encontraron usuarios"
                        : "No hay usuarios registrados"}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {user.id.substring(0, 8)}...
                        </code>
                      </td>
                      <td className="py-3 px-4 font-medium">{user.email}</td>
                      <td className="py-3 px-4">
                        <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(user.created_at).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-4">
        <div className="text-sm text-slate-600 px-1">
          Página {currentPage} de {totalPages} ({totalCount} usuarios totales)
        </div>
        {users.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              {searchEmail || selectedRole !== "all" || dateFrom || dateTo
                ? "No se encontraron usuarios"
                : "No hay usuarios registrados"}
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium break-all">
                      {user.email}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                        ID: {user.id.substring(0, 8)}...
                      </code>
                    </CardDescription>
                  </div>
                  <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Fecha de registro:</span>
                  <span className="text-right">
                    {new Date(user.created_at).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isSearching}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <span className="text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isSearching}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Modal */}
      <ExportUsersModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
    </div>
  )
}
