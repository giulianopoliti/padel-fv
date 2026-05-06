"use client"
import { Card } from "@/components/ui/card"
import { Users, UserPlus, Settings, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function OrganizationMembersSection() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Miembros de la Organización</h3>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona los miembros y sus permisos dentro de la organización
          </p>
        </div>
        <Button size="sm" disabled>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Miembro
        </Button>
      </div>

      {/* Current User as Owner */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Tú (Propietario)</h4>
              <p className="text-sm text-gray-600">Administrador principal de la organización</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              <Crown className="h-3 w-3 mr-1" />
              Propietario
            </Badge>
            <Button variant="ghost" size="sm" disabled>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Placeholder for future members */}
      <div className="text-center py-12">
        <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Miembros</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Esta funcionalidad estará disponible próximamente. Podrás invitar miembros, asignar roles y 
          gestionar permisos para la administración de la organización.
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>• Invitar miembros por email</p>
          <p>• Asignar roles y permisos específicos</p>
          <p>• Gestionar el acceso a clubes individuales</p>
          <p>• Control de permisos administrativos</p>
        </div>
      </div>
    </div>
  )
}