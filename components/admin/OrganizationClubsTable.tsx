"use client"

import { Badge } from "@/components/ui/badge"

interface Club {
  id: string
  created_at: string
  club_id: string
  clubes: {
    id: string
    name: string
    email: string | null
    is_active: boolean
  } | null
}

interface OrganizationClubsTableProps {
  clubs: Club[]
}

export const OrganizationClubsTable = ({ clubs }: OrganizationClubsTableProps) => {
  if (clubs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No hay clubes asociados a esta organización
      </div>
    )
  }

  return (
    <div className="mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left py-2 px-3 font-medium text-slate-700">Nombre del Club</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Email</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Estado</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700">Fecha Asociación</th>
          </tr>
        </thead>
        <tbody>
          {clubs.map((club) => (
            <tr key={club.id} className="border-b hover:bg-slate-50">
              <td className="py-2 px-3 font-medium">
                {club.clubes?.name || "Sin nombre"}
              </td>
              <td className="py-2 px-3 text-slate-600">
                {club.clubes?.email || "-"}
              </td>
              <td className="py-2 px-3">
                {club.clubes?.is_active ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">Activo</Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 text-xs">Inactivo</Badge>
                )}
              </td>
              <td className="py-2 px-3 text-slate-600">
                {new Date(club.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
