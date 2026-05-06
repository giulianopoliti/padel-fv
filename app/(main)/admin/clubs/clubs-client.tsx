"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Edit, Power } from "lucide-react"
import { AdminEditModal } from "@/components/admin/AdminEditModal"
import { EditClubForm } from "@/components/admin/EditClubForm"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { updateClub, toggleClubActive } from "@/app/api/admin/clubs/actions"
import { useToast } from "@/components/ui/use-toast"

interface Club {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  phone2: string | null
  address: string | null
  courts: number | null
  opens_at: string | null
  closes_at: string | null
  instagram: string | null
  website: string | null
  description: string | null
  is_active: boolean
  created_at: string
  user_id: string | null
  users?: {
    email: string
  } | null
}

interface ClubsClientProps {
  clubs: Club[]
}

export const ClubsClient = ({ clubs }: ClubsClientProps) => {
  const { toast } = useToast()
  const [editingClub, setEditingClub] = useState<Club | null>(null)
  const [editData, setEditData] = useState<Partial<Club>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    clubId: string
    currentState: boolean
  }>({ isOpen: false, clubId: "", currentState: false })

  const handleEdit = (club: Club) => {
    setEditingClub(club)
    setEditData({})
  }

  const handleSave = async () => {
    if (!editingClub) return

    setIsSaving(true)
    try {
      const result = await updateClub(editingClub.id, editData)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Club actualizado correctamente"
        })
        setEditingClub(null)
        setEditData({})
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar el club",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (clubId: string, currentState: boolean) => {
    try {
      const result = await toggleClubActive(clubId)
      if (result.success) {
        toast({
          title: "Éxito",
          description: `Club ${result.newState ? "activado" : "desactivado"} correctamente`
        })
        window.location.reload()
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cambiar el estado del club",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Clubes
          </h1>
          <p className="text-slate-600 mt-2">
            Gestión de clubes registrados en la plataforma
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {clubs.length} clubes
        </Badge>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Listado de Clubes</CardTitle>
          <CardDescription>
            Vista completa de todos los clubes con su información
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Teléfono</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Dirección</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Canchas</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Usuario</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clubs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      No hay clubes registrados
                    </td>
                  </tr>
                ) : (
                  clubs.map((club) => (
                    <tr key={club.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{club.name || "-"}</td>
                      <td className="py-3 px-4 text-sm">{club.email || "-"}</td>
                      <td className="py-3 px-4 text-sm">{club.phone || "-"}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{club.address || "-"}</td>
                      <td className="py-3 px-4 text-sm">{club.courts || 0}</td>
                      <td className="py-3 px-4">
                        {club.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Inactivo</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {club.users?.email || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(club)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={club.is_active ? "outline" : "default"}
                            size="sm"
                            onClick={() =>
                              setConfirmDialog({
                                isOpen: true,
                                clubId: club.id,
                                currentState: club.is_active
                              })
                            }
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
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
        {clubs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              No hay clubes registrados
            </CardContent>
          </Card>
        ) : (
          clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base">{club.name || "Sin nombre"}</CardTitle>
                    <CardDescription className="mt-1 break-all">
                      {club.email || "Sin email"}
                    </CardDescription>
                  </div>
                  {club.is_active ? (
                    <Badge className="bg-green-100 text-green-800">Activo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500">Inactivo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Teléfono:</span>
                  <span>{club.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Dirección:</span>
                  <span className="text-right">{club.address || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Canchas:</span>
                  <span className="font-semibold">{club.courts || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Usuario:</span>
                  <span className="text-right text-xs break-all">{club.users?.email || "-"}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(club)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant={club.is_active ? "outline" : "default"}
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        clubId: club.id,
                        currentState: club.is_active
                      })
                    }
                  >
                    <Power className="h-4 w-4 mr-2" />
                    {club.is_active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingClub && (
        <AdminEditModal
          isOpen={true}
          onClose={() => {
            setEditingClub(null)
            setEditData({})
          }}
          onSave={handleSave}
          title={`Editar Club: ${editingClub.name}`}
          isSaving={isSaving}
        >
          <EditClubForm club={editingClub} onDataChange={setEditData} />
        </AdminEditModal>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          handleToggleActive(confirmDialog.clubId, confirmDialog.currentState)
          setConfirmDialog({ ...confirmDialog, isOpen: false })
        }}
        title={confirmDialog.currentState ? "Desactivar Club" : "Activar Club"}
        description={
          confirmDialog.currentState
            ? "¿Estás seguro de desactivar este club? No podrá acceder a la plataforma."
            : "¿Estás seguro de activar este club?"
        }
      />
    </div>
  )
}
