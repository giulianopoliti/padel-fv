"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
}

interface EditClubFormProps {
  club: Club
  onDataChange: (data: Partial<Club>) => void
}

export const EditClubForm = ({ club, onDataChange }: EditClubFormProps) => {
  const [formData, setFormData] = useState({
    name: club.name || "",
    email: club.email || "",
    phone: club.phone || "",
    phone2: club.phone2 || "",
    address: club.address || "",
    courts: club.courts || 0,
    opens_at: club.opens_at || "",
    closes_at: club.closes_at || "",
    instagram: club.instagram || "",
    website: club.website || "",
    description: club.description || ""
  })

  const handleChange = (field: string, value: string | number) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)

    // Solo enviar campos que realmente cambiaron y convertir strings vacíos a null
    const changedData: any = {}
    Object.keys(newData).forEach((key) => {
      const newValue = newData[key as keyof typeof newData]
      const originalValue = club[key as keyof Club]

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
      {/* Datos Básicos */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-slate-700">Datos Básicos</h3>

        <div>
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nombre del club"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="email@club.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+54 11 1234-5678"
            />
          </div>

          <div>
            <Label htmlFor="phone2">Teléfono 2</Label>
            <Input
              id="phone2"
              value={formData.phone2}
              onChange={(e) => handleChange("phone2", e.target.value)}
              placeholder="+54 11 8765-4321"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="Calle 123, Ciudad"
          />
        </div>
      </div>

      {/* Instalaciones */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="font-semibold text-sm text-slate-700">Instalaciones</h3>

        <div>
          <Label htmlFor="courts">Número de Canchas</Label>
          <Input
            id="courts"
            type="number"
            min="0"
            value={formData.courts}
            onChange={(e) => handleChange("courts", parseInt(e.target.value) || 0)}
            placeholder="4"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="opens_at">Hora de Apertura</Label>
            <Input
              id="opens_at"
              type="time"
              value={formData.opens_at}
              onChange={(e) => handleChange("opens_at", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="closes_at">Hora de Cierre</Label>
            <Input
              id="closes_at"
              type="time"
              value={formData.closes_at}
              onChange={(e) => handleChange("closes_at", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Redes y Web */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="font-semibold text-sm text-slate-700">Redes y Web</h3>

        <div>
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            value={formData.instagram}
            onChange={(e) => handleChange("instagram", e.target.value)}
            placeholder="@clubpadel"
          />
        </div>

        <div>
          <Label htmlFor="website">Sitio Web</Label>
          <Input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => handleChange("website", e.target.value)}
            placeholder="https://www.club.com"
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
          placeholder="Descripción del club..."
          rows={3}
        />
      </div>
    </div>
  )
}
