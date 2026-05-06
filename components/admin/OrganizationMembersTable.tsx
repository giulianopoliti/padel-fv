"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "./ConfirmDialog"
import { toggleMemberActive, updateMemberRole } from "@/app/api/admin/organizations/actions"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Member {
  id: string
  user_id: string
  member_role: string
  is_active: boolean
  users: {
    id: string
    email: string
    role: string
  }
}

interface OrganizationMembersTableProps {
  members: Member[]
  organizacionId: string
}

export const OrganizationMembersTable = ({
  members,
  organizacionId
}: OrganizationMembersTableProps) => {
  const { toast } = useToast()
  const [loadingMember, setLoadingMember] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    memberId: string
    action: "toggle" | "role"
    newRole?: string
  }>({ isOpen: false, memberId: "", action: "toggle" })

  const handleToggleMember = async (memberId: string) => {
    setLoadingMember(memberId)
    try {
      const result = await toggleMemberActive(memberId, organizacionId)
      if (result.success) {
        toast({
          title: "Éxito",
          description: `Miembro ${result.newState ? "activado" : "desactivado"} correctamente`
        })
        // Recargar la página para mostrar cambios
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
        description: "Error al actualizar el miembro",
        variant: "destructive"
      })
    } finally {
      setLoadingMember(null)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    setLoadingMember(memberId)
    try {
      const result = await updateMemberRole(memberId, newRole as any)
      if (result.success) {
        toast({
          title: "Éxito",
          description: "Rol actualizado correctamente"
        })
        // Recargar la página para mostrar cambios
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
        description: "Error al actualizar el rol",
        variant: "destructive"
      })
    } finally {
      setLoadingMember(null)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      member: "bg-gray-100 text-gray-800"
    }
    return colors[role] || "bg-gray-100 text-gray-800"
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        No hay miembros en esta organización
      </div>
    )
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left py-2 px-3 font-medium text-slate-700">User ID</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Email</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Rol Usuario</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Rol Miembro</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Estado</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b hover:bg-slate-50">
              <td className="py-2 px-3">
                <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                  {member.user_id.substring(0, 8)}...
                </code>
              </td>
              <td className="py-2 px-3">{member.users.email}</td>
              <td className="py-2 px-3">
                <Badge variant="outline">{member.users.role}</Badge>
              </td>
              <td className="py-2 px-3">
                <Select
                  value={member.member_role}
                  onValueChange={(value) => handleUpdateRole(member.id, value)}
                  disabled={loadingMember === member.id}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="py-2 px-3">
                {member.is_active ? (
                  <Badge className="bg-green-100 text-green-800">Activo</Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500">Inactivo</Badge>
                )}
              </td>
              <td className="py-2 px-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleMember(member.id)}
                  disabled={loadingMember === member.id}
                >
                  {loadingMember === member.id
                    ? "..."
                    : member.is_active
                    ? "Desactivar"
                    : "Activar"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          if (confirmDialog.action === "toggle") {
            handleToggleMember(confirmDialog.memberId)
          }
          setConfirmDialog({ ...confirmDialog, isOpen: false })
        }}
        title="Confirmar cambio"
        description="¿Estás seguro de realizar este cambio?"
      />
    </>
  )
}
