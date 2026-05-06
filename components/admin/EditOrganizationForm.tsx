"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Organization {
  id: string
  name: string
  email: string | null
  phone: string | null
  responsible_first_name: string | null
  responsible_last_name: string | null
  responsible_dni: string | null
  description: string | null
}

interface EditOrganizationFormProps {
  organization: Organization
  onDataChange: (data: Partial<Organization>) => void
}

export const EditOrganizationForm = ({
  organization,
  onDataChange
}: EditOrganizationFormProps) => {
  const [formData, setFormData] = useState({
    name: organization.name || "",
    email: organization.email || "",
    phone: organization.phone || "",
    responsible_first_name: organization.responsible_first_name || "",
    responsible_last_name: organization.responsible_last_name || "",
    responsible_dni: organization.responsible_dni || "",
    description: organization.description || ""
  })

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)

    // Solo enviar campos que realmente cambiaron y convertir strings vacíos a null
    const changedData: any = {}
    Object.keys(newData).forEach((key) => {
      const newValue = newData[key as keyof typeof newData]
      const originalValue = organization[key as keyof Organization]

      if (newValue !== originalValue) {
        // Si es string vacío, enviar null en lugar de ""
        if (typeof newValue === "string" && newValue === "") {
          changedData[key] = null
        } else {
          changedData[key] = newValue
        }
      }
    })

    onDataChange(changedData)
  }

  return (
    <div className="space-y-4">
      {/* Datos de la Organización */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-slate-700">Datos de la Organización</h3>

        <div>
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nombre de la organización"
          />
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@ejemplo.com"
          />
        </div>

        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="+54 11 1234-5678"
          />
        </div>
      </div>

      {/* Datos del Responsable */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="font-semibold text-sm text-slate-700">Datos del Responsable</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="responsible_first_name">Nombre</Label>
            <Input
              id="responsible_first_name"
              value={formData.responsible_first_name}
              onChange={(e) => handleChange("responsible_first_name", e.target.value)}
              placeholder="Nombre"
            />
          </div>

          <div>
            <Label htmlFor="responsible_last_name">Apellido</Label>
            <Input
              id="responsible_last_name"
              value={formData.responsible_last_name}
              onChange={(e) => handleChange("responsible_last_name", e.target.value)}
              placeholder="Apellido"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="responsible_dni">DNI</Label>
          <Input
            id="responsible_dni"
            value={formData.responsible_dni}
            onChange={(e) => handleChange("responsible_dni", e.target.value)}
            placeholder="12345678"
          />
        </div>
      </div>

      {/* Descripción */}
      <div className="pt-4 border-t">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Descripción de la organización..."
          rows={3}
        />
      </div>
    </div>
  )
}
